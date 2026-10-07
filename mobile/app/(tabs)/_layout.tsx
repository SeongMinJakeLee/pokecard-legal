import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../../src/i18n/ko";
import { useTheme } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const tabIcon = (active: IconName, inactive: IconName) =>
  function TabIcon({ color, focused, size }: { color: string; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  };

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.cards, tabBarIcon: tabIcon("albums", "albums-outline") as never }} />
      <Tabs.Screen name="sets" options={{ title: t.tabs.sets, tabBarIcon: tabIcon("grid", "grid-outline") as never }} />
      <Tabs.Screen name="collection" options={{ title: t.tabs.collection, tabBarIcon: tabIcon("checkmark-circle", "checkmark-circle-outline") as never }} />
      <Tabs.Screen name="wishlist" options={{ title: t.tabs.wishlist, tabBarIcon: tabIcon("heart", "heart-outline") as never }} />
      <Tabs.Screen name="account" options={{ title: t.tabs.account, tabBarIcon: tabIcon("person", "person-outline") as never }} />
    </Tabs>
  );
}
