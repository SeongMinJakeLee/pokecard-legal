import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, getCard, setOwned, setWished, type CardDetail } from "../../src/api/cards";
import { useAuth } from "../../src/auth/AuthProvider";
import { t } from "../../src/i18n/ko";

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session, dataVersion, requireLogin, bumpData } = useAuth();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCard(await getCard(id));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", String(e)));
    }
  }, [id]);

  // Reload on login/logout and after a pending post-login action is applied.
  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const toggle = async (type: "own" | "wish") => {
    if (!card) return;
    const current = type === "own" ? !!card.owned : !!card.wished;
    const next = !current;
    if (!session) return requireLogin({ type, cardId: card.id, value: next });
    if (busy) return;
    setBusy(true);
    // Optimistic update with rollback on failure.
    setCard({ ...card, ...(type === "own" ? { owned: next } : { wished: next }) });
    try {
      await (type === "own" ? setOwned : setWished)(card.id, next);
      bumpData();
    } catch (e) {
      setCard(card);
      if (e instanceof ApiError && e.code === "UNAUTHENTICATED") requireLogin({ type, cardId: card.id, value: next });
      else setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (!card) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.msg}>{error.code === "NETWORK" ? t.common.offline : t.common.error}</Text>
            <Pressable style={styles.btn} onPress={load}>
              <Text style={styles.btnText}>{t.common.retry}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const d = card.details;
  return (
    // Android edge-to-edge: pad the bottom by the system navigation bar height so the last rows are not covered.
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
      <Stack.Screen options={{ title: card.name }} />
      <Image
        source={card.imageLarge ? { uri: card.imageLarge } : card.imageSmall ? { uri: card.imageSmall } : undefined}
        placeholder={card.imageSmall ? { uri: card.imageSmall } : undefined}
        style={styles.image}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={150}
      />

      <View style={styles.actions}>
        <Pressable style={[styles.action, card.owned && styles.actionOwned]} onPress={() => toggle("own")}>
          <Text style={[styles.actionText, card.owned && styles.actionTextOn]}>
            {card.owned ? `✓ ${t.detail.owned}` : t.detail.markOwned}
          </Text>
        </Pressable>
        <Pressable style={[styles.action, card.wished && styles.actionWished]} onPress={() => toggle("wish")}>
          <Text style={[styles.actionText, card.wished && styles.actionTextOn]}>
            {card.wished ? `♥ ${t.detail.wished}` : `♡ ${t.detail.addWish}`}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{card.name}</Text>
      <Row label={t.detail.set} value={`${card.set.name} (${card.set.series ?? ""})`} />
      <Row label={t.detail.number} value={`${card.number ?? "-"} / ${card.set.printedTotal ?? "-"}`} />
      <Row label={t.detail.rarity} value={card.rarity} />
      <Row label={t.detail.hp} value={card.hp?.toString()} />
      <Row label={t.detail.type} value={card.types.join(", ")} />
      <Row label={t.detail.artist} value={card.artist} />

      {d.abilities.length > 0 && <Section title={t.detail.abilities} />}
      {d.abilities.map((a) => (
        <Text key={a.name} style={styles.p}>
          <Text style={styles.bold}>{a.name}</Text>
          {a.text ? `\n${a.text}` : ""}
        </Text>
      ))}

      {d.attacks.length > 0 && <Section title={t.detail.attacks} />}
      {d.attacks.map((a) => (
        <Text key={a.name} style={styles.p}>
          <Text style={styles.bold}>
            {a.name}
            {a.damage ? `  ${a.damage}` : ""}
          </Text>
          {a.cost.length ? `\n${a.cost.join(" ")}` : ""}
          {a.text ? `\n${a.text}` : ""}
        </Text>
      ))}

      <Row label={t.detail.weakness} value={d.weaknesses.map((w) => `${w.type} ${w.value}`).join(", ")} />
      <Row label={t.detail.resistance} value={d.resistances.map((w) => `${w.type} ${w.value}`).join(", ")} />
      <Row label={t.detail.retreat} value={d.retreatCost.length ? String(d.retreatCost.length) : undefined} />
      {d.flavorText ? <Text style={[styles.p, styles.flavor]}>{d.flavorText}</Text> : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const Section = ({ title }: { title: string }) => <Text style={styles.section}>{title}</Text>;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  msg: { color: "#555" },
  body: { padding: 16, gap: 8, backgroundColor: "#fff" },
  image: { width: "100%", aspectRatio: 0.716, borderRadius: 8 },
  actions: { flexDirection: "row", gap: 10, marginVertical: 8 },
  action: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: "#f1f1f4" },
  actionOwned: { backgroundColor: "#16a34a" },
  actionWished: { backgroundColor: "#e11d48" },
  actionText: { fontWeight: "600", color: "#333" },
  actionTextOn: { color: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  row: { flexDirection: "row", gap: 12 },
  label: { width: 70, color: "#777" },
  value: { flex: 1, color: "#111" },
  section: { marginTop: 12, fontWeight: "700", fontSize: 16 },
  p: { lineHeight: 20, color: "#222" },
  bold: { fontWeight: "700" },
  flavor: { marginTop: 12, fontStyle: "italic", color: "#666" },
  btn: { backgroundColor: "#2563eb", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "600" },
});
