/** Fill PortWatch's ship traffic into the live store now (else it waits for the next 6-hour build). LIVE DATABASE WRITE. */
import { refreshTransits } from "../src/lib/desk/ledger.ts";
import { getStore } from "../src/lib/desk/store.ts";

const t = await refreshTransits(await getStore(), new Date());
for (const p of t?.points ?? []) console.log(p.name, p.baseline.total, "a day before; last", JSON.stringify(p.days.at(-1)));
process.exit(0);
