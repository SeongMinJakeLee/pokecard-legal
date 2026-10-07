import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { ApiError, getCollectionSummary, listSets, type SetInfo } from "../../src/api/cards";
import { useAuth } from "../../src/auth/AuthProvider";
import { useFilters } from "../../src/state/filters";
import { Button, Card, Field, ProgressBar, Skeleton } from "../../src/components/ui";
import { t } from "../../src/i18n/ko";
import { radius, useTheme } from "../../src/theme";

const GAP = 10;
const PAD = 14;

interface Section {
  title: string;
  data: SetInfo[][]; // a single grid item per series (SectionList renders one row = whole grid)
}

export default function SetsScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { session, dataVersion } = useAuth();
  const { setQuery } = useFilters();
  const [sets, setSets] = useState<SetInfo[] | null>(null);
  const [progress, setProgress] = useState<Record<string, { owned: number; total: number }>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [q, setQ] = useState("");
  const loggedIn = !!session;
  const tileW = Math.floor((width - PAD * 2 - GAP) / 2);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSets(await listSets());
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", String(e)));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Per-set progress is refreshed whenever the tab is focused (ownership may have changed elsewhere).
  useFocusEffect(
    useCallback(() => {
      if (!loggedIn) {
        setProgress({});
        return;
      }
      getCollectionSummary()
        .then((s) => setProgress(Object.fromEntries(s.sets.map((x) => [x.id, { owned: x.owned, total: x.total }]))))
        .catch(() => {});
    }, [loggedIn, dataVersion]),
  );

  const sections = useMemo<Section[]>(() => {
    if (!sets) return [];
    const needle = q.trim().toLowerCase();
    const list = needle
      ? sets.filter((s) => s.name.toLowerCase().includes(needle) || (s.series ?? "").toLowerCase().includes(needle))
      : sets;
    const bySeries = new Map<string, SetInfo[]>();
    for (const s of list) {
      const key = s.series ?? "-";
      if (!bySeries.has(key)) bySeries.set(key, []);
      bySeries.get(key)!.push(s);
    }
    return [...bySeries.entries()].map(([title, data]) => ({ title, data: [data] }));
  }, [sets, q]);

  const openSet = (id: string) => {
    setQuery({ sort: "number", owned: "all", setIds: [id] });
    router.navigate("/");
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={["top"]}>
      <Text style={[styles.title, { color: c.text }]}>{t.sets.title}</Text>
      <View style={{ paddingHorizontal: PAD, paddingVertical: 8 }}>
        <Field icon="search" value={q} onChangeText={setQ} placeholder={t.sets.search} autoCapitalize="none" returnKeyType="search" />
      </View>
      {!sets && !error ? (
        <View style={{ padding: PAD, flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} style={{ width: tileW, height: 118 }} />
          ))}
        </View>
      ) : error && !sets ? (
        <View style={styles.center}>
          <Text style={{ color: c.textMuted }}>{error.code === "NETWORK" ? t.common.offline : t.common.error}</Text>
          <Button label={t.common.retry} onPress={load} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(_, i) => String(i)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 24 }}
          ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: "center", marginTop: 40 }}>{t.sets.empty}</Text>}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.series, { color: c.textMuted }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
              {item.map((s) => {
                const pr = progress[s.id];
                const p = pr && pr.total > 0 ? pr.owned / pr.total : 0;
                return (
                  <Pressable key={s.id} onPress={() => openSet(s.id)} style={{ width: tileW }}>
                    <Card style={{ gap: 8, padding: 10 }}>
                      <View style={[styles.logoBox, { backgroundColor: c.surfaceAlt }]}>
                        {s.logo ? (
                          <Image source={{ uri: s.logo }} style={{ width: "86%", height: "80%" }} contentFit="contain" cachePolicy="memory-disk" />
                        ) : (
                          <ActivityIndicator color={c.textMuted} />
                        )}
                      </View>
                      <Text numberOfLines={1} style={{ color: c.text, fontWeight: "700", fontSize: 13 }}>
                        {s.name}
                      </Text>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: c.textMuted, fontSize: 11 }}>{s.releaseDate?.slice(0, 7).replace("/", ".") ?? ""}</Text>
                        <Text style={{ color: c.textMuted, fontSize: 11 }}>{t.sets.cards(s.total ?? 0)}</Text>
                      </View>
                      {loggedIn && pr ? (
                        <View style={{ gap: 3 }}>
                          <ProgressBar value={p} color={p >= 1 ? "#F5B301" : c.owned} />
                          <Text style={{ color: c.textMuted, fontSize: 10.5 }}>
                            {pr.owned} / {pr.total}
                          </Text>
                        </View>
                      ) : null}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, paddingHorizontal: PAD, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  series: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
  logoBox: { height: 58, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
});
