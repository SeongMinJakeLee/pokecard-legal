import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listWishlist } from "../../src/api/cards";
import { useAuth } from "../../src/auth/AuthProvider";
import { usePagedCards } from "../../src/components/usePagedCards";
import { CardGrid } from "../../src/components/CardGrid";
import { t } from "../../src/i18n/ko";

export default function WishlistScreen() {
  const { session, dataVersion, requireLogin } = useAuth();
  const loggedIn = !!session;
  const { items, loading, error, refresh, loadMore } = usePagedCards(
    (cursor) => listWishlist(cursor),
    [dataVersion],
    loggedIn,
  );

  if (!loggedIn) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.msg}>{t.wishlist.loginNeeded}</Text>
        <Pressable style={styles.btn} onPress={() => requireLogin()}>
          <Text style={styles.btnText}>{t.auth.login}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <View style={{ flex: 1 }}>
        <CardGrid
          items={items}
          loading={loading}
          error={error}
          emptyText={t.wishlist.empty}
          showStatus
          onRefresh={refresh}
          onEndReached={loadMore}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: "#fff" },
  msg: { color: "#555", fontSize: 14 },
  btn: { backgroundColor: "#2563eb", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "600" },
});
