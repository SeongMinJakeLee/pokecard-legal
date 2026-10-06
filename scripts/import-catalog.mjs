// Operator script: load the full English catalog into Supabase via the sync-catalog Edge Function.
// Usage: node scripts/import-catalog.mjs [--only setId,setId] [--concurrency 3]
// Reads SUPABASE_URL and SYNC_TOKEN from .env.local (never committed).
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
if (!env.SUPABASE_URL || !env.SYNC_TOKEN) throw new Error("SUPABASE_URL / SYNC_TOKEN missing in .env.local");

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = arg("--only")?.split(",");
const concurrency = Number(arg("--concurrency") ?? 3);

const endpoint = `${env.SUPABASE_URL}/functions/v1/sync-catalog`;

async function call(body, attempt = 1) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-token": env.SYNC_TOKEN },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    if (attempt < 3 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return call(body, attempt + 1);
    }
    throw new Error(`${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

const started = Date.now();
const setsRes = await call({ action: "sets" });
console.log(`sets upserted: ${setsRes.sets}`);

let targets = setsRes.setIds.map((s) => s.id);
if (only) targets = targets.filter((id) => only.includes(id));

const failures = [];
let done = 0;
let totalCards = 0;
const queue = [...targets];

async function worker() {
  while (queue.length) {
    const setId = queue.shift();
    try {
      const r = await call({ action: "cards", setId });
      totalCards += r.cards;
      done++;
      if (done % 10 === 0 || done === targets.length) {
        console.log(`  ${done}/${targets.length} sets, ${totalCards} cards`);
      }
    } catch (e) {
      failures.push({ setId, error: String(e).slice(0, 300) });
      console.error(`  FAILED ${setId}: ${String(e).slice(0, 200)}`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s: ${done} sets, ${totalCards} cards, ${failures.length} failures`);
if (failures.length) {
  console.log("failed sets:", failures.map((f) => f.setId).join(", "));
  console.log("re-run with: node scripts/import-catalog.mjs --only " + failures.map((f) => f.setId).join(","));
  process.exit(1);
}
