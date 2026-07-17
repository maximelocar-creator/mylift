// Progression (Analyse) — port v40 : segment période, tonnage cumulé + chart,
// surcharge progressive avec toggle Par exercice / Par muscle, détails.
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import { exoKeyNoModel, exoMuscleGroup, iso, daysAgo, type Any } from "@/core/mylift";
import { usePeriodStats } from "@/lib/stats";
import { formatNum } from "@/lib/format";
import { Segment, Card, Chip, Label, SectionLabel, ScreenSkeleton, LINE, GOLD_WASH, ACCENT_WASH, SUCCESS_WASH } from "@/ui/kit";
import { TonnageBars } from "@/ui/charts";

export default function Progression() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { journalLogs, exerciseLib, ready } = useData();
  const [period, setPeriod] = useState("90");
  const [view, setView] = useState<"exos" | "muscles">("exos");
  const setDetailKey = (key: string) => router.push(`/exo/${encodeURIComponent(key)}`);
  const setDetailMuscle = (group: string) => router.push(`/muscle/${encodeURIComponent(group)}?period=${period === "all" ? 99999 : period}`);

  const periodDays = period === "all" ? 99999 : parseInt(period);

  // Un seul point de calcul, partagé avec le Dashboard (src/lib/stats.ts)
  const { summary, muscleRanked, tonnagePts, totalTonnage, tonnageDeltaPct } = usePeriodStats(periodDays);

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

  if (!ready) return <ScreenSkeleton paddingTop={insets.top + 12} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 24 }}>
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
          <Text style={[mono, { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", color: C.ink3 }]}>
            {period === "all" ? "Tout l'historique" : "Derniers " + periodDays + " jours"}
          </Text>
        </View>
        <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>Progression.</Text>
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

      {/* Tonnage */}
      <Card style={{ marginBottom: 10 }}>
        <Label>Tonnage cumulé · {periodLabel}</Label>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4, marginBottom: 4 }}>
          <Text style={[mono, { fontSize: 28, fontWeight: "800", color: C.ink0 }]}>
            {formatNum(totalTonnage / 1000, 1)}
            <Text style={{ fontSize: 14, color: C.ink2, fontWeight: "500" }}> t</Text>
          </Text>
        </View>
        {tonnageDeltaPct !== null && (
          <Text style={[mono, { fontSize: 11, fontWeight: "700", marginBottom: 8, color: tonnageDeltaPct > 0 ? C.success : C.ink3 }]}>
            {(tonnageDeltaPct > 0 ? "▲ +" : tonnageDeltaPct < 0 ? "▼ " : "") + Math.abs(tonnageDeltaPct).toFixed(0)}% vs période précédente
          </Text>
        )}
        {tonnagePts.length > 0 ? (
          <TonnageBars points={tonnagePts} />
        ) : (
          <Text style={{ color: C.ink3, textAlign: "center", padding: 20 }}>Aucune séance sur cette période</Text>
        )}
      </Card>

      {/* Surcharge progressive */}
      <SectionLabel right={`${summary.up}/${summary.total} en progression`}>Surcharge progressive</SectionLabel>

      <Segment
        value={view}
        onChange={setView}
        options={[
          { value: "exos", label: "Par exercice" },
          { value: "muscles", label: "Par muscle" },
        ]}
      />

      {view === "muscles" ? renderMuscles() : renderExos()}
    </ScrollView>
  );
}
