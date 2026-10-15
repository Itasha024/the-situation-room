import { WAR_DESKS, focusById, type Focus } from "@/lib/region";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** A place's flag (a sea draws waves; the whole region a globe). */
export function flag(id: string): string {
  if (id === "region")
    return '<svg class="md-flag" viewBox="0 0 20 13"><rect width="20" height="13" fill="#282421"/><circle cx="10" cy="6.5" r="4.5" fill="none" stroke="#f4a58a" stroke-width="1.3"/><path d="M5.5 6.5h9M10 2v9" stroke="#f4a58a" stroke-width=".9"/></svg>';
  const f = focusById(id);
  if (f?.kind === "sea")
    return '<svg class="md-flag" viewBox="0 0 20 13"><rect width="20" height="13" fill="#20425e"/><path d="M0 5q2.5-2 5 0t5 0 5 0 5 0M0 9q2.5-2 5 0t5 0 5 0 5 0" stroke="#5fa8dc" fill="none" stroke-width="1.3"/></svg>';
  const c = f?.flag?.length ? f.flag : ["#766b62"];
  const n = c.length;
  return `<svg class="md-flag" viewBox="0 0 20 13">${c.map((x, i) => `<rect y="${(i * 13) / n}" width="20" height="${13 / n + 0.1}" fill="${x}"/>`).join("")}${id === "lebanon" ? '<path d="M10 3.6l2 3.4h-4z" fill="#00a651"/>' : ""}</svg>`;
}

/**
 * The head of a country or sea page: its name, one line on it, its clock and
 * its desks. Written by the server (so a search engine reads it) and again by
 * the page when the reader moves to another place.
 */
export function placeHeadHtml(f: Focus): string {
  const kind = f.kind === "sea" ? "Sea" : f.kind === "actor" ? "Power in the region" : "Country";
  const desks = f.desks
    .map((id) => WAR_DESKS.find((d) => d.id === id))
    .filter((d) => d && !d.planned)
    .map((d) => `<a class="md-pill" href="${d!.path}">${esc(d!.name)} →</a>`)
    .join("");
  return `<div class="md-phead">
    <div class="md-ph1">${flag(f.id)}<h1>${esc(f.name)}</h1><span class="md-pkind">${kind}</span></div>
    <p class="md-pctx">${esc(f.context)}</p>
    <div class="md-plinks">${f.clock ? `<span class="md-pclock">${esc(f.clock)} <b id="md-pclock"></b></span>` : ""}${desks}<a class="md-pill" href="/" data-focus="region">Whole region</a></div>
  </div><div class="md-figs" id="md-figs"></div>`;
}
