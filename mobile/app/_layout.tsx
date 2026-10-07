import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth/AuthProvider";
import { FilterProvider } from "../src/state/filters";
import { t } from "../src/i18n/ko";
import { useTheme } from "../src/theme";

function Navigator() {
  const { c, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="card/[id]" options={{ title: "" }} />
        <Stack.Screen name="filters" options={{ title: t.filters.title, presentation: "modal" }} />
        <Stack.Screen name="login" options={{ title: t.auth.login, presentation: "modal" }} />
        <Stack.Screen name="signup" options={{ title: t.auth.signup }} />
        <Stack.Screen name="forgot-password" options={{ title: t.auth.resetTitle }} />
        <Stack.Screen name="change-password" options={{ title: t.auth.changePasswordTitle }} />
        <Stack.Screen name="auth/reset" options={{ title: t.auth.newPasswordTitle }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FilterProvider>
          <Navigator />
        </FilterProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
