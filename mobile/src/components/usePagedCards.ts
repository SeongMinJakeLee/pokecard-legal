import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type CardSummary, type Page } from "../api/cards";

type Fetcher = (cursor: string | null) => Promise<Page<CardSummary>>;

/** Cursor-paginated list with refresh, load-more and error/retry. `deps` change => reload from the first page. */
export function usePagedCards(fetcher: Fetcher, deps: unknown[], enabled = true) {
  const [items, setItems] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const cursor = useRef<string | null>(null);
  const hasNext = useRef(true);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (reset: boolean) => {
    if (reset) {
      generation.current++;
      cursor.current = null;
      hasNext.current = true;
      inFlight.current = false;
    }
    if (inFlight.current || !hasNext.current) return;
    inFlight.current = true;
    const gen = generation.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcherRef.current(cursor.current);
      if (gen !== generation.current) return;
      cursor.current = res.page.nextCursor;
      hasNext.current = res.page.hasNext;
      setItems((prev) => (reset ? res.data : [...prev, ...res.data]));
    } catch (e) {
      if (gen !== generation.current) return;
      setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", String(e)));
    } finally {
      if (gen === generation.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      generation.current++;
      setItems([]);
      return;
    }
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return {
    items,
    loading,
    error,
    refresh: () => load(true),
    loadMore: () => load(false),
    patch: (id: string, change: Partial<CardSummary>) =>
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...change } : c))),
  };
}
