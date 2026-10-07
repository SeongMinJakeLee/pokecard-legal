import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFilters, listSets, type Filters, type SetInfo } from "../src/api/cards";
import { useFilters } from "../src/state/filters";
import { Button, Chip, Field } from "../src/components/ui";
import { t } from "../src/i18n/ko";
import { typeLabel, useTheme } from "../src/theme";

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function FiltersScreen() {
  const { c } = useTheme();
  const { query, setQuery } = useFilters();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<Filters | null>(null);
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [failed, setFailed] = useState(false);
  const [setText, setSetText] = useState("");
  const [selSets, setSelSets] = useState<string[]>(query.setIds ?? []);
  const [selTypes, setSelTypes] = useState<string[]>(query.types ?? []);
  const [selRarities, setSelRarities] = useState<string[]>(query.rarities ?? []);

  useEffect(() => {
    Promise.all([getFilters(), listSets()])
      .then(([f, s]) => {
        setFilters(f);
        setSets(s);
      })
      .catch(() => setFailed(true));
  }, []);

  const visibleSets = useMemo(() => {
    const q = setText.trim().toLowerCase();
    const base = q ? sets.filter((s) => s.name.toLowerCase().includes(q) || (s.series ?? "").toLowerCase().includes(q)) : sets;
    return base.slice(0, 60);
  }, [sets, setText]);

  if (failed) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.textMuted }}>{t.common.error}</Text>
      </View>
    );
  }
  if (!filters) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const total = selSets.length + selTypes.length + selRarities.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.h, { color: c.text }]}>{t.filters.types}</Text>
        <View style={styles.wrap}>
          {filters.types.map((v) => (
            <Chip key={v} label={typeLabel(v)} on={selTypes.includes(v)} onPress={() => setSelTypes((s) => toggle(s, v))} />
          ))}
        </View>

        <Text style={[styles.h, { color: c.text }]}>{t.filters.rarities}</Text>
        <View style={styles.wrap}>
          {filters.rarities.map((v) => (
            <Chip key={v} label={v} on={selRarities.includes(v)} onPress={() => setSelRarities((s) => toggle(s, v))} />
          ))}
        </View>

        <Text style={[styles.h, { color: c.text }]}>{t.filters.sets}</Text>
        <Field icon="search" value={setText} onChangeText={setSetText} placeholder={t.filters.setSearch} autoCorrect={false} />
        <View style={styles.wrap}>
          {[...sets.filter((s) => selSets.includes(s.id)), ...visibleSets.filter((s) => !selSets.includes(s.id))].map((s) => (
            <Chip key={s.id} label={s.name} on={selSets.includes(s.id)} onPress={() => setSelSets((x) => toggle(x, s.id))} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: 12 + insets.bottom }]}>
        <Button
          label={t.list.reset}
          variant="ghost"
          style={{ flex: 1 }}
          onPress={() => {
            setSelSets([]);
            setSelTypes([]);
            setSelRarities([]);
          }}
        />
        <Button
          label={total ? `${t.filters.apply} (${total})` : t.filters.apply}
          style={{ flex: 2 }}
          onPress={() => {
            setQuery((q) => ({ ...q, setIds: selSets, types: selTypes, rarities: selRarities }));
            router.back();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 12 },
  h: { fontWeight: "800", fontSize: 16, marginTop: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
