// Pesée — hero poids actuel + delta période, courbe lissée (moyenne mobile 7)
// + brute avec scrubber, ajout rapide, historique avec suppression.
// Le champ "à jeun" n'existe plus (décision verrouillée).
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import { useActiveSession } from "@/lib/activeSession";
import { iso, daysAgo, todayIso, type Any } from "@/core/mylift";
import { formatDate, formatRelative } from "@/lib/format";
import { Segment, Card, Label, SectionLabel, Sheet, ConfirmSheet, Btn, LINE } from "@/ui/kit";
import { IndexChart } from "@/ui/charts";

export default function Pesee() {
  const insets = useSafeAreaInsets();
  const { activeSession } = useActiveSession();
  const bottomPad = 24 + (activeSession ? 64 : 0); // espace pour la bannière séance flottante
  const data = useData();
  const { weights } = data;
  const [period, setPeriod] = useState("90");
  const [addOpen, setAddOpen] = useState(false);
  const [draftWeight, setDraftWeight] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Any | null>(null);

  const periodDays = period === "all" ? 99999 : parseInt(period);
  const cutIso = iso(daysAgo(periodDays));

  const sorted = useMemo(() => [...weights].sort((a, b) => (a.date || "").localeCompare(b.date || "")), [weights]);
  const inPeriod = useMemo(() => sorted.filter((w) => w.date >= cutIso), [sorted, cutIso]);

  // Courbe : brute + moyenne mobile 7 points (style PeseeChart v40)
  const chart = useMemo(() => {
    const raw = inPeriod.map((w) => ({ date: w.date, value: parseFloat(w.weight) }));
    const smooth = raw.map((p, i) => {
      const start = Math.max(0, i - 6);
      const slice = raw.slice(start, i + 1);
      return { date: p.date, value: slice.reduce((a, x) => a + x.value, 0) / slice.length };
    });
    return { raw, smooth };
  }, [inPeriod]);

  const last = sorted.length ? sorted[sorted.length - 1] : null;
  const firstInPeriod = inPeriod.length ? inPeriod[0] : null;
  const delta = last && firstInPeriod ? parseFloat(last.weight) - parseFloat(firstInPeriod.weight) : null;

  const save = async () => {
    const w = parseFloat(draftWeight.replace(",", "."));
    if (isNaN(w) || w <= 0 || w > 400) return;
    await data.addWeight({ date: todayIso(), weight: w, note: draftNote.trim() || null });
    setDraftWeight("");
    setDraftNote("");
    setAddOpen(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: bottomPad }}>
      <View style={{ marginBottom: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>Pesée.</Text>
        <Btn sm onPress={() => setAddOpen(true)}>
          ＋ Ajouter
        </Btn>
      </View>

      {/* Hero */}
      <Card style={{ marginBottom: 12, padding: 20, borderRadius: 22 }}>
        <Label>Poids actuel</Label>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text style={[mono, { fontSize: 44, fontWeight: "900", letterSpacing: -1.5, color: C.ink0 }]}>
              {last ? parseFloat(last.weight).toFixed(1) : "—"}
            </Text>
            <Text style={{ fontSize: 14, color: C.ink2 }}>kg</Text>
          </View>
          {delta !== null && (
            <Text style={[mono, { fontSize: 13, fontWeight: "700", color: delta < 0 ? C.success : delta > 0 ? C.gold : C.ink3 }]}>
              {(delta > 0 ? "+" : "") + delta.toFixed(1)} kg · {period === "all" ? "historique" : periodDays + " j"}
            </Text>
          )}
        </View>
        {last && <Text style={{ fontSize: 12, color: C.ink3, marginBottom: 8 }}>dernière pesée {formatRelative(last.date)}</Text>}
        {chart.smooth.length >= 2 ? (
          <IndexChart raw={chart.raw} smooth={chart.smooth} baseline={null} unit="" />
        ) : (
          <Text style={{ color: C.ink3, textAlign: "center", padding: 20 }}>Pas assez de pesées sur cette période.</Text>
        )}
      </Card>

      <Segment
        value={period}
        onChange={setPeriod}
        options={[
          { value: "30", label: "30J" },
          { value: "90", label: "90J" },
          { value: "365", label: "1A" },
          { value: "all", label: "Tout" },
        ]}
      />

      {/* Historique */}
      {sorted.length > 0 && (
        <>
          <SectionLabel right={`${sorted.length} pesée${sorted.length > 1 ? "s" : ""}`}>Historique</SectionLabel>
          <View style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16, overflow: "hidden" }}>
            {[...sorted].reverse().slice(0, 30).map((w, i, arr) => (
              <View
                key={w.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderBottomWidth: i === arr.length - 1 ? 0 : 1,
                  borderBottomColor: LINE,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[mono, { fontSize: 15, fontWeight: "700", color: C.ink0 }]}>{parseFloat(w.weight).toFixed(1)} kg</Text>
                  <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                    {formatDate(w.date)} · {w.date.slice(0, 4)}
                    {w.note ? " · " + w.note : ""}
                  </Text>
                </View>
                <Pressable onPress={() => setDeleteConfirm(w)} hitSlop={8} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={15} color={C.ink3} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Ajout */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Nouvelle pesée">
        <Label style={{ marginBottom: 8 }}>Poids (kg)</Label>
        <TextInput
          value={draftWeight}
          onChangeText={setDraftWeight}
          keyboardType="decimal-pad"
          placeholder="83.4"
          placeholderTextColor={C.ink3}
          autoFocus
          style={[
            mono,
            {
              backgroundColor: "rgba(255,255,255,.04)",
              borderWidth: 1,
              borderColor: LINE,
              borderRadius: 12,
              color: C.ink0,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 22,
              fontWeight: "800",
              marginBottom: 12,
            },
          ]}
        />
        <Label style={{ marginBottom: 8 }}>Note (optionnel)</Label>
        <TextInput
          value={draftNote}
          onChangeText={setDraftNote}
          placeholder="…"
          placeholderTextColor={C.ink3}
          style={{
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: LINE,
            borderRadius: 12,
            color: C.ink0,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 15,
            marginBottom: 16,
          }}
        />
        <Btn full onPress={save} disabled={!draftWeight || isNaN(parseFloat(draftWeight.replace(",", ".")))}>
          Enregistrer
        </Btn>
      </Sheet>

      <ConfirmSheet
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          await data.deleteWeight(deleteConfirm!.id);
          setDeleteConfirm(null);
        }}
        title="Supprimer cette pesée ?"
        message={deleteConfirm ? `${parseFloat(deleteConfirm.weight).toFixed(1)} kg · ${formatDate(deleteConfirm.date)}` : ""}
      />
    </ScrollView>
  );
}
