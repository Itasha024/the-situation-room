/**
 * The site's addresses. Each desk lives under its own path on the one domain —
 * thesituationroom.live/yemen-conflict-desk now, others later — so:
 *
 * - `/` sends readers to the Yemen desk, for as long as it is the only one
 *   (a temporary redirect: `/` becomes the list of desks later).
 * - The old per-desk subdomain, yemen.thesituationroom.live, moves
 *   permanently to the path address, keeping whatever followed it.
 */

const HOME = "thesituationroom.live";

interface DeskAddressEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default function deskAddress(
  event: DeskAddressEvent,
  next: () => unknown | Promise<unknown>,
): unknown {
  const host = (event.req.headers.get("x-forwarded-host") ?? event.req.headers.get("host") ?? "").toLowerCase();
  const { pathname, search } = event.url;

  if (host === `yemen.${HOME}`) {
    const path = pathname === "/" || pathname === "/yemen" ? "/yemen-conflict-desk" : pathname;
    return Response.redirect(`https://${HOME}${path}${search}`, 301);
  }
  if (pathname === "/") {
    return new Response(null, { status: 302, headers: { location: `/yemen-conflict-desk${search}` } });
  }
  return next();
}
