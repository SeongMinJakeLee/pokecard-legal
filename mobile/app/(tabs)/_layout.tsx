import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { t } from "../../src/i18n/ko";

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#2563eb" }}>
      <Tabs.Screen name="index" options={{ title: t.tabs.cards, tabBarIcon: icon("▦") }} />
      <Tabs.Screen name="wishlist" options={{ title: t.tabs.wishlist, tabBarIcon: icon("♥") }} />
      <Tabs.Screen name="account" options={{ title: t.tabs.account, tabBarIcon: icon("●") }} />
    </Tabs>
  );
}
