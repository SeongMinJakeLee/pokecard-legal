import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AUTH_REDIRECT_URL, useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { t } from "../src/i18n/ko";

const TERMS_VERSION = "v0"; // bump when the terms/privacy policy text is published

export default function SignupScreen() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [under14, setUnder14] = useState(false);

  useEffect(() => {
    if (session) router.dismissAll();
  }, [session]);

  const valid = email.includes("@") && password.length >= 8 && terms;

  const submit = async () => {
    if (busy) return;
    // Under-14 users are guest-only: do not create the account (docs/07).
    if (!age) {
      setUnder14(true);
      return;
    }
    setUnder14(false);
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
        data: { age_confirmed: "true", terms_agreed: "true", terms_version: TERMS_VERSION },
      },
    });
    setBusy(false);
    if (err) {
      setError(/network|fetch/i.test(err.message) ? t.common.offline : err.message);
      return;
    }
    if (!data.session) setNotice(t.auth.checkEmail);
  };

  return (
    <View style={styles.screen}>
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
        placeholder={`${t.auth.password} (${t.auth.passwordHint})`}
        secureTextEntry
        autoComplete="new-password"
        style={styles.input}
      />
      <Check label={t.auth.ageConfirm} on={age} onPress={() => setAge((v) => !v)} />
      <Check label={t.auth.termsAgree} on={terms} onPress={() => setTerms((v) => !v)} />
      {under14 && <Text style={styles.error}>{t.auth.under14}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}
      <Pressable style={[styles.btn, !valid && styles.btnOff]} disabled={!valid || busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.auth.signup}</Text>}
      </Pressable>
    </View>
  );
}

function Check({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <Text style={styles.box}>{on ? "☑" : "☐"}</Text>
      <Text style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12, backgroundColor: "#fff" },
  input: { borderWidth: 1, borderColor: "#d4d4d8", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  check: { flexDirection: "row", alignItems: "center", gap: 8 },
  box: { fontSize: 22 },
  error: { color: "#dc2626" },
  notice: { color: "#16a34a" },
  btn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnOff: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700" },
});
