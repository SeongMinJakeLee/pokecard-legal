import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFilters, listSets, type Filters, type SetInfo } from "../src/api/cards";
import { useFilters } from "../src/state/filters";
import { t } from "../src/i18n/ko";

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function FiltersScreen() {
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
      <View style={styles.center}>
        <Text>{t.common.error}</Text>
      </View>
    );
  }
  if (!filters) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h}>{t.filters.types}</Text>
        <View style={styles.wrap}>
          {filters.types.map((v) => (
            <Chip key={v} label={v} on={selTypes.includes(v)} onPress={() => setSelTypes((s) => toggle(s, v))} />
          ))}
        </View>

        <Text style={styles.h}>{t.filters.rarities}</Text>
        <View style={styles.wrap}>
          {filters.rarities.map((v) => (
            <Chip key={v} label={v} on={selRarities.includes(v)} onPress={() => setSelRarities((s) => toggle(s, v))} />
          ))}
        </View>

        <Text style={styles.h}>{t.filters.sets}</Text>
        <TextInput
          value={setText}
          onChangeText={setSetText}
          placeholder={t.filters.setSearch}
          style={styles.input}
          autoCorrect={false}
        />
        <View style={styles.wrap}>
          {[...sets.filter((s) => selSets.includes(s.id)), ...visibleSets.filter((s) => !selSets.includes(s.id))].map((s) => (
            <Chip key={s.id} label={s.name} on={selSets.includes(s.id)} onPress={() => setSelSets((x) => toggle(x, s.id))} />
          ))}
        </View>
      </ScrollView>

        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          style={[styles.footBtn, styles.footGhost]}
          onPress={() => {
            setSelSets([]);
            setSelTypes([]);
            setSelRarities([]);
          }}
        >
          <Text style={styles.footGhostText}>{t.list.reset}</Text>
        </Pressable>
        <Pressable
          style={styles.footBtn}
          onPress={() => {
            setQuery((q) => ({ ...q, setIds: selSets, types: selTypes, rarities: selRarities }));
            router.back();
          }}
        >
          <Text style={styles.footText}>{t.filters.apply}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 10 },
  h: { fontWeight: "700", fontSize: 16, marginTop: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: { borderWidth: 1, borderColor: "#d4d4d8", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#f1f1f4" },
  chipOn: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#333" },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  footer: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  footBtn: { flex: 1, backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  footGhost: { backgroundColor: "#f1f1f4" },
  footText: { color: "#fff", fontWeight: "700" },
  footGhostText: { color: "#333", fontWeight: "600" },
});
