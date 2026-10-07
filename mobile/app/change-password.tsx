import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { PasswordForm } from "../src/components/PasswordForm";
import { useTheme } from "../src/theme";

export default function ChangePasswordScreen() {
  const { c } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <PasswordForm onDone={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, gap: 12 } });
