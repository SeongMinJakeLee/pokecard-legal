import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { t } from "../src/i18n/ko";

export default function LoginScreen() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Return to where the user came from (the pending action is applied by AuthProvider).
  useEffect(() => {
    if (session) router.dismissAll();
  }, [session]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(/network|fetch/i.test(err.message) ? t.common.offline : t.auth.invalidCreds);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.info}>{t.auth.loginRequired}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t.auth.email}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t.auth.password}
        secureTextEntry
        autoComplete="password"
        style={styles.input}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.btn, (!email || !password) && styles.btnOff]} disabled={!email || !password || busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.auth.login}</Text>}
      </Pressable>
      <Link href="/signup" style={styles.link}>
        {t.auth.goSignup}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12, backgroundColor: "#fff" },
  info: { color: "#555", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#d4d4d8", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  error: { color: "#dc2626" },
  btn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnOff: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700" },
  link: { color: "#2563eb", textAlign: "center", marginTop: 8 },
});
