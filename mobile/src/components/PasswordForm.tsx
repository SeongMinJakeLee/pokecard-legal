import { useState } from "react";
import { Text } from "react-native";
import { supabase } from "../lib/supabase";
import { Button, Field } from "./ui";
import { t } from "../i18n/ko";
import { useTheme } from "../theme";

/** New password + confirmation. Used by the reset-link screen and the "비밀번호 변경" screen. */
export function PasswordForm({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mismatch = pw2.length > 0 && pw !== pw2;
  const valid = pw.length >= 8 && pw === pw2;

  const submit = async () => {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) {
      setError(/network|fetch/i.test(err.message) ? t.common.offline : err.message);
      return;
    }
    setSaved(true);
    setTimeout(onDone, 900);
  };

  return (
    <>
      <Field
        icon="lock-closed-outline"
        value={pw}
        onChangeText={setPw}
        placeholder={`${t.auth.newPassword} (${t.auth.passwordHint})`}
        secureTextEntry
        autoComplete="new-password"
      />
      <Field
        icon="lock-closed-outline"
        value={pw2}
        onChangeText={setPw2}
        placeholder={t.auth.confirmPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      {mismatch && <Text style={{ color: c.danger }}>{t.auth.passwordMismatch}</Text>}
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
      {saved && <Text style={{ color: c.owned }}>{t.auth.passwordSaved}</Text>}
      <Button label={t.auth.passwordSave} onPress={submit} disabled={!valid || busy || saved} />
    </>
  );
}
