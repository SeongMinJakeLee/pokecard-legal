import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { PasswordForm } from "../../src/components/PasswordForm";
import { Button } from "../../src/components/ui";
import { t } from "../../src/i18n/ko";
import { useTheme } from "../../src/theme";

// Landing route for the `pokecard://auth/reset` link in the password-reset email. AuthProvider turns the link's
// tokens into a session; once it exists, the user can set a new password.
export default function ResetPasswordScreen() {
  const { c } = useTheme();
  const { session } = useAuth();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (session) return;
    const id = setTimeout(() => setExpired(true), 5000);
    return () => clearTimeout(id);
  }, [session]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      {session ? (
        <>
          <Text style={[styles.h, { color: c.text }]}>{t.auth.newPasswordTitle}</Text>
          <PasswordForm onDone={() => router.replace("/")} />
        </>
      ) : expired ? (
        <>
          <Text style={{ color: c.danger, lineHeight: 20 }}>{t.auth.linkExpired}</Text>
          <Button label={t.auth.resetTitle} onPress={() => router.replace("/forgot-password")} />
        </>
      ) : (
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 12 },
  h: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
});
