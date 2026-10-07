import { ActivityIndicator, FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { CardTile } from "./CardTile";
import { Button, Icon, Skeleton } from "./ui";
import { t } from "../i18n/ko";
import { useTheme } from "../theme";
import type { ApiError, CardSummary } from "../api/cards";

const COLUMNS = 3;
const GAP = 10;
const PAD = 14;

interface Props {
  items: CardSummary[];
  loading: boolean;
  error: ApiError | null;
  emptyText: string;
  showStatus: boolean;
  dimUnowned?: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  onToggleOwned?: (card: CardSummary) => void;
  header?: React.ReactElement;
  bottomInset?: number;
}

export function CardGrid({
  items,
  loading,
  error,
  emptyText,
  showStatus,
  dimUnowned,
  onRefresh,
  onEndReached,
  onToggleOwned,
  header,
  bottomInset = 0,
}: Props) {
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const tileWidth = Math.floor((width - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  // First load: skeleton grid instead of a blank screen.
  if (loading && items.length === 0) {
    return (
      <View style={{ padding: PAD, flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={{ width: tileWidth }}>
            <Skeleton style={{ width: tileWidth, height: Math.round(tileWidth * 1.4) }} />
            <Skeleton style={{ width: tileWidth * 0.8, height: 10, marginTop: 8 }} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(card) => card.id}
      numColumns={COLUMNS}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ padding: PAD, paddingBottom: PAD + bottomInset }}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <CardTile
          card={item}
          width={tileWidth}
          showStatus={showStatus}
          dimUnowned={dimUnowned}
          onToggleOwned={onToggleOwned}
          onPress={(card) => router.push({ pathname: "/card/[id]", params: { id: card.id } })}
        />
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshing={false}
      onRefresh={onRefresh}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      ListEmptyComponent={
        error ? (
          <View style={styles.center}>
            <Icon name="cloud-offline-outline" size={40} color={c.textMuted} />
            <Text style={[styles.msg, { color: c.textMuted }]}>{error.code === "NETWORK" ? t.common.offline : t.common.error}</Text>
            <Button label={t.common.retry} onPress={onRefresh} />
          </View>
        ) : (
          <View style={styles.center}>
            <Icon name="albums-outline" size={40} color={c.textMuted} />
            <Text style={[styles.msg, { color: c.textMuted }]}>{emptyText}</Text>
          </View>
        )
      }
      ListFooterComponent={
        loading ? (
          <ActivityIndicator style={{ margin: 16 }} color={c.primary} />
        ) : error && items.length > 0 ? (
          <View style={{ alignItems: "center", margin: 12 }}>
            <Button label={t.common.retry} onPress={onEndReached} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingTop: 70, gap: 12 },
  msg: { fontSize: 14 },
});
