import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { CardSummary } from "../api/cards";

interface Props {
  card: CardSummary;
  width: number;
  showStatus: boolean;
  /** Dim cards the user does not own (only meaningful when logged in). */
  dimUnowned?: boolean;
  onPress: (card: CardSummary) => void;
}

function CardTileBase({ card, width, showStatus, dimUnowned, onPress }: Props) {
  const height = Math.round(width * 1.4);
  return (
    <Pressable onPress={() => onPress(card)} style={[styles.wrap, { width }]} accessibilityLabel={card.name}>
      <View style={[styles.imgBox, { width, height }, dimUnowned && !card.owned && styles.imgDim]}>
        <Image
          source={card.imageSmall ? { uri: card.imageSmall } : undefined}
          style={{ width, height }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={card.id}
          transition={120}
        />
        {showStatus && (card.owned || card.wished) && (
          <View style={styles.badges}>
            {card.owned && <Text style={[styles.badge, styles.badgeOwned]}>✓</Text>}
            {card.wished && <Text style={[styles.badge, styles.badgeWish]}>♥</Text>}
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {card.name}
      </Text>
      <Text numberOfLines={1} style={styles.sub}>
        {card.set.name} · {card.number ?? "-"}
      </Text>
    </Pressable>
  );
}

export const CardTile = memo(CardTileBase);

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  imgBox: { borderRadius: 6, backgroundColor: "#f1f1f4", overflow: "hidden" },
  imgDim: { opacity: 0.5 },
  badges: { position: "absolute", top: 4, right: 4, flexDirection: "row", gap: 3 },
  badge: { width: 20, height: 20, borderRadius: 10, textAlign: "center", lineHeight: 20, color: "#fff", fontSize: 12, overflow: "hidden" },
  badgeOwned: { backgroundColor: "#16a34a" },
  badgeWish: { backgroundColor: "#e11d48" },
  name: { marginTop: 4, fontSize: 12, fontWeight: "600", color: "#111" },
  sub: { fontSize: 10, color: "#666" },
});
