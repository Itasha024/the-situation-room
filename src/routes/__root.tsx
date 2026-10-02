import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Yemen Conflict Desk";
const ASSET_V = "desk-en-108";
// The reader's language before anything is drawn: ?lang= or the one they chose. Hebrew and
// Arabic load their labels (public/i18n) ahead of app.js, read right to left, and add their fonts.
const LANG_FONTS: Record<string, string> = {
  he: "https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Heebo:wght@400;500;600;700&display=swap",
  ar: "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap",
};
const LANG_BOOT = `try{var q=/[?&]lang=(en|he|ar)\\b/.exec(location.search),g=q?q[1]:localStorage.getItem("desk-lang");if(q)localStorage.setItem("desk-lang",g);var F=${JSON.stringify(LANG_FONTS)};if(F[g]){var h=document.documentElement;h.lang=g;h.dir="rtl";var k=document.createElement("link");k.rel="stylesheet";k.href=F[g];document.head.appendChild(k);document.write('<script src="/i18n/'+g+'.js?v=${ASSET_V}"><\\/script><script src="/i18n/dom.js?v=${ASSET_V}"><\\/script>')}}catch(e){}`;
// The reader's theme on <html> before first paint â€” Night unless they chose Day â€” and the
// broadsheet pair's two fonts.
const THEME_BOOT = `try{var t=localStorage.getItem("desk-theme");if(t!=="broadsheet-day")t="broadsheet-night";{var d=document.documentElement;d.dataset.theme=t;d.dataset.set="broadsheet";var l=document.createElement("link");l.id="desk-fonts";l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap";document.head.appendChild(l)}}catch(e){}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#070b10" },
      {
        name: "description",
        content:
          "Live open-source reporting on the war in Yemen: who holds what, the fronts, strikes on Saudi Arabia, the Red Sea and the numbers, from every side's sources.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=sr1" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: "/vendor/leaflet/leaflet.css" },
      { rel: "stylesheet", href: `/desk.css?v=${ASSET_V}` },
      { rel: "stylesheet", href: `/themes.css?v=${ASSET_V}` },
      { rel: "stylesheet", href: `/rtl.css?v=${ASSET_V}` },
      { rel: "preload", href: "/vendor/leaflet/leaflet.js", as: "script" },
      { rel: "preload", href: `/app.js?v=${ASSET_V}`, as: "script" },
      { rel: "preload", href: `/data.json?v=${ASSET_V}`, as: "fetch", crossOrigin: "anonymous" },
      { rel: "preload", href: "/gazetteer.json", as: "fetch", crossOrigin: "anonymous" },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=sr1" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT }} />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <script id="leaflet-js" src="/vendor/leaflet/leaflet.js" />
        <script id="yemen-app-js" src={`/app.js?v=${ASSET_V}`} />
        <Scripts />
      </body>
    </html>
  );
}
