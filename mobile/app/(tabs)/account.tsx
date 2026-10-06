import { Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthProvider";
import { supabase } from "../../src/lib/supabase";
import { t } from "../../src/i18n/ko";

export default function AccountScreen() {
  const { session, requireLogin } = useAuth();

  return (
    <SafeAreaView style={styles.screen}>
      {session ? (
        <>
          <Text style={styles.title}>{session.user.email}</Text>
          <Pressable style={styles.btn} onPress={() => supabase.auth.signOut()}>
            <Text style={styles.btnText}>{t.auth.logout}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.title}>{t.auth.guest}</Text>
          <Text style={styles.hint}>{t.auth.guestHint}</Text>
          <Pressable style={styles.btn} onPress={() => requireLogin()}>
            <Text style={styles.btnText}>{t.auth.login}</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 17, fontWeight: "600" },
  hint: { color: "#666", textAlign: "center" },
  btn: { backgroundColor: "#2563eb", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "600" },
});
