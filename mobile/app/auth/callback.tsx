import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";

// Landing route for the `pokecard://auth/callback` deep link. AuthProvider consumes the tokens from the URL;
// this screen only waits briefly and then returns to the app.
export default function AuthCallback() {
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      router.replace("/");
      return;
    }
    const id = setTimeout(() => router.replace("/login"), 4000);
    return () => clearTimeout(id);
  }, [session]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
