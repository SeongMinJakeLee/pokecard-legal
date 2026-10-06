import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { CardTile } from "./CardTile";
import { t } from "../i18n/ko";
import type { ApiError, CardSummary } from "../api/cards";

const COLUMNS = 3;
const GAP = 10;
const PAD = 12;

interface Props {
  items: CardSummary[];
  loading: boolean;
  error: ApiError | null;
  emptyText: string;
  showStatus: boolean;
  dimUnowned?: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  header?: React.ReactElement;
}

export function CardGrid({ items, loading, error, emptyText, showStatus, dimUnowned, onRefresh, onEndReached, header }: Props) {
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      numColumns={COLUMNS}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ padding: PAD }}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <CardTile
          card={item}
          width={tileWidth}
          showStatus={showStatus}
          dimUnowned={dimUnowned}
          onPress={(c) => router.push({ pathname: "/card/[id]", params: { id: c.id } })}
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
        loading ? null : error ? (
          <View style={styles.center}>
            <Text style={styles.msg}>{error.code === "NETWORK" ? t.common.offline : t.common.error}</Text>
            <Pressable onPress={onRefresh} style={styles.btn}>
              <Text style={styles.btnText}>{t.common.retry}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.msg}>{emptyText}</Text>
          </View>
        )
      }
      ListFooterComponent={
        loading ? (
          <ActivityIndicator style={{ margin: 16 }} />
        ) : error && items.length > 0 ? (
          <Pressable onPress={onEndReached} style={[styles.btn, { alignSelf: "center", margin: 12 }]}>
            <Text style={styles.btnText}>{t.common.retry}</Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingTop: 60, gap: 12 },
  msg: { color: "#555", fontSize: 14 },
  btn: { backgroundColor: "#2563eb", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "600" },
});
