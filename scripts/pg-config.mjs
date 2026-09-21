// @ts-check
/**
 * node-postgres pool options for DATABASE_URL, shared by every pool the app
 * opens (app data, auth, the deploy-time migrator).
 *
 * Supabase serves TLS from its own root CA, which Node does not trust, so a
 * verifying connection fails with "self-signed certificate in certificate
 * chain". Encrypt, but do not verify the chain. `sslmode` is dropped from the
 * URL because pg lets the URL's value override the `ssl` object.
 *
 * @param {string} databaseUrl
 * @param {{ max?: number }} [extra]
 * @returns {{ connectionString: string, ssl?: { rejectUnauthorized: boolean }, max?: number }}
 */
export function pgPoolConfig(databaseUrl, extra = {}) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { connectionString: databaseUrl, ...extra };
  }
  const host = url.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (local || url.searchParams.get("sslmode") === "disable") {
    return { connectionString: databaseUrl, ...extra };
  }
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false }, ...extra };
}
