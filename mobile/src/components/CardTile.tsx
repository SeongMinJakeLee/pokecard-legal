import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { cardTitles, type CardSummary } from "../api/cards";
import { radius, rarityStyle, useTheme } from "../theme";

interface Props {
  card: CardSummary;
  width: number;
  showStatus: boolean;
  /** Dim cards the user does not own (only meaningful when logged in). */
  dimUnowned?: boolean;
  onPress: (card: CardSummary) => void;
  /** Quick ownership toggle from the grid (guests are sent to login by the caller). */
  onToggleOwned?: (card: CardSummary) => void;
}

function CardTileBase({ card, width, showStatus, dimUnowned, onPress, onToggleOwned }: Props) {
  const { c } = useTheme();
  const height = Math.round(width * 1.4);
  const rs = rarityStyle(card.rarity);
  const dim = dimUnowned && !card.owned;
  const { title, subtitle: en } = cardTitles(card);
  // Korean card: show the English name as a quiet second line; untranslated card: show the set instead.
  const subtitle = en ?? card.set.name;

  return (
    <Pressable onPress={() => onPress(card)} style={[styles.wrap, { width }]} accessibilityLabel={title}>
      <View
        style={[
          styles.imgBox,
          { width, height, backgroundColor: c.surfaceAlt },
          card.owned && { borderColor: c.owned, borderWidth: 2 },
        ]}
      >
        <Image
          source={card.imageSmall ? { uri: card.imageSmall } : undefined}
          style={{ width: "100%", height: "100%", opacity: dim ? 0.45 : 1 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={card.id}
          transition={120}
        />
        {rs.tier >= 2 && <View style={[styles.rarityDot, { backgroundColor: rs.color }]} />}
        {card.wished && (
          <View style={[styles.wishBadge, { backgroundColor: c.wish }]}>
            <Ionicons name="heart" size={11} color="#fff" />
          </View>
        )}
        {showStatus && onToggleOwned && (
          <Pressable
            hitSlop={8}
            onPress={() => onToggleOwned(card)}
            style={[styles.ownBtn, { backgroundColor: card.owned ? c.owned : "rgba(0,0,0,0.45)" }]}
            accessibilityLabel={card.owned ? "보유 해제" : "보유 체크"}
          >
            <Ionicons name={card.owned ? "checkmark" : "add"} size={16} color="#fff" />
          </Pressable>
        )}
      </View>
      <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>
        {title}
      </Text>
      <Text numberOfLines={1} style={[styles.sub, { color: c.textMuted }]}>
        {subtitle ? `${subtitle} · ` : ""}{card.number ?? "-"}
      </Text>
    </Pressable>
  );
}

export const CardTile = memo(CardTileBase);

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  imgBox: { borderRadius: radius.md, overflow: "hidden", padding: 3 },
  rarityDot: { position: "absolute", left: 6, top: 6, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: "#fff" },
  wishBadge: { position: "absolute", left: 6, bottom: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ownBtn: { position: "absolute", right: 5, bottom: 5, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  name: { marginTop: 6, fontSize: 12.5, fontWeight: "700" },
  sub: { fontSize: 10.5, marginTop: 1 },
});
