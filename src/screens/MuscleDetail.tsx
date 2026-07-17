// Détail muscle — port v40 MuscleDetail : onglets sous-muscles, courbe d'indice
// lissée + brute avec scrubber, stats, liste des exos du muscle (cliquables).
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { C, mono } from "../lib/theme";
import { useData } from "../lib/store";
import { muscleIndexTimeline, exoTimeline, exoMuscleGroup, exoKey, norm, iso, daysAgo, type Any } from "../core/mylift";
import { Segment, Card, Chip, Label, SectionLabel, LINE } from "../ui/kit";
import { IndexChart } from "../ui/charts";

export default function MuscleDetail({
  muscleGroup,
  initialPeriodDays,
  onBack,
  onOpenExo,
}: {
  muscleGroup: string;
  initialPeriodDays: number;
  onBack: () => void;
  onOpenExo: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { journalLogs, exerciseLib, subGroups } = useData();
  const [period, setPeriod] = useState(initialPeriodDays >= 99999 ? "all" : String(initialPeriodDays));
  const periodDaysLocal = period === "all" ? 99999 : parseInt(period);
  const cutIso = iso(daysAgo(periodDaysLocal));
  const [activeSub, setActiveSub] = useState("all");

  // Tous les exos×modèles du muscle dans la période, avec sous-muscle et modèle
  const exoMetaInMuscle = useMemo(() => {
    const out = new Map<string, Any>();
    journalLogs.forEach((s) => {
      if (s.date < cutIso) return;
      (s.exercises || []).forEach((ex: Any) => {
        if (exoMuscleGroup(ex, exerciseLib) !== muscleGroup) return;
        const k = exoKey(ex);
        if (out.has(k)) return;
        let sub: string | null = null;
        if (ex.exId) {
          const L = exerciseLib.find((l) => l.id === ex.exId);
          if (L?.subGroup) sub = L.subGroup;
        }
        if (!sub) {
          const nm = norm(ex.exName || ex.name || "");
          const L = exerciseLib.find((l) => norm(l.name) === nm);
          if (L?.subGroup) sub = L.subGroup;
        }
        let modelName: string | null = null;
        if (ex.modelId && ex.exId) {
          const L = exerciseLib.find((l) => l.id === ex.exId);
          const m = L?.models?.find((mm: Any) => mm.id === ex.modelId);
          if (m) modelName = m.name;
        }
        out.set(k, { key: k, subGroup: sub, name: ex.exName || ex.name || "?", modelId: ex.modelId || null, modelName });
      });
    });
    return [...out.values()];
  }, [journalLogs, exerciseLib, muscleGroup, cutIso]);

  const availableSubs = useMemo(() => {
    const subs = new Set<string>();
    exoMetaInMuscle.forEach((m) => {
      if (m.subGroup) subs.add(m.subGroup);
    });
    const canonical = subGroups?.[muscleGroup] || [];
    const ordered = canonical.filter((s) => subs.has(s));
    const extra = [...subs].filter((s) => !canonical.includes(s));
    return [...ordered, ...extra];
  }, [exoMetaInMuscle, subGroups, muscleGroup]);

  const tl = useMemo(() => {
    const subFilter = activeSub === "all" ? undefined : activeSub;
    return muscleIndexTimeline(journalLogs, exerciseLib, muscleGroup, cutIso, subFilter);
  }, [journalLogs, exerciseLib, muscleGroup, cutIso, activeSub]);

  const totalPRs = useMemo(() => {
    let n = 0;
    exoMetaInMuscle.forEach((m) => {
      const expts = exoTimeline(journalLogs, m.key).filter((p) => p.date >= cutIso);
      n += expts.filter((p) => p.isPR).length;
    });
    return n;
  }, [exoMetaInMuscle, journalLogs, cutIso]);

  const hasData = tl.smooth.length >= 2;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
      <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
        <Ionicons name="chevron-back" size={16} color={C.ink2} />
        <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Progression</Text>
      </Pressable>

      <View style={{ marginBottom: 20 }}>
        <Chip>Muscle</Chip>
        <Text style={{ marginTop: 8, fontSize: 28, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>{muscleGroup}</Text>
      </View>

      {/* Onglets sous-muscles */}
      {availableSubs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
          <Pressable
            onPress={() => setActiveSub("all")}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: activeSub === "all" ? "rgba(252,76,2,.15)" : C.bg3,
              borderWidth: 1,
              borderColor: activeSub === "all" ? "rgba(252,76,2,.4)" : "transparent",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: activeSub === "all" ? C.accentHi : C.ink2 }}>Tout</Text>
          </Pressable>
          {availableSubs.map((sub) => (
            <Pressable
              key={sub}
              onPress={() => setActiveSub(sub)}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: activeSub === sub ? "rgba(252,76,2,.15)" : C.bg3,
                borderWidth: 1,
                borderColor: activeSub === sub ? "rgba(252,76,2,.4)" : "transparent",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: activeSub === sub ? C.accentHi : C.ink2 }}>{sub}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Hero : progression % + courbe */}
      <Animated.View entering={FadeInDown.duration(300)}>
      <Card style={{ marginBottom: 12, padding: 20, borderRadius: 22 }}>
        <Label>Progression · {period === "all" ? "tout l'historique" : periodDaysLocal + " jours"}</Label>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text style={[mono, { fontSize: 44, fontWeight: "900", letterSpacing: -1.5, color: hasData ? (tl.deltaPct >= 0 ? C.success : C.ink1) : C.ink3 }]}>
              {hasData ? (tl.deltaPct >= 0 ? "+" : "") + tl.deltaPct.toFixed(1) : "—"}
            </Text>
            <Text style={{ fontSize: 14, color: hasData && tl.deltaPct >= 0 ? C.success : C.ink2 }}>%</Text>
          </View>
          {hasData && <Text style={[mono, { fontSize: 11, color: C.ink3, fontWeight: "600" }]}>indice {tl.finalIndex.toFixed(1)}</Text>}
        </View>
        {hasData ? (
          <IndexChart raw={tl.raw} smooth={tl.smooth} />
        ) : (
          <Text style={{ color: C.ink3, textAlign: "center", padding: 20 }}>
            {tl.raw.length === 0 ? "Aucune séance sur cette période." : "Pas assez de séances sur les mêmes exos (≥ 2 par exo×modèle)."}
          </Text>
        )}
      </Card>
      </Animated.View>

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

      {/* Stats */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {[
          ["Exos × modèles", tl.exoCount],
          ["Records", totalPRs],
          ["En hausse", tl.positives],
        ].map(([l, v]) => (
          <View key={l as string} style={{ flex: 1, padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16 }}>
            <Label>{l}</Label>
            <Text style={[mono, { fontSize: 20, fontWeight: "800", color: C.ink0, marginTop: 4 }]}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Exos du muscle */}
      {exoMetaInMuscle.length > 0 && (
        <>
          <SectionLabel>{activeSub === "all" ? "Exercices de ce muscle" : "Exercices · " + activeSub}</SectionLabel>
          <View style={{ gap: 6 }}>
            {exoMetaInMuscle
              .filter((m) => activeSub === "all" || m.subGroup === activeSub)
              .map((m) => {
                const expts = exoTimeline(journalLogs, m.key).filter((p) => p.date >= cutIso);
                if (expts.length === 0) return null;
                const last = expts[expts.length - 1];
                const first = expts[0];
                const delta = expts.length > 1 ? last.e1rm - first.e1rm : 0;
                const hasPR = expts.some((p) => p.isPR);
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => onOpenExo(m.key)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                      padding: 12,
                      backgroundColor: pressed ? "#1F1F33" : C.bg2,
                      borderWidth: 1,
                      borderColor: LINE,
                      borderRadius: 16,
                    })}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>
                        {m.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                        {(m.modelName ? m.modelName + " · " : "") + (m.subGroup ? m.subGroup + " · " : "") + expts.length} séance{expts.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    {hasPR ? (
                      <Chip tone="gold">PR</Chip>
                    ) : (
                      <Text style={[mono, { fontSize: 13, fontWeight: "800", color: delta > 0 ? C.success : C.ink3 }]}>
                        {expts.length > 1 ? (delta > 0 ? "+" : "") + delta.toFixed(1) + " kg" : "—"}
                      </Text>
                    )}
                    <Ionicons name="chevron-forward" size={14} color={C.ink3} />
                  </Pressable>
                );
              })}
          </View>
        </>
      )}
    </ScrollView>
  );
}
