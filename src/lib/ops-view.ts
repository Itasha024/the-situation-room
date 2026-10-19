/**
 * The map-first view (user, 19 Oct: "design B" with the current design, for operations rooms and
 * newsrooms alike). It is a layer over the same pages, public/ops.css and public/ops.js, switched on
 * by data-view="ops" on <html>; without it every page is exactly the classic site.
 *
 * - "default": every reader gets the new view; "Classic view" in its bar (or ?view=classic) keeps
 *   the classic one for that reader.
 * - "optional": every reader gets the classic site; ?view=ops opens the new view.
 * - "off": the classic site only, as before the new view; nothing of it is loaded.
 */
export const OPS_VIEW: "default" | "optional" | "off" = "default";

/** On <html> before first paint: the reader's choice (?view= or the one kept), else the site's default. */
export const VIEW_BOOT = `try{var q=/[?&]view=(ops|classic)\\b/.exec(location.search),v=q?q[1]:localStorage.getItem("desk-view");if(q)localStorage.setItem("desk-view",v);if(v!=="ops"&&v!=="classic")v=${JSON.stringify(OPS_VIEW === "default" ? "ops" : "classic")};document.documentElement.dataset.view=v;if(v==="ops"){var l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap";document.head.appendChild(l)}}catch(e){}`;
