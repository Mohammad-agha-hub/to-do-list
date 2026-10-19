import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new HttpError(404, what);

export type Ctx<P extends string = "id"> = { params: Promise<Record<P, string>> };

/** Wraps a route handler with JSON responses and consistent error handling. */
export function route<C>(fn: (req: Request, ctx: C) => unknown | Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 });
      }
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const json = await req.json().catch(() => {
    throw new HttpError(400, "Body must be JSON");
  });
  return schema.parse(json);
}

export async function idParam(ctx: Ctx): Promise<number> {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Bad id");
  return n;
}

/** Builds "a = @a, b = @b" for the keys present in a patch object. */
export function setClause(patch: Record<string, unknown>, allowed: readonly string[]): string {
  return Object.keys(patch)
    .filter((k) => allowed.includes(k) && patch[k] !== undefined)
    .map((k) => `${k} = @${k}`)
    .join(", ");
}

/** SQLite can't bind booleans. */
export function sqlValues(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = typeof v === "boolean" ? (v ? 1 : 0) : v;
  }
  return out;
}
