import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RESET_REDIRECT_URL } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { Button, Field } from "../src/components/ui";
import { t } from "../src/i18n/ko";
import { useTheme } from "../src/theme";

export default function ForgotPasswordScreen() {
  const { c } = useTheme();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || !email.includes("@")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: RESET_REDIRECT_URL });
    setBusy(false);
    // Do not reveal whether the address is registered: show the same confirmation either way,
    // and only surface network / rate-limit problems.
    if (err && /network|fetch/i.test(err.message)) setError(t.common.offline);
    else if (err && /rate|too many|seconds/i.test(err.message)) setError(err.message);
    else setSent(true);
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.textMuted, lineHeight: 20 }}>{t.auth.resetHint}</Text>
      <Field icon="mail-outline" value={email} onChangeText={setEmail} placeholder={t.auth.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
      {sent && <Text style={{ color: c.owned, lineHeight: 20 }}>{t.auth.resetSent}</Text>}
      <Button label={t.auth.resetSend} onPress={submit} disabled={!email.includes("@") || busy} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, gap: 12 } });
