/**
 * The site's addresses. Each desk lives under its own path on the one domain —
 * thesituationroom.live/yemen-conflict-desk now, others later — so:
 *
 * - `/` is the home page of every desk (17 Oct; it sent readers to the Yemen
 *   desk while that was the only one).
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
  // The old /yemen address with a page after it (/yemen/methodology).
  if (pathname.startsWith("/yemen/")) {
    return new Response(null, { status: 301, headers: { location: `/yemen-conflict-desk${pathname.slice(6)}${search}` } });
  }
  return next();
}
