import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { listCards, type OwnedFilter, type SortKey } from "../../src/api/cards";
import { useAuth } from "../../src/auth/AuthProvider";
import { useFilters } from "../../src/state/filters";
import { usePagedCards } from "../../src/components/usePagedCards";
import { CardGrid } from "../../src/components/CardGrid";
import { t } from "../../src/i18n/ko";

const SORTS: SortKey[] = ["releaseDate", "name", "number", "hp", "rarity"];
const OWNED: OwnedFilter[] = ["all", "owned", "unowned"];

export default function CardsScreen() {
  const { session, dataVersion, requireLogin } = useAuth();
  const { query, setQuery } = useFilters();
  const [text, setText] = useState(query.q ?? "");
  const loggedIn = !!session;

  // Debounce search input (300-400ms) to avoid a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery((q) => (q.q === text ? q : { ...q, q: text })), 350);
    return () => clearTimeout(id);
  }, [text, setQuery]);

  // Guests cannot use the owned filter; fall back to "all" when logging out.
  useEffect(() => {
    if (!loggedIn && query.owned && query.owned !== "all") setQuery((q) => ({ ...q, owned: "all" }));
  }, [loggedIn, query.owned, setQuery]);

  const { items, loading, error, refresh, loadMore } = usePagedCards(
    (cursor) => listCards(query, cursor),
    [JSON.stringify(query), dataVersion],
  );

  const activeFilters = (query.setIds?.length ?? 0) + (query.types?.length ?? 0) + (query.rarities?.length ?? 0);

  const header = (
    <View style={styles.header}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t.list.searchPlaceholder}
        style={styles.search}
        autoCorrect={false}
        maxLength={50}
        returnKeyType="search"
      />
      <View style={styles.row}>
        <Pressable style={[styles.chip, activeFilters > 0 && styles.chipOn]} onPress={() => router.push("/filters")}>
          <Text style={[styles.chipText, activeFilters > 0 && styles.chipTextOn]}>
            {t.list.filter}
            {activeFilters > 0 ? ` ${activeFilters}` : ""}
          </Text>
        </Pressable>
        {OWNED.map((o) => (
          <Pressable
            key={o}
            style={[styles.chip, (query.owned ?? "all") === o && styles.chipOn]}
            onPress={() => {
              if (o !== "all" && !loggedIn) return requireLogin();
              setQuery((q) => ({ ...q, owned: o }));
            }}
          >
            <Text style={[styles.chipText, (query.owned ?? "all") === o && styles.chipTextOn]}>{t.list[o]}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {SORTS.map((s) => {
          const on = (query.sort ?? "releaseDate") === s;
          return (
            <Pressable
              key={s}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() =>
                setQuery((q) =>
                  on ? { ...q, ord: q.ord === "asc" ? "desc" : q.ord === "desc" ? "asc" : undefined } : { ...q, sort: s, ord: undefined },
                )
              }
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t.list.sort[s]}
                {on && query.ord ? (query.ord === "asc" ? " ↑" : " ↓") : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <CardGrid
        items={items}
        loading={loading}
        error={error}
        emptyText={t.list.empty}
        showStatus={loggedIn}
        dimUnowned={loggedIn}
        onRefresh={refresh}
        onEndReached={loadMore}
        header={header}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  header: { gap: 8, marginBottom: 12 },
  search: { borderWidth: 1, borderColor: "#d4d4d8", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  row: { flexDirection: "row", gap: 8, flexWrap: "nowrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#f1f1f4" },
  chipOn: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#333" },
  chipTextOn: { color: "#fff", fontWeight: "600" },
});
