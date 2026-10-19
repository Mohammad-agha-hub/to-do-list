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

export function get<T>(url: string): Promise<T> {
  return request<T>("GET", url);
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
