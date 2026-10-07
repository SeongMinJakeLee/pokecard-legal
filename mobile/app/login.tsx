import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { Button, Field, Icon } from "../src/components/ui";
import { t } from "../src/i18n/ko";
import { useTheme } from "../src/theme";

export default function LoginScreen() {
  const { c } = useTheme();
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
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: c.primary }]}>
          <Icon name="albums" size={30} color={c.onPrimary} />
        </View>
        <Text style={[styles.h, { color: c.text }]}>{t.auth.loginRequired}</Text>
      </View>
      <Field icon="mail-outline" value={email} onChangeText={setEmail} placeholder={t.auth.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder={t.auth.password} secureTextEntry autoComplete="password" />
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
      <Button label={t.auth.login} onPress={submit} disabled={!email || !password || busy} />
      <Link href="/forgot-password" style={[styles.link, { color: c.textMuted }]}>
        {t.auth.forgot}
      </Link>
      <Link href="/signup" style={[styles.link, { color: c.primary, marginTop: 0 }]}>
        {t.auth.goSignup}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  hero: { alignItems: "center", gap: 12, paddingVertical: 20 },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  h: { fontSize: 16, fontWeight: "700" },
  link: { textAlign: "center", marginTop: 8, fontWeight: "600" },
});
