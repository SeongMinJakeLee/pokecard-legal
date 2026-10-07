import { useCallback, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { listWishlist } from "../../src/api/cards";
import { useAuth } from "../../src/auth/AuthProvider";
import { usePagedCards } from "../../src/components/usePagedCards";
import { useMergedCards, useQuickOwn } from "../../src/components/useQuickOwn";
import { CardGrid } from "../../src/components/CardGrid";
import { Button, Icon } from "../../src/components/ui";
import { t } from "../../src/i18n/ko";
import { useTheme } from "../../src/theme";

export default function WishlistScreen() {
  const { c } = useTheme();
  const { session, dataVersion, requireLogin } = useAuth();
  const loggedIn = !!session;
  const { items, loading, error, refresh, loadMore } = usePagedCards((cursor) => listWishlist(cursor), [dataVersion], loggedIn);
  const merged = useMergedCards(items);
  const quickOwn = useQuickOwn();

  // Wishlist membership can change from the detail screen; refresh when the tab regains focus (skip first mount).
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (loggedIn) refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loggedIn]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
      <Text style={[styles.title, { color: c.text }]}>{t.tabs.wishlist}</Text>
      {!loggedIn ? (
        <View style={styles.center}>
          <Icon name="heart-outline" size={44} color={c.textMuted} />
          <Text style={{ color: c.textMuted }}>{t.wishlist.loginNeeded}</Text>
          <Button label={t.auth.login} onPress={() => requireLogin()} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <CardGrid
            items={merged.filter((card) => card.wished !== false)}
            loading={loading}
            error={error}
            emptyText={t.wishlist.empty}
            showStatus
            onRefresh={refresh}
            onEndReached={loadMore}
            onToggleOwned={quickOwn}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, paddingHorizontal: 14, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
});
