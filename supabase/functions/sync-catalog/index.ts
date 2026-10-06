// sync-catalog: operator-only catalog loader (docs/03 §8, ADR-01/03/07).
// Source adapter: PokemonTCG/pokemon-tcg-data JSON dump on GitHub (free, no key).
// Not callable by app users: requires header `x-sync-token` matching a hash in public.admin_secrets.
// Chunked per set to stay within Edge Function CPU/time limits.
import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

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

// deno-lint-ignore no-explicit-any
type Any = any;

const toDate = (s?: string) => (s ? s.replaceAll("/", "-") : null);
const toTs = (s?: string) => (s ? s.replace(/\//g, "-").replace(" ", "T") + "Z" : null);
const toInt = (s: unknown): number | null => {
  if (s === undefined || s === null) return null;
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : null;
};

async function fetchJson(url: string): Promise<Any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.status === 404) throw new Error(`not found: ${url}`);
      if (!res.ok) throw new Error(`source ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function mapSet(s: Any) {
  return {
    id: s.id,
    name: s.name,
    series: s.series ?? null,
    printed_total: s.printedTotal ?? null,
    total: s.total ?? null,
    release_date: toDate(s.releaseDate),
    ptcgo_code: s.ptcgoCode ?? null,
    symbol_url: s.images?.symbol ?? null,
    logo_url: s.images?.logo ?? null,
    language: "en",
    source_updated_at: toTs(s.updatedAt),
    synced_at: new Date().toISOString(),
    is_active: true,
  };
}

function mapCard(c: Any, setId: string) {
  const num: string | null = c.number ?? null;
  const m = num ? num.match(/\d+/) : null;
  return {
    id: c.id,
    set_id: setId,
    name: c.name,
    supertype: c.supertype ?? null,
    hp_value: toInt(c.hp),
    number: num,
    number_sort: m ? parseInt(m[0], 10) : null,
    rarity: c.rarity ?? null,
    artist: c.artist ?? null,
    image_small_url: c.images?.small ?? null,
    image_large_url: c.images?.large ?? null,
    subtypes: c.subtypes ?? [],
    national_dex_numbers: c.nationalPokedexNumbers ?? [],
    details: {
      hp: c.hp ?? null,
      level: c.level ?? null,
      evolvesFrom: c.evolvesFrom ?? null,
      evolvesTo: c.evolvesTo ?? null,
      abilities: c.abilities ?? [],
      attacks: c.attacks ?? [],
      weaknesses: c.weaknesses ?? [],
      resistances: c.resistances ?? [],
      retreatCost: c.retreatCost ?? [],
      convertedRetreatCost: c.convertedRetreatCost ?? null,
      rules: c.rules ?? [],
      flavorText: c.flavorText ?? null,
      regulationMark: c.regulationMark ?? null,
      legalities: c.legalities ?? {},
      ancientTrait: c.ancientTrait ?? null,
    },
    language: "en",
    is_active: true,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const token = req.headers.get("x-sync-token") ?? "";
  const { data: secret } = await sb.from("admin_secrets").select("secret_hash").eq("name", "sync")
    .maybeSingle();
  if (!token || !secret || !timingSafeEqual(secret.secret_hash, await sha256Hex(token))) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  let body: Any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "BAD_REQUEST" }, 400);
  }

  const action = body?.action;
  const { data: job } = await sb.from("sync_jobs").insert({
    job_type: action === "sets" ? "sets" : "cards",
    status: "running",
  }).select("id").single();

  const finish = async (status: string, processed: number, failed: number, err?: string) => {
    if (job) {
      await sb.from("sync_jobs").update({
        status,
        finished_at: new Date().toISOString(),
        items_processed: processed,
        items_failed: failed,
        error_message: err ? err.slice(0, 500) : null,
      }).eq("id", job.id);
    }
  };

  try {
    if (action === "sets") {
      const sets: Any[] = await fetchJson(`${SOURCE}/sets/en.json`);
      const rows = sets.map(mapSet);
      const { error } = await sb.from("card_sets").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      await finish("success", rows.length, 0);
      return json({
        action,
        sets: rows.length,
        setIds: rows.map((r) => ({ id: r.id, total: r.total })),
      });
    }

    if (action === "cards") {
      const setId = String(body?.setId ?? "");
      if (!/^[A-Za-z0-9_-]+$/.test(setId)) {
        await finish("failed", 0, 0, "invalid setId");
        return json({ error: "VALIDATION_FAILED" }, 422);
      }
      const { data: setRow } = await sb.from("card_sets").select("id").eq("id", setId).maybeSingle();
      if (!setRow) {
        await finish("failed", 0, 0, "unknown set");
        return json({ error: "UNKNOWN_SET" }, 404);
      }

      const cards: Any[] = await fetchJson(`${SOURCE}/cards/en/${setId}.json`);
      const rows = cards.map((c) => mapCard(c, setId));
      const ids = rows.map((r) => r.id);

      const { error: e1 } = await sb.from("cards").upsert(rows, { onConflict: "id" });
      if (e1) throw new Error(e1.message);

      // card_types: replace per card (idempotent)
      const { error: e2 } = await sb.from("card_types").delete().in("card_id", ids);
      if (e2) throw new Error(e2.message);
      const typeRows: { card_id: string; type_name: string }[] = [];
      for (const c of cards) {
        for (const t of new Set<string>(c.types ?? [])) typeRows.push({ card_id: c.id, type_name: t });
      }
      if (typeRows.length) {
        const { error: e3 } = await sb.from("card_types").insert(typeRows);
        if (e3) throw new Error(e3.message);
      }

      // deactivate cards of this set that vanished from the source
      const { data: existing } = await sb.from("cards").select("id").eq("set_id", setId).eq(
        "is_active",
        true,
      );
      const keep = new Set(ids);
      const stale = (existing ?? []).map((r: Any) => r.id).filter((id: string) => !keep.has(id));
      if (stale.length) await sb.from("cards").update({ is_active: false }).in("id", stale);

      await finish("success", rows.length, 0);
      return json({ action, setId, cards: rows.length, types: typeRows.length, deactivated: stale.length });
    }

    await finish("failed", 0, 0, "unknown action");
    return json({ error: "BAD_REQUEST", detail: "action must be sets or cards" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finish("failed", 0, 1, msg);
    return json({ error: "SYNC_FAILED", detail: msg }, 502);
  }
});
