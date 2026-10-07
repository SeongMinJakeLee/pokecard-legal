import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AUTH_REDIRECT_URL, useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { Button, Field, Icon } from "../src/components/ui";
import { t } from "../src/i18n/ko";
import { useTheme } from "../src/theme";

const TERMS_VERSION = "v0"; // bump when the terms/privacy policy text is published

export default function SignupScreen() {
  const { c } = useTheme();
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
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Field icon="mail-outline" value={email} onChangeText={setEmail} placeholder={t.auth.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        placeholder={`${t.auth.password} (${t.auth.passwordHint})`}
        secureTextEntry
        autoComplete="new-password"
      />
      <Check label={t.auth.ageConfirm} on={age} onPress={() => setAge((v) => !v)} />
      <Check label={t.auth.termsAgree} on={terms} onPress={() => setTerms((v) => !v)} />
      {under14 && <Text style={{ color: c.danger }}>{t.auth.under14}</Text>}
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
      {notice && <Text style={{ color: c.owned }}>{notice}</Text>}
      <Button label={t.auth.signup} onPress={submit} disabled={!valid || busy} />
    </View>
  );
}

function Check({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <Icon name={on ? "checkbox" : "square-outline"} size={24} color={on ? c.primary : c.textMuted} />
      <Text style={{ flex: 1, color: c.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  check: { flexDirection: "row", alignItems: "center", gap: 10 },
});
