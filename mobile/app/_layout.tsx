import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth/AuthProvider";
import { FilterProvider } from "../src/state/filters";
import { t } from "../src/i18n/ko";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FilterProvider>
          <StatusBar style="dark" />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="card/[id]" options={{ title: "" }} />
            <Stack.Screen name="filters" options={{ title: t.filters.title, presentation: "modal" }} />
            <Stack.Screen name="login" options={{ title: t.auth.login, presentation: "modal" }} />
            <Stack.Screen name="signup" options={{ title: t.auth.signup }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          </Stack>
        </FilterProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
