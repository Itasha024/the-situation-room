/** A fingerprint of public/, set by vite.config.ts at build; none in dev and tests. */
declare const __ASSET_HASH__: string | undefined;

/**
 * The release's asset version. The build adds a fingerprint of public/, so a changed app.js,
 * style or data.json always gets a new address, and browsers keep each one (routeRules in vite.config.ts).
 */
export const ASSET_V = `desk-en-220${typeof __ASSET_HASH__ === "string" ? `.${__ASSET_HASH__}` : ""}`;
