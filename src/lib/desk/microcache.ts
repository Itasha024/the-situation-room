/**
 * A small in-memory cache for the site's read endpoints (20 Oct: "the site still takes a decade to
 * load"). The site's one process on the 1 GB server spent over a core recomputing the same answers
 * for every visitor and every edge region: the edge keeps an answer a minute per region, so each
 * region's miss read the database and rebuilt the answer again. Here each answer is built once:
 *
 * - fresh for `freshMs`: served as it is;
 * - then, up to `staleMs`: still served at once, and rebuilt once behind it (one build at a time);
 * - older, or never built: the visitor waits for the one build under way.
 *
 * Bounded by entries and by bytes, oldest out first, so it stays small beside the 448 MB heap.
 */
import { promisify } from "node:util";
import { gzip } from "node:zlib";

export type Cached = { at: number; body: string; status: number; headers: Record<string, string>; gz?: Uint8Array };

const gzipAsync = promisify(gzip);

/**
 * The body gzipped once, off the main thread, for an answer over 2 KB. The edge asks for gzip and the
 * site sent everything plain: the whole war's pins went out as 1.4 MB on each edge miss, over the
 * server's small free allowance of traffic (20 Oct).
 */
export async function gzipped(body: string): Promise<Uint8Array | undefined> {
  if (body.length < 2048) return undefined;
  try {
    return new Uint8Array(await gzipAsync(body, { level: 6 }));
  } catch {
    return undefined;
  }
}

/** An answer as a Response: gzipped when the asker takes gzip and there is a gzipped copy. */
export function respond(v: Pick<Cached, "body" | "status" | "headers" | "gz">, accept: string | null | undefined, extra: Record<string, string> = {}): Response {
  const headers: Record<string, string> = { ...v.headers, ...extra, vary: "accept-encoding" };
  if (v.gz && /gzip/i.test(accept ?? "")) {
    return new Response(v.gz as unknown as BodyInit, { status: v.status, headers: { ...headers, "content-encoding": "gzip", "content-length": String(v.gz.byteLength) } });
  }
  return new Response(v.body, { status: v.status, headers });
}

const MAX_ENTRIES = 40;
const MAX_BYTES = 16 * 1024 * 1024;

const entries = new Map<string, Cached>();
const building = new Map<string, Promise<Cached>>();
let bytes = 0;

function put(key: string, v: Cached): void {
  const was = entries.get(key);
  if (was) {
    bytes -= size(was);
    entries.delete(key);
  }
  entries.set(key, v);
  bytes += size(v);
  // Map order is insertion order: the first keys are the least recently built.
  for (const [k, e] of entries) {
    if (entries.size <= MAX_ENTRIES && bytes <= MAX_BYTES) break;
    if (k === key) continue;
    entries.delete(k);
    bytes -= size(e);
  }
}

const size = (v: Cached) => v.body.length + (v.gz?.byteLength ?? 0);

function build(key: string, make: () => Promise<Omit<Cached, "at" | "gz">>): Promise<Cached> {
  let p = building.get(key);
  if (!p) {
    p = make()
      .then(async (r) => {
        const v: Cached = { ...r, at: Date.now(), gz: r.status === 200 ? await gzipped(r.body) : undefined };
        // Only a good answer is kept; an error is never served to the next visitor.
        if (v.status === 200) put(key, v);
        return v;
      })
      .finally(() => building.delete(key));
    building.set(key, p);
  }
  return p;
}

/** The answer under `key`: kept, kept and rebuilt behind, or built now (see above). */
export async function cachedAnswer(
  key: string,
  freshMs: number,
  staleMs: number,
  make: () => Promise<Omit<Cached, "at" | "gz">>,
): Promise<Cached & { how: "fresh" | "stale" | "built" }> {
  const hit = entries.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age <= freshMs) return { ...hit, how: "fresh" };
  if (hit && age <= staleMs) {
    build(key, make).catch(() => {});
    return { ...hit, how: "stale" };
  }
  return { ...(await build(key, make)), how: "built" };
}

/** The cached answer as a Response, with an `x-desk-cache` header saying how it was served. */
export async function cachedResponse(
  key: string,
  freshMs: number,
  staleMs: number,
  make: () => Promise<Omit<Cached, "at" | "gz">>,
  accept?: string | null,
): Promise<Response> {
  const v = await cachedAnswer(key, freshMs, staleMs, make);
  const age = Math.max(0, Math.round((Date.now() - v.at) / 1000));
  return respond(v, accept, { "x-desk-cache": `${v.how}; age=${age}` });
}

/** For tests. */
export function clearCache(): void {
  entries.clear();
  building.clear();
  bytes = 0;
}
