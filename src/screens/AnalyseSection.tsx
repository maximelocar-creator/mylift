// Progression (Analyse) — port v40 : segment période, tonnage cumulé + chart,
// surcharge progressive avec toggle Par exercice / Par muscle, détails.
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, mono } from "../lib/theme";
import { useData } from "../lib/store";
import { useActiveSession } from "../lib/activeSession";
import { exoKeyNoModel, exoMuscleGroup, iso, daysAgo, type Any } from "../core/mylift";
import { usePeriodStats } from "../lib/stats";
import { formatNum } from "../lib/format";
import { Segment, Card, Chip, Label, SectionLabel, ScreenSkeleton, SyncDot, LINE, GOLD_WASH, ACCENT_WASH, SUCCESS_WASH } from "../ui/kit";
import { TonnageBars } from "../ui/charts";
import Animated, { FadeIn } from "react-native-reanimated";

export default function AnalyseSection() {
  const insets = useSafeAreaInsets();
  const { activeSession } = useActiveSession();
  const bottomPad = 24 + (activeSession ? 64 : 0); // espace pour la bannière séance flottante
  const router = useRouter();
  const { journalLogs, exerciseLib, ready } = useData();
  const [period, setPeriod] = useState("90");
  const [view, setView] = useState<"exos" | "muscles">("exos");
  const setDetailKey = (key: string) => router.push(`/exo/${encodeURIComponent(key)}`);
  const setDetailMuscle = (group: string) => router.push(`/muscle/${encodeURIComponent(group)}?period=${period === "all" ? 99999 : period}`);

  const periodDays = period === "all" ? 99999 : parseInt(period);

  // Un seul point de calcul, partagé avec le Dashboard (src/lib/stats.ts)
  const { summary, muscleRanked } = usePeriodStats(periodDays);

  const periodLabel =
    period === "7" ? "7 jours" : period === "30" ? "30 jours" : period === "90" ? "90 jours" : period === "365" ? "1 an" : "tout l'historique";

  /* Liste par muscle */
  const renderMuscles = () => {
    const muscleProgs = muscleRanked;
    if (muscleProgs.length === 0) {
      return (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>💪</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink2 }}>Pas assez de données</Text>
          <Text style={{ fontSize: 13, color: C.ink3, marginTop: 4, textAlign: "center" }}>Fais au moins 2 séances sur les mêmes exos par muscle.</Text>
        </View>
      );
    }
    const maxAbs = Math.max(...muscleProgs.map((m: Any) => Math.abs(m.deltaPct)), 1);
    return (
      <View style={{ gap: 6 }}>
        {muscleProgs.map((m: Any) => {
          const pos = m.deltaPct >= 0;
          const w = Math.min(100, (Math.abs(m.deltaPct) / maxAbs) * 100);
          return (
            <Pressable
              key={m.muscleGroup}
              onPress={() => setDetailMuscle(m.muscleGroup)}
              style={({ pressed }) => ({
                padding: 13,
                backgroundColor: pressed ? "#1F1F33" : C.bg2,
                borderWidth: 1,
                borderColor: LINE,
                borderRadius: 16,
              })}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink0 }}>{m.muscleGroup}</Text>
                  <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                    {m.exoCount} exo{m.exoCount > 1 ? "s" : ""} · {m.positives} en hausse
                    {m.prs > 0 ? " · " + m.prs + " PR" : ""}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[mono, { fontSize: 16, fontWeight: "800", color: pos ? C.success : C.ink3 }]}>
                      {(pos ? "+" : "") + m.deltaPct.toFixed(1)}%
                    </Text>
                    <Text style={{ fontSize: 9, color: C.ink3, marginTop: 2 }}>progression · {periodLabel}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.ink3} />
                </View>
              </View>
              <View style={{ height: 6, backgroundColor: C.bg3, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${w}%`, backgroundColor: pos ? C.success : "#777", borderRadius: 3 }} />
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  /* Liste par exercice */
  const renderExos = () => {
    const cutIso = iso(daysAgo(periodDays));
    const usedKeys = new Set<string>();
    const keyMeta: Record<string, Any> = {};
    journalLogs.forEach((s) => {
      if (s.date < cutIso) return;
      (s.exercises || []).forEach((ex: Any) => {
        const k = exoKeyNoModel(ex);
        usedKeys.add(k);
        if (!keyMeta[k]) {
          keyMeta[k] = { name: ex.exName || "?", muscleGroup: exoMuscleGroup(ex, exerciseLib), count: 0, lastDate: "" };
        }
        keyMeta[k].count++;
        if (!keyMeta[k].lastDate || s.date > keyMeta[k].lastDate) keyMeta[k].lastDate = s.date;
      });
    });
    const withDeltaKeys = new Set(summary.items.map((i: Any) => i.key));
    const noDelta = [...usedKeys].filter((k) => !withDeltaKeys.has(k)).map((k) => ({ key: k, noDelta: true, ...keyMeta[k] }));

    if (summary.items.length === 0 && noDelta.length === 0) {
      return (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🏋️</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink2 }}>Pas de données</Text>
          <Text style={{ fontSize: 13, color: C.ink3, marginTop: 4 }}>Aucun exercice travaillé sur cette période.</Text>
        </View>
      );
    }

    const renderRow = (it: Any) => {
      const iconBox = (bg: string, node: React.ReactNode) => (
        <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: bg }}>{node}</View>
      );
      let icon;
      if (it.noDelta) icon = iconBox(C.bg3, <Ionicons name="barbell-outline" size={16} color={C.ink3} />);
      else if (it.hasAllTimePR) icon = iconBox(GOLD_WASH, <Text style={{ fontSize: 15 }}>🏆</Text>);
      else if (it.hasRepPRonly) icon = iconBox(ACCENT_WASH, <Text style={{ fontSize: 15 }}>🏆</Text>);
      else if (it.kind === "up") icon = iconBox(SUCCESS_WASH, <Ionicons name="trending-up" size={16} color={C.success} />);
      else if (it.kind === "down") icon = iconBox(C.bg3, <Ionicons name="chevron-down" size={16} color={C.ink3} />);
      else icon = iconBox(C.bg3, <Ionicons name="barbell-outline" size={16} color={C.ink3} />);

      return (
        <Pressable
          key={it.key}
          onPress={() => setDetailKey(it.key)}
          style={({ pressed }) => ({
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            padding: 13,
            backgroundColor: pressed ? "#1F1F33" : C.bg2,
            borderWidth: 1,
            borderColor: LINE,
            borderRadius: 16,
            marginBottom: 6,
            opacity: it.noDelta ? 0.65 : 1,
          })}
        >
          {icon}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>
              {it.name}
            </Text>
            <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
              {it.noDelta
                ? (it.muscleGroup || "—") + " · 1 séance"
                : `${it.muscleGroup} · ${it.count} séances · top ${it.lastWeight} × ${it.lastReps}`}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {it.noDelta ? (
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink3 }}>—</Text>
            ) : (
              <Text style={[mono, { fontSize: 13, fontWeight: "800", color: it.deltaPct > 0 ? C.success : C.ink3 }]}>
                {(it.deltaPct >= 0 ? "+" : "") + it.deltaPct.toFixed(1)}%
              </Text>
            )}
            <Text style={{ fontSize: 9, color: C.ink3, marginTop: 2 }}>{it.noDelta ? "pas de delta" : "progression · " + periodLabel}</Text>
          </View>
        </Pressable>
      );
    };

    return (
      <View>
        {summary.items.map(renderRow)}
        {noDelta.length > 0 && (
          <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: C.ink3, fontWeight: "600" }}>
            Exercices à 1 seule séance (pas de delta)
          </Text>
        )}
        {noDelta.map(renderRow)}
      </View>
    );
  };

  return (
    <View>
      {/* En-tête de section (le titre d'écran est porté par l'onglet Stats) */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 26, paddingBottom: 12, paddingHorizontal: 4 }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
        <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 1.3, textTransform: "uppercase", color: C.ink3 }}>Analyse</Text>
        <Text style={[mono, { marginLeft: "auto", fontSize: 11, fontWeight: "600", color: C.ink3 }]}>
          {period === "all" ? "tout l'historique" : periodDays + " jours"}
        </Text>
      </View>

      <Segment
        value={period}
        onChange={setPeriod}
        options={[
          { value: "7", label: "7J" },
          { value: "30", label: "30J" },
          { value: "90", label: "90J" },
          { value: "365", label: "1A" },
          { value: "all", label: "Tout" },
        ]}
      />

      {/* Surcharge progressive (tonnage retiré de cette vue — demande Maxime,
          il reste visible sur le Dashboard) */}
      <SectionLabel right={`${summary.up}/${summary.total} en progression`}>Surcharge progressive</SectionLabel>

      <Segment
        value={view}
        onChange={setView}
        options={[
          { value: "exos", label: "Par exercice" },
          { value: "muscles", label: "Par muscle" },
        ]}
      />

      <Animated.View key={view} entering={FadeIn.duration(200)}>
        {view === "muscles" ? renderMuscles() : renderExos()}
      </Animated.View>
    </View>
  );
}
