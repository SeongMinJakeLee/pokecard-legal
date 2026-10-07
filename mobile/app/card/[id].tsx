import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, cardTitles, getCard, setOwned, setWished, type CardDetail } from "../../src/api/cards";
import { useAuth } from "../../src/auth/AuthProvider";
import { Button, Card, Icon } from "../../src/components/ui";
import { t } from "../../src/i18n/ko";
import { radius, rarityStyle, typeColor, typeLabel, useTheme } from "../../src/theme";

const BAR_HEIGHT = 76;

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { session, dataVersion, requireLogin, applyOverride } = useAuth();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const change = type === "own" ? { owned: next } : { wished: next };
    // Optimistic update (also shared with the list screens), rolled back on failure.
    setCard({ ...card, ...change });
    applyOverride(card.id, change);
    try {
      await (type === "own" ? setOwned : setWished)(card.id, next);
    } catch (e) {
      setCard(card);
      applyOverride(card.id, type === "own" ? { owned: current } : { wished: current });
      if (e instanceof ApiError && e.code === "UNAUTHENTICATED") requireLogin({ type, cardId: card.id, value: next });
    } finally {
      setBusy(false);
    }
  };

  if (!card) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        {error ? (
          <>
            <Icon name="cloud-offline-outline" size={40} color={c.textMuted} />
            <Text style={{ color: c.textMuted }}>{error.code === "NETWORK" ? t.common.offline : t.common.error}</Text>
            <Button label={t.common.retry} onPress={load} />
          </>
        ) : (
          <ActivityIndicator color={c.primary} />
        )}
      </View>
    );
  }

  const d = card.details;
  const main = card.types[0];
  const tint = typeColor(main);
  const rs = rarityStyle(card.rarity);
  const imgW = Math.min(width - 72, 320);
  const names = cardTitles(card);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: names.title, headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text }} />
      <ScrollView contentContainerStyle={{ paddingBottom: BAR_HEIGHT + insets.bottom + 24 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: tint + "26" }]}>
          <Pressable onPress={() => setZoom(true)} accessibilityLabel={t.detail.zoomHint}>
            <Image
              source={card.imageLarge ? { uri: card.imageLarge } : card.imageSmall ? { uri: card.imageSmall } : undefined}
              placeholder={card.imageSmall ? { uri: card.imageSmall } : undefined}
              style={[styles.heroImg, { width: imgW, height: imgW * 1.395 }]}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={150}
            />
          </Pressable>
          <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 10 }}>{t.detail.zoomHint}</Text>
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: c.text }]}>{names.title}</Text>
          {names.subtitle ? <Text style={{ color: c.textMuted, marginTop: -6, fontSize: 13 }}>{names.subtitle}</Text> : null}
          <View style={styles.pills}>
            {card.types.map((ty) => (
              <View key={ty} style={[styles.pill, { backgroundColor: typeColor(ty) }]}>
                <Text style={styles.pillText}>{typeLabel(ty)}</Text>
              </View>
            ))}
            {card.rarity ? (
              <View style={[styles.pill, { backgroundColor: rs.color + "22", borderColor: rs.color, borderWidth: 1 }]}>
                <Text style={[styles.pillText, { color: rs.color }]}>{card.rarity}</Text>
              </View>
            ) : null}
            {card.hp ? (
              <View style={[styles.pill, { backgroundColor: c.surfaceAlt }]}>
                <Text style={[styles.pillText, { color: c.text }]}>HP {card.hp}</Text>
              </View>
            ) : null}
          </View>

          <Card style={{ gap: 10 }}>
            <Row label={t.detail.set} value={card.set.name} />
            <Row label={t.detail.number} value={`${card.number ?? "-"} / ${card.set.printedTotal ?? "-"}`} />
            <Row label={t.detail.artist} value={card.artist} />
          </Card>

          {d.abilities.length > 0 && (
            <Section title={t.detail.abilities}>
              {d.abilities.map((a) => (
                <Card key={a.name} style={{ gap: 4 }}>
                  <Text style={{ color: c.danger, fontWeight: "800" }}>{a.name}</Text>
                  {a.text ? <Text style={[styles.p, { color: c.text }]}>{a.text}</Text> : null}
                </Card>
              ))}
            </Section>
          )}

          {d.attacks.length > 0 && (
            <Section title={t.detail.attacks}>
              {d.attacks.map((a) => (
                <Card key={a.name} style={{ gap: 6 }}>
                  <View style={styles.attackHead}>
                    <View style={styles.cost}>
                      {a.cost.map((e, i) => (
                        <View key={i} style={[styles.energy, { backgroundColor: typeColor(e) }]} />
                      ))}
                    </View>
                    <Text style={{ color: c.text, fontWeight: "800", flex: 1 }}>{a.name}</Text>
                    {a.damage ? <Text style={{ color: c.text, fontWeight: "800", fontSize: 17 }}>{a.damage}</Text> : null}
                  </View>
                  {a.text ? <Text style={[styles.p, { color: c.textMuted }]}>{a.text}</Text> : null}
                </Card>
              ))}
            </Section>
          )}

          <View style={styles.stats}>
            <Stat label={t.detail.weakness}>
              {d.weaknesses.length ? (
                d.weaknesses.map((w) => <TypeValue key={w.type} type={w.type} value={w.value} />)
              ) : (
                <Text style={{ color: c.textMuted }}>{t.detail.none}</Text>
              )}
            </Stat>
            <Stat label={t.detail.resistance}>
              {d.resistances.length ? (
                d.resistances.map((w) => <TypeValue key={w.type} type={w.type} value={w.value} />)
              ) : (
                <Text style={{ color: c.textMuted }}>{t.detail.none}</Text>
              )}
            </Stat>
            <Stat label={t.detail.retreat}>
              {d.retreatCost.length ? (
                <View style={styles.cost}>
                  {d.retreatCost.map((e, i) => (
                    <View key={i} style={[styles.energy, { backgroundColor: typeColor(e) }]} />
                  ))}
                </View>
              ) : (
                <Text style={{ color: c.textMuted }}>{t.detail.none}</Text>
              )}
            </Stat>
          </View>

          {d.flavorText ? <Text style={[styles.p, styles.flavor, { color: c.textMuted }]}>{d.flavorText}</Text> : null}
        </View>
      </ScrollView>

      {/* Sticky action bar (kept above the system navigation bar) */}
      <View
        style={[
          styles.bar,
          { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: 12 + insets.bottom },
        ]}
      >
        <Pressable
          onPress={() => toggle("own")}
          style={[styles.barBtn, { backgroundColor: card.owned ? c.owned : c.surfaceAlt }]}
          accessibilityRole="button"
        >
          <Icon name={card.owned ? "checkmark-circle" : "add-circle-outline"} size={20} color={card.owned ? "#fff" : c.text} />
          <Text style={{ color: card.owned ? "#fff" : c.text, fontWeight: "800" }}>{card.owned ? t.detail.owned : t.detail.markOwned}</Text>
        </Pressable>
        <Pressable
          onPress={() => toggle("wish")}
          style={[styles.barBtn, { backgroundColor: card.wished ? c.wish : c.surfaceAlt }]}
          accessibilityRole="button"
        >
          <Icon name={card.wished ? "heart" : "heart-outline"} size={20} color={card.wished ? "#fff" : c.text} />
          <Text style={{ color: card.wished ? "#fff" : c.text, fontWeight: "800" }}>{card.wished ? t.detail.wished : t.detail.addWish}</Text>
        </Pressable>
      </View>

      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)} statusBarTranslucent>
        <Pressable style={[styles.zoomWrap, { backgroundColor: c.overlay }]} onPress={() => setZoom(false)}>
          <Image
            source={card.imageLarge ? { uri: card.imageLarge } : undefined}
            placeholder={card.imageSmall ? { uri: card.imageSmall } : undefined}
            style={{ width: width - 24, height: height - 80 }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  const { c } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={{ width: 72, color: c.textMuted }}>{label}</Text>
      <Text style={{ flex: 1, color: c.text, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: c.text, fontWeight: "800", fontSize: 16, marginTop: 6 }}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: c.textMuted, fontSize: 11, marginBottom: 6 }}>{label}</Text>
      <View style={{ alignItems: "center", gap: 4 }}>{children}</View>
    </View>
  );
}

function TypeValue({ type, value }: { type: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={[styles.energy, { backgroundColor: typeColor(type) }]} />
      <Text style={{ color: c.text, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  hero: { alignItems: "center", paddingTop: 24, paddingBottom: 18 },
  heroImg: {
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  body: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  row: { flexDirection: "row", gap: 12 },
  p: { lineHeight: 20 },
  attackHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  cost: { flexDirection: "row", gap: 3 },
  energy: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  flavor: { fontStyle: "italic", marginTop: 4 },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: radius.md },
  zoomWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
});
