import { useCallback, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { ApiError, setOwned, type CardSummary } from "../api/cards";
import { useAuth } from "../auth/AuthProvider";

/** Applies the shared optimistic ownership/wishlist overrides on top of fetched list items. */
export function useMergedCards(items: CardSummary[]): CardSummary[] {
  const { overrides } = useAuth();
  return useMemo(
    () => (Object.keys(overrides).length ? items.map((c) => (overrides[c.id] ? { ...c, ...overrides[c.id] } : c)) : items),
    [items, overrides],
  );
}

/** Quick ownership toggle for grid tiles: login gate, optimistic update with rollback, haptic feedback. */
export function useQuickOwn() {
  const { session, requireLogin, applyOverride } = useAuth();

  return useCallback(
    async (card: CardSummary) => {
      const next = !card.owned;
      if (!session) return requireLogin({ type: "own", cardId: card.id, value: next });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      applyOverride(card.id, { owned: next });
      try {
        await setOwned(card.id, next);
      } catch (e) {
        applyOverride(card.id, { owned: card.owned });
        if (e instanceof ApiError && e.code === "UNAUTHENTICATED") requireLogin({ type: "own", cardId: card.id, value: next });
      }
    },
    [session, requireLogin, applyOverride],
  );
}
