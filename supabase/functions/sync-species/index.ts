// sync-species: operator-only loader for Pokémon species names (English + Korean) from the PokeAPI CSV dump.
// Same auth as sync-catalog (x-sync-token checked against public.admin_secrets). After loading, it re-derives
// cards.name_ko by touching card names (the BEFORE UPDATE trigger recomputes the Korean name).
import { createClient } from "npm:@supabase/supabase-js@2";

const CSV =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv";
const LANG_EN = 9;
const LANG_KO = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// minimal CSV line parser (handles quoted fields)
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const token = req.headers.get("x-sync-token") ?? "";
  const { data: secret } = await sb.from("admin_secrets").select("secret_hash").eq("name", "sync").maybeSingle();
  if (!token || !secret || !timingSafeEqual(secret.secret_hash, await sha256Hex(token))) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  try {
    const res = await fetch(CSV, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`source ${res.status}`);
    const lines = (await res.text()).split(/\r?\n/).slice(1).filter(Boolean);

    const en = new Map<number, string>();
    const ko = new Map<number, string>();
    for (const line of lines) {
      const [id, lang, name] = parseLine(line);
      const dex = parseInt(id, 10);
      const l = parseInt(lang, 10);
      if (l === LANG_EN) en.set(dex, name);
      else if (l === LANG_KO) ko.set(dex, name);
    }

    const rows = [...en.entries()].map(([dex, name_en]) => ({ dex, name_en, name_ko: ko.get(dex) ?? null }));
    const { error } = await sb.from("pokemon_species").upsert(rows, { onConflict: "dex" });
    if (error) throw new Error(error.message);

    // Recompute Korean names (trigger fires on name update). Done through RPC to keep it one statement.
    const { data: touched, error: e2 } = await sb.rpc("recompute_card_names_ko");
    if (e2) throw new Error(e2.message);

    return json({ species: rows.length, withKorean: rows.filter((r) => r.name_ko).length, cardsRecomputed: touched });
  } catch (e) {
    return json({ error: "SYNC_FAILED", detail: e instanceof Error ? e.message : String(e) }, 502);
  }
});
