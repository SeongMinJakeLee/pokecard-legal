import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { listCards, type OwnedFilter, type SortKey } from "../../src/api/cards";
import { useAuth } from "../../src/auth/AuthProvider";
import { useFilters } from "../../src/state/filters";
import { usePagedCards } from "../../src/components/usePagedCards";
import { useMergedCards, useQuickOwn } from "../../src/components/useQuickOwn";
import { CardGrid } from "../../src/components/CardGrid";
import { Chip, Field, Icon } from "../../src/components/ui";
import { t } from "../../src/i18n/ko";
import { useTheme } from "../../src/theme";

const SORTS: SortKey[] = ["releaseDate", "name", "number", "hp", "rarity"];
const OWNED: OwnedFilter[] = ["all", "owned", "unowned"];

export default function CardsScreen() {
  const { c } = useTheme();
  const { session, dataVersion, requireLogin } = useAuth();
  const { query, setQuery } = useFilters();
  const [text, setText] = useState(query.q ?? "");
  const loggedIn = !!session;

  // Debounce search input (350ms) to avoid a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery((q) => (q.q === text ? q : { ...q, q: text })), 350);
    return () => clearTimeout(id);
  }, [text, setQuery]);

  // Keep the search box in sync when filters are changed elsewhere (e.g. from My Collection).
  useEffect(() => {
    if ((query.q ?? "") !== text && query.q === undefined) setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.q]);

  // Guests cannot use the owned filter; fall back to "all" when logging out.
  useEffect(() => {
    if (!loggedIn && query.owned && query.owned !== "all") setQuery((q) => ({ ...q, owned: "all" }));
  }, [loggedIn, query.owned, setQuery]);

  const { items, loading, error, refresh, loadMore } = usePagedCards(
    (cursor) => listCards(query, cursor),
    [JSON.stringify(query), dataVersion],
  );
  const merged = useMergedCards(items);
  const quickOwn = useQuickOwn();

  const activeFilters = (query.setIds?.length ?? 0) + (query.types?.length ?? 0) + (query.rarities?.length ?? 0);
  const sortOn = query.sort ?? "releaseDate";

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>{t.appName}</Text>
        <Field
          icon="search"
          value={text}
          onChangeText={setText}
          placeholder={t.list.searchPlaceholder}
          autoCorrect={false}
          maxLength={50}
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <Chip label={t.list.filter} icon="options-outline" badge={activeFilters} on={activeFilters > 0} onPress={() => router.push("/filters")} />
          {OWNED.map((o) => (
            <Chip
              key={o}
              label={t.list[o]}
              on={(query.owned ?? "all") === o}
              onPress={() => {
                if (o !== "all" && !loggedIn) return requireLogin();
                setQuery((q) => ({ ...q, owned: o }));
              }}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <View style={styles.sortLabel}>
            <Icon name="swap-vertical" size={16} color={c.textMuted} />
          </View>
          {SORTS.map((s) => {
            const on = sortOn === s;
            const dir = query.ord ? (query.ord === "asc" ? " ↑" : " ↓") : "";
            return (
              <Chip
                key={s}
                label={`${t.list.sort[s]}${on ? dir : ""}`}
                on={on}
                onPress={() =>
                  setQuery((q) =>
                    on
                      ? { ...q, ord: q.ord === "asc" ? "desc" : q.ord === "desc" ? "asc" : "asc" }
                      : { ...q, sort: s, ord: undefined },
                  )
                }
              />
            );
          })}
        </ScrollView>
      </View>
      <View style={{ flex: 1 }}>
        <CardGrid
          items={merged}
          loading={loading}
          error={error}
          emptyText={t.list.empty}
          showStatus={loggedIn}
          dimUnowned={loggedIn}
          onRefresh={refresh}
          onEndReached={loadMore}
          onToggleOwned={quickOwn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 14, paddingTop: 8, gap: 10 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 },
  sortLabel: { paddingRight: 2 },
});
