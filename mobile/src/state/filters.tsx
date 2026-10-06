import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CardQuery } from "../api/cards";

interface FilterState {
  query: CardQuery;
  setQuery: (q: CardQuery | ((prev: CardQuery) => CardQuery)) => void;
}

const Ctx = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState<CardQuery>({ sort: "releaseDate", owned: "all" });
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters(): FilterState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFilters must be used inside FilterProvider");
  return v;
}
