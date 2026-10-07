import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthProvider";
import { supabase } from "../../src/lib/supabase";
import { Button, Card, Icon } from "../../src/components/ui";
import { t } from "../../src/i18n/ko";
import { radius, useTheme } from "../../src/theme";

export default function AccountScreen() {
  const { c } = useTheme();
  const { session, requireLogin } = useAuth();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={["top"]}>
      <Text style={[styles.title, { color: c.text }]}>{t.tabs.account}</Text>
      <View style={{ padding: 14, gap: 12 }}>
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 28 }}>
          <View style={[styles.avatar, { backgroundColor: c.surfaceAlt }]}>
            <Icon name="person" size={34} color={c.textMuted} />
          </View>
          {session ? (
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{session.user.email}</Text>
          ) : (
            <>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{t.auth.guest}</Text>
              <Text style={{ color: c.textMuted, textAlign: "center" }}>{t.auth.guestHint}</Text>
            </>
          )}
        </Card>
        {session ? (
          <>
            <Button label={t.auth.changePassword} icon="key-outline" variant="ghost" onPress={() => router.push("/change-password")} />
            <Button label={t.auth.logout} icon="log-out-outline" variant="ghost" onPress={() => supabase.auth.signOut()} />
          </>
        ) : (
          <Button label={t.auth.login} icon="log-in-outline" onPress={() => requireLogin()} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, paddingHorizontal: 14, paddingTop: 8 },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
