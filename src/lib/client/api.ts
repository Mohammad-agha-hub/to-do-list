"use client";

// Thin fetch wrapper with an offline mutation queue.
// Reads come from the network (falling back to the service worker cache);
// writes that fail because we're offline are queued in localStorage and
// replayed in order when the connection returns.

const QUEUE_KEY = "momentum:queue";
const ID_MAP_KEY = "momentum:idmap";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export type Method = "POST" | "PATCH" | "PUT" | "DELETE";
type Queued = { method: Method; url: string; body?: unknown; tempId?: number };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — nothing we can do */
  }
}

const listeners = new Set<(n: number) => void>();
function notify() {
  const n = pendingCount();
  listeners.forEach((l) => l(n));
}
export function onQueueChange(fn: (n: number) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function pendingCount() {
  return read<Queued[]>(QUEUE_KEY, []).length;
}

let tempCounter = -1;
/** Negative ids stand in for records created while offline. */
export function nextTempId() {
  tempCounter -= 1;
  return Date.now() * -1 + tempCounter;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + url, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
    window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.error ?? res.statusText);
  }
  return (await res.json()) as T;
}

export async function get<T>(url: string): Promise<T> {
  const data = await request<T>("GET", url);
  // While changes are waiting to sync, reads may come from the offline cache;
  // re-apply queued task edits so the UI doesn't snap back.
  return pendingCount() > 0 ? overlayQueued(data) : data;
}

function overlayQueued<T>(data: T): T {
  const patches = new Map<number, Record<string, unknown>>();
  for (const q of read<Queued[]>(QUEUE_KEY, [])) {
    const m = /^\/api\/tasks\/(-?\d+)$/.exec(q.url);
    if (m && q.method === "PATCH" && q.body && typeof q.body === "object") {
      patches.set(Number(m[1]), { ...patches.get(Number(m[1])), ...(q.body as object) });
    }
    if (m && q.method === "DELETE") patches.set(Number(m[1]), { __deleted: true });
  }
  if (!patches.size) return data;

  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      return v.filter((x) => !(isTask(x) && patches.get(x.id)?.__deleted)).map(walk);
    }
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
      const id = isTask(o) ? o.id : null;
      if (id !== null && patches.has(id)) Object.assign(o, patches.get(id));
      // Today view: keep finished tasks in the "done" list.
      if (Array.isArray(o.tasks) && Array.isArray(o.done)) {
        const moved = (o.tasks as { status: string }[]).filter((t) => t.status === "done");
        o.tasks = (o.tasks as { status: string }[]).filter((t) => t.status === "todo");
        o.done = [...moved, ...(o.done as unknown[])];
      }
      return o;
    }
    return v;
  };
  return walk(data) as T;
}

function isTask(x: unknown): x is { id: number; title: string; status: string } {
  return !!x && typeof x === "object" && "id" in x && "title" in x && "status" in x && "carried_over_count" in x;
}

const isNetworkError = (e: unknown) => e instanceof TypeError;

/**
 * Sends a mutation. If offline, queues it and resolves with null.
 * `tempId` marks a create whose real id should replace the temp id in later queued URLs.
 */
export async function send<T>(method: Method, url: string, body?: unknown, tempId?: number): Promise<T | null> {
  const resolved = resolveUrl(url);
  if (pendingCount() > 0 || (typeof navigator !== "undefined" && !navigator.onLine)) {
    enqueue({ method, url: resolved, body, tempId });
    return null;
  }
  try {
    return await request<T>(method, resolved, body);
  } catch (e) {
    if (isNetworkError(e)) {
      enqueue({ method, url: resolved, body, tempId });
      return null;
    }
    throw e;
  }
}

function enqueue(item: Queued) {
  write(QUEUE_KEY, [...read<Queued[]>(QUEUE_KEY, []), item]);
  notify();
}

function resolveUrl(url: string) {
  const map = read<Record<string, number>>(ID_MAP_KEY, {});
  return url.replace(/\/(-\d+)(?=\/|$)/g, (m, id) => (map[id] ? `/${map[id]}` : m));
}

let flushing = false;
/** Replays queued mutations in order. Returns true if anything was sent. */
export async function flushQueue(): Promise<boolean> {
  if (flushing) return false;
  flushing = true;
  let sent = false;
  try {
    for (;;) {
      const queue = read<Queued[]>(QUEUE_KEY, []);
      if (!queue.length) break;
      const [item, ...rest] = queue;
      try {
        const result = await request<{ id?: number }>(item.method, resolveUrl(item.url), item.body);
        if (item.tempId && result?.id) {
          write(ID_MAP_KEY, { ...read(ID_MAP_KEY, {}), [item.tempId]: result.id });
        }
      } catch (e) {
        if (isNetworkError(e)) break; // still offline, try later
        // The server rejected it (e.g. deleted meanwhile); drop it so the queue isn't stuck.
        console.warn("Dropped queued change", item, e);
      }
      write(QUEUE_KEY, rest);
      sent = true;
      notify();
    }
  } finally {
    flushing = false;
  }
  return sent;
}
