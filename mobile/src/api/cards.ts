import { supabase } from "../lib/supabase";

export type SortKey = "name" | "releaseDate" | "number" | "hp" | "rarity";
export type OwnedFilter = "all" | "owned" | "unowned";

export interface CardSummary {
  id: string;
  /** English (source) name. */
  name: string;
  /** Korean name when we have a confident translation, otherwise null (UI falls back to `name`). */
  nameKo?: string | null;
  number: string | null;
  rarity: string | null;
  imageSmall: string | null;
  set: { id: string; name: string };
  types: string[];
  owned?: boolean;
  wished?: boolean;
}

/** Primary + secondary label: Korean first when available, English kept as the secondary line. */
export function cardTitles(card: Pick<CardSummary, "name" | "nameKo">): { title: string; subtitle: string | null } {
  return card.nameKo && card.nameKo !== card.name
    ? { title: card.nameKo, subtitle: card.name }
    : { title: card.name, subtitle: null };
}

export interface CardDetail extends CardSummary {
  supertype: string | null;
  subtypes: string[];
  hp: number | null;
  artist: string | null;
  imageLarge: string | null;
  set: {
    id: string;
    name: string;
    series: string | null;
    printedTotal: number | null;
    total: number | null;
    releaseDate: string | null;
    logo: string | null;
    symbol: string | null;
  };
  details: {
    attacks: { name: string; cost: string[]; damage?: string; text?: string }[];
    abilities: { name: string; type?: string; text?: string }[];
    weaknesses: { type: string; value: string }[];
    resistances: { type: string; value: string }[];
    retreatCost: string[];
    flavorText: string | null;
    rules: string[];
  };
}

export interface SetInfo {
  id: string;
  name: string;
  series: string | null;
  releaseDate: string | null;
  total: number | null;
  logo: string | null;
  symbol: string | null;
}

export interface Filters {
  types: string[];
  rarities: string[];
  supertypes: string[];
}

export interface CardQuery {
  q?: string;
  setIds?: string[];
  types?: string[];
  rarities?: string[];
  owned?: OwnedFilter;
  sort?: SortKey;
  ord?: "asc" | "desc";
}

export interface Page<T> {
  data: T[];
  page: { limit: number; nextCursor: string | null; hasNext: boolean };
}

export class ApiError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "NOT_FOUND" | "VALIDATION_FAILED" | "NETWORK" | "UNKNOWN", message: string) {
    super(message);
  }
}

function toApiError(err: { code?: string; message?: string }): ApiError {
  switch (err.code) {
    case "PT401":
      return new ApiError("UNAUTHENTICATED", err.message ?? "");
    case "PT404":
      return new ApiError("NOT_FOUND", err.message ?? "");
    case "PT400":
    case "PT422":
      return new ApiError("VALIDATION_FAILED", err.message ?? "");
  }
  if (/network|fetch|timeout/i.test(err.message ?? "")) return new ApiError("NETWORK", err.message ?? "");
  return new ApiError("UNKNOWN", err.message ?? "");
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw toApiError(error);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("NETWORK", String(e));
  }
}

export function listCards(query: CardQuery, cursor: string | null, limit = 30): Promise<Page<CardSummary>> {
  return rpc("list_cards", {
    q: query.q?.trim() ? query.q.trim().slice(0, 50) : null,
    set_ids: query.setIds?.length ? query.setIds : null,
    types: query.types?.length ? query.types : null,
    rarities: query.rarities?.length ? query.rarities : null,
    owned: query.owned ?? "all",
    sort: query.sort ?? "releaseDate",
    ord: query.ord ?? null,
    lim: limit,
    page_cursor: cursor,
  });
}

export const getCard = (id: string) => rpc<CardDetail>("get_card", { card_id: id });
export const listSets = () => rpc<SetInfo[]>("list_sets");
export const getFilters = () => rpc<Filters>("get_filters");
export interface CollectionSummary {
  totalOwned: number;
  totalCards: number;
  sets: { id: string; name: string; series: string | null; releaseDate: string | null; logo: string | null; symbol: string | null; owned: number; total: number }[];
}
export const getCollectionSummary = () => rpc<CollectionSummary>("get_collection_summary");

export const listWishlist = (cursor: string | null, limit = 30) =>
  rpc<Page<CardSummary>>("list_wishlist", { lim: limit, page_cursor: cursor });

async function setMembership(table: "user_cards" | "wishlist_items", cardId: string, on: boolean) {
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id;
  if (!userId) throw new ApiError("UNAUTHENTICATED", "login required");
  const { error } = on
    ? await supabase
        .from(table)
        .upsert({ user_id: userId, card_id: cardId }, { onConflict: "user_id,card_id", ignoreDuplicates: true })
    : await supabase.from(table).delete().eq("user_id", userId).eq("card_id", cardId);
  if (error) throw toApiError(error);
}

export const setOwned = (cardId: string, on: boolean) => setMembership("user_cards", cardId, on);
export const setWished = (cardId: string, on: boolean) => setMembership("wishlist_items", cardId, on);
