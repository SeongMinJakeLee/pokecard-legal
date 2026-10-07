import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { ApiError, getCollectionSummary, type CollectionSummary } from "../../src/api/cards";
import { useAuth } from "../../src/auth/AuthProvider";
import { useFilters } from "../../src/state/filters";
import { Button, Card, Icon, ProgressBar, ProgressRing, Skeleton } from "../../src/components/ui";
import { t } from "../../src/i18n/ko";
import { radius, useTheme } from "../../src/theme";

export default function CollectionScreen() {
  const { c } = useTheme();
  const { session, dataVersion, requireLogin } = useAuth();
  const { setQuery } = useFilters();
  const [data, setData] = useState<CollectionSummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const loggedIn = !!session;

  const load = useCallback(async () => {
    if (!loggedIn) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getCollectionSummary());
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", String(e)));
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  // Refresh whenever the tab is focused: ownership may have changed elsewhere.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, dataVersion]),
  );

  useEffect(() => {
    if (!loggedIn) setData(null);
  }, [loggedIn]);

  const openSet = (setId: string) => {
    setQuery({ sort: "number", owned: "owned", setIds: [setId] });
    router.navigate("/");
  };

  if (!loggedIn) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={["top"]}>
        <Text style={[styles.title, { color: c.text }]}>{t.collection.title}</Text>
        <View style={styles.center}>
          <Icon name="checkmark-circle-outline" size={44} color={c.textMuted} />
          <Text style={{ color: c.textMuted }}>{t.collection.loginNeeded}</Text>
          <Button label={t.auth.login} onPress={() => requireLogin()} />
        </View>
      </SafeAreaView>
    );
  }

  const percent = data && data.totalCards > 0 ? data.totalOwned / data.totalCards : 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={["top"]}>
      <Text style={[styles.title, { color: c.text }]}>{t.collection.title}</Text>
      {!data && loading ? (
        <View style={{ padding: 14, gap: 12 }}>
          <Skeleton style={{ height: 110 }} />
          <Skeleton style={{ height: 70 }} />
          <Skeleton style={{ height: 70 }} />
        </View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Text style={{ color: c.textMuted }}>{error.code === "NETWORK" ? t.common.offline : t.common.error}</Text>
          <Button label={t.common.retry} onPress={load} />
        </View>
      ) : (
        <FlatList
          data={data?.sets ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          onRefresh={load}
          refreshing={loading && !!data}
          ListHeaderComponent={
            <Card style={{ marginBottom: 6, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                <ProgressRing value={percent} size={112} thickness={11}>
                  <Text style={{ color: c.text, fontSize: 24, fontWeight: "800" }}>{percent > 0 && percent < 0.001 ? "<0.1" : (percent * 100).toFixed(percent < 0.1 ? 1 : 0)}%</Text>
                </ProgressRing>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: c.textMuted, fontSize: 13 }}>{t.collection.owned}</Text>
                  <Text style={{ color: c.text, fontSize: 34, fontWeight: "800" }}>{(data?.totalOwned ?? 0).toLocaleString()}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {t.collection.ofAll} {(data?.totalCards ?? 0).toLocaleString()}
                  </Text>
                  {data ? (
                    <Text style={{ color: c.textMuted, fontSize: 12 }}>
                      {t.collection.completedSets(data.sets.filter((s) => s.total > 0 && s.owned >= s.total).length)}
                    </Text>
                  ) : null}
                </View>
              </View>
              {data && data.sets.length > 0 ? <Text style={[styles.section, { color: c.text }]}>{t.collection.sets}</Text> : null}
            </Card>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <View style={styles.center}>
                <Icon name="albums-outline" size={40} color={c.textMuted} />
                <Text style={{ color: c.text, fontWeight: "700" }}>{t.collection.empty}</Text>
                <Text style={{ color: c.textMuted, textAlign: "center" }}>{t.collection.emptyHint}</Text>
                <Button label={t.collection.viewCards} onPress={() => router.navigate("/")} />
              </View>
            )
          }
          renderItem={({ item }) => {
            const p = item.total > 0 ? item.owned / item.total : 0;
            return (
              <Pressable onPress={() => openSet(item.id)}>
                <Card style={styles.setRow}>
                  <View style={[styles.logoBox, { backgroundColor: c.surfaceAlt }]}>
                    <Image source={item.logo ? { uri: item.logo } : undefined} style={{ width: 64, height: 40 }} contentFit="contain" cachePolicy="memory-disk" />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text numberOfLines={1} style={{ color: c.text, fontWeight: "700" }}>
                      {item.name}
                    </Text>
                    <ProgressBar value={p} color={p >= 1 ? "#F5B301" : c.owned} />
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: c.text, fontWeight: "800" }}>
                      {item.owned}
                      <Text style={{ color: c.textMuted, fontWeight: "500" }}> / {item.total}</Text>
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 11 }}>{Math.round(p * 100)}%</Text>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, paddingHorizontal: 14, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  section: { fontWeight: "700", marginTop: 10 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBox: { width: 72, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
});
