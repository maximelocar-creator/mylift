// Détail exercice — port v40 ExoDetail : chips par modèle + onglet "Tout"
// (indice unifié cross-modèles), courbe e1RM scrubbable, meilleurs poids par
// reps, records de reps par poids, dernières séances.
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { C, mono } from "../lib/theme";
import { useData } from "../lib/store";
import { exoTimeline, exoKeyNoModel, isValidSet, iso, daysAgo, type Any } from "../core/mylift";
import { formatRelative, DOW_FR_S } from "../lib/format";
import { Segment, Card, Chip, Label, SectionLabel, LINE, ACCENT_WASH, GOLD_WASH } from "../ui/kit";
import { E1RMChart, IndexChart } from "../ui/charts";
import { ComposePost, type PostDraft } from "./ComposePost";
import { buildLiftSticker } from "../lib/stickerData";

const MODEL_COLOR_HEX: Record<string, string> = {
  coral: "#FC4C02",
  blue: "#378ADD",
  green: "#639922",
  purple: "#7F77DD",
  amber: "#EF9F27",
  pink: "#D4537E",
  teal: "#1D9E75",
};

export default function ExoDetail({ keyId, onBack }: { keyId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { journalLogs, exerciseLib } = useData();
  const [period, setPeriod] = useState("90");
  const [modelFilter, setModelFilter] = useState<string | null>(null);
  const [liftDraft, setLiftDraft] = useState<PostDraft | null>(null);

  const baseKey = keyId.split("/m:")[0];
  const libEx = exerciseLib.find((l) => "lib:" + l.id === baseKey);
  const libModels = libEx?.models || [];

  const usedModelIds = useMemo(() => {
    const used = new Set<string>();
    journalLogs.forEach((s) =>
      (s.exercises || []).forEach((ex: Any) => {
        if (exoKeyNoModel(ex) === baseKey && (ex.sets || []).some(isValidSet)) used.add(ex.modelId || "none");
      })
    );
    return used;
  }, [journalLogs, baseKey]);

  const visibleModels = libModels.filter((m: Any) => usedModelIds.has(m.id));
  const hasModelChoice = visibleModels.length > 0;

  useEffect(() => {
    if (modelFilter !== null) return;
    if (visibleModels.length > 1) setModelFilter("all");
    else if (visibleModels.length === 1) setModelFilter(visibleModels[0].id);
    else setModelFilter("all");
  }, [modelFilter, visibleModels]);

  const effectiveFilter = modelFilter || "all";
  const timeline = useMemo(() => exoTimeline(journalLogs, baseKey, effectiveFilter), [journalLogs, baseKey, effectiveFilter]);

  const colorForModel = (mid: string | null) => {
    if (mid === null || mid === "none") return "#9CA0B5";
    const m = libModels.find((x: Any) => x.id === mid);
    return MODEL_COLOR_HEX[m?.color || "coral"] || "#FC4C02";
  };

  const name = libEx?.name || timeline[0]?.exName || "?";
  const muscleGroup = libEx?.muscleGroup || "Autre";

  const periodDays = period === "all" ? 99999 : parseInt(period);
  const cutIso = iso(daysAgo(periodDays));
  const filtered = timeline.filter((p) => p.date >= cutIso);

  const current = timeline[timeline.length - 1];
  const first = filtered[0] || current;
  const e1RMDelta = current ? current.e1rm - (first?.e1rm || current.e1rm) : 0;

  // Meilleurs poids par reps (X RM)
  const prsByRep: Record<number, Any> = {};
  timeline.forEach((p) =>
    p.allSets.forEach((s: Any) => {
      if (!prsByRep[s.r] || s.w > prsByRep[s.r].w) prsByRep[s.r] = { w: s.w, r: s.r, date: p.date, modelId: p.modelId };
    })
  );
  const topRanges = [1, 3, 5, 8, 10, 12, 15]
    .filter((r) => prsByRep[r])
    .slice(0, 4)
    .map((r) => prsByRep[r]);

  // Records de reps par poids
  const repPRsByWeight: Record<string, Any> = {};
  timeline.forEach((p) =>
    p.allSets.forEach((s: Any) => {
      const wKey = s.w.toFixed(2);
      if (!repPRsByWeight[wKey] || s.r > repPRsByWeight[wKey].r) repPRsByWeight[wKey] = { w: s.w, r: s.r, date: p.date, modelId: p.modelId };
    })
  );
  const repPRList = Object.values(repPRsByWeight)
    .filter((pr: Any) => pr.r >= 2)
    .sort((a: Any, b: Any) => b.w - a.w);

  // Indice unifié cross-modèles (vue "Tout")
  const indexTimeline = useMemo(() => {
    if (effectiveFilter !== "all") return null;
    const groups: Record<string, Any[]> = {};
    filtered.forEach((p) => {
      const mid = p.modelId || "none";
      if (!groups[mid]) groups[mid] = [];
      groups[mid].push(p);
    });
    const indexByDate: Record<string, number[]> = {};
    Object.values(groups).forEach((arr) => {
      const sorted = [...arr].sort((a, b) => a.date.localeCompare(b.date));
      const base = sorted[0]?.e1rm;
      if (!base || base <= 0) return;
      sorted.forEach((p) => {
        const idx = (p.e1rm / base) * 100;
        if (!indexByDate[p.date]) indexByDate[p.date] = [];
        indexByDate[p.date].push(idx);
      });
    });
    const dates = Object.keys(indexByDate).sort();
    const raw = dates.map((d) => ({ date: d, value: indexByDate[d].reduce((a, x) => a + x, 0) / indexByDate[d].length }));
    const SMOOTH = 7;
    const smooth = raw.map((p, i) => {
      const start = Math.max(0, i - SMOOTH + 1);
      const slice = raw.slice(start, i + 1);
      return { date: p.date, value: slice.reduce((a, x) => a + x.value, 0) / slice.length };
    });
    const finalIndex = smooth.length ? smooth[smooth.length - 1].value : 100;
    return { raw, smooth, finalIndex, deltaPct: finalIndex - 100 };
  }, [effectiveFilter, filtered]);

  const pts = filtered.map((p) => ({ date: p.date, value: p.e1rm, kind: p.kind, isPR: p.isPR, weight: p.weight, reps: p.reps }));
  const showIndexView = effectiveFilter === "all" && visibleModels.length > 1;

  if (!timeline.length && !hasModelChoice) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12 }}>
        <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
          <Ionicons name="chevron-back" size={16} color={C.ink2} />
          <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Progression</Text>
        </Pressable>
        <Text style={{ color: C.ink2, textAlign: "center", padding: 40 }}>Aucune donnée</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
      <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
        <Ionicons name="chevron-back" size={16} color={C.ink2} />
        <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Progression</Text>
      </Pressable>

      <View style={{ marginBottom: 20 }}>
        <Chip>{muscleGroup}</Chip>
        <Text style={{ marginTop: 8, fontSize: 28, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>{name}</Text>
      </View>

      {/* Chips modèles : "Tout" + un par modèle utilisé */}
      {hasModelChoice && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {visibleModels.length > 1 && (
            <Pressable
              onPress={() => setModelFilter("all")}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: effectiveFilter === "all" ? "rgba(252,76,2,.15)" : C.bg3,
                borderWidth: 1,
                borderColor: effectiveFilter === "all" ? "rgba(252,76,2,.4)" : "transparent",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: effectiveFilter === "all" ? C.accentHi : C.ink2 }}>Tout</Text>
            </Pressable>
          )}
          {visibleModels.map((m: Any) => {
            const active = effectiveFilter === m.id;
            const hex = MODEL_COLOR_HEX[m.color || "coral"] || "#FC4C02";
            return (
              <Pressable
                key={m.id}
                onPress={() => setModelFilter(m.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 7,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: active ? hex + "22" : C.bg3,
                  borderWidth: 1,
                  borderColor: active ? hex : "transparent",
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hex }} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: active ? "#fff" : C.ink2 }}>{m.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Hero card : indice % (Tout) ou e1RM kg */}
      <Animated.View entering={FadeInDown.duration(300)}>
      <Card style={{ marginBottom: 12, padding: 20, borderRadius: 22 }}>
        {showIndexView && indexTimeline ? (
          <>
            <Label>Progression · {period === "all" ? "tout l'historique" : periodDays + " jours"}</Label>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text
                  style={[
                    mono,
                    {
                      fontSize: 44,
                      fontWeight: "900",
                      letterSpacing: -1.5,
                      color: indexTimeline.smooth.length >= 2 ? (indexTimeline.deltaPct >= 0 ? C.success : C.ink1) : C.ink3,
                    },
                  ]}
                >
                  {indexTimeline.smooth.length >= 2 ? (indexTimeline.deltaPct >= 0 ? "+" : "") + indexTimeline.deltaPct.toFixed(1) : "—"}
                </Text>
                <Text style={{ fontSize: 14, color: indexTimeline.smooth.length >= 2 && indexTimeline.deltaPct >= 0 ? C.success : C.ink2 }}>%</Text>
              </View>
              {indexTimeline.smooth.length >= 2 && (
                <Text style={[mono, { fontSize: 11, color: C.ink3, fontWeight: "600" }]}>indice {indexTimeline.finalIndex.toFixed(1)}</Text>
              )}
            </View>
            {indexTimeline.smooth.length >= 2 ? (
              <IndexChart raw={indexTimeline.raw} smooth={indexTimeline.smooth} />
            ) : (
              <Text style={{ color: C.ink3, textAlign: "center", padding: 20 }}>Pas assez de séances sur cette période (≥ 2 par modèle).</Text>
            )}
          </>
        ) : (
          <>
            <Label>e1RM · {period === "all" ? "tout l'historique" : periodDays + " jours"}</Label>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={[mono, { fontSize: 44, fontWeight: "900", letterSpacing: -1.5, color: C.ink0 }]}>{(current?.e1rm ?? 0).toFixed(1)}</Text>
                <Text style={{ fontSize: 14, color: C.ink2 }}>kg</Text>
              </View>
              {e1RMDelta !== 0 && (
                <Text style={[mono, { fontSize: 13, fontWeight: "700", color: e1RMDelta > 0 ? C.success : C.danger }]}>
                  {(e1RMDelta > 0 ? "▲ +" : "▼ ") + Math.abs(e1RMDelta).toFixed(1)} kg
                </Text>
              )}
            </View>
            {pts.length > 1 ? <E1RMChart points={pts} /> : <Text style={{ color: C.ink3, textAlign: "center", padding: 20 }}>Moins de 2 séances sur cette période.</Text>}
          </>
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

      {/* Légende */}
      <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap", paddingHorizontal: 4, paddingBottom: 16 }}>
        {[
          [C.gold, "Record"],
          [C.accent, "Progression"],
          ["#9CA0B5", "Stable"],
          ["#696980", "Régression"],
        ].map(([col, lbl]) => (
          <View key={lbl} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: col as string }} />
            <Text style={{ fontSize: 10, color: C.ink3, fontWeight: "600" }}>{lbl}</Text>
          </View>
        ))}
      </View>

      {/* Meilleurs poids par reps */}
      {topRanges.length > 0 && (
        <>
          <SectionLabel>Meilleurs poids par reps</SectionLabel>
          <View style={{ gap: 6 }}>
            {topRanges.map((pr: Any) => {
              const prModelName = pr.modelId && libModels.length > 0 ? libModels.find((m: Any) => m.id === pr.modelId)?.name : null;
              return (
                <View
                  key={pr.r}
                  style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16 }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: GOLD_WASH, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 14 }}>🏆</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Label>{pr.r} RM</Label>
                    <Text style={[mono, { fontSize: 15, fontWeight: "700", color: C.ink0, marginTop: 2 }]}>
                      {pr.w} kg × {pr.r}
                    </Text>
                    {!!prModelName && (
                      <Text numberOfLines={1} style={{ fontSize: 10, color: C.ink3, fontWeight: "600", marginTop: 2 }}>
                        {prModelName}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: C.ink3 }}>{formatRelative(pr.date)}</Text>
                  <Pressable
                    onPress={() =>
                      // Payload lift SANS machine (jamais de modelId/nom de modèle)
                      setLiftDraft({
                        type: "lift",
                        defaultTitle: `${name} · ${pr.w} kg × ${pr.r}`,
                        lift_ref: { exName: name, weight: pr.w, reps: pr.r },
                        sticker: buildLiftSticker({
                          exName: name,
                          exId: baseKey.startsWith("lib:") ? baseKey.slice(4) : null,
                          modelId: modelFilter && modelFilter !== "all" ? modelFilter : null,
                          best: { weight: pr.w, reps: pr.r, rir: null },
                          journalLogs,
                          exerciseLib,
                        }),
                      })
                    }
                    hitSlop={6}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="share-outline" size={16} color={C.ink2} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Records de reps par poids */}
      {repPRList.length > 0 && (
        <>
          <SectionLabel>Records de reps par poids</SectionLabel>
          <View style={{ gap: 6 }}>
            {repPRList.slice(0, 6).map((pr: Any) => {
              const prModelName = pr.modelId && libModels.length > 0 ? libModels.find((m: Any) => m.id === pr.modelId)?.name : null;
              return (
                <View
                  key={pr.w.toFixed(2)}
                  style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16 }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ACCENT_WASH, alignItems: "center", justifyContent: "center" }}>
                    <Text style={[mono, { fontSize: 14, fontWeight: "800", color: C.accentHi }]}>{pr.r}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Label>{pr.w} kg</Label>
                    <Text style={[mono, { fontSize: 15, fontWeight: "700", color: C.ink0, marginTop: 2 }]}>{pr.r} reps</Text>
                    {!!prModelName && (
                      <Text numberOfLines={1} style={{ fontSize: 10, color: C.ink3, fontWeight: "600", marginTop: 2 }}>
                        {prModelName}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: C.ink3 }}>{formatRelative(pr.date)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Dernières séances */}
      <SectionLabel>Dernières séances</SectionLabel>
      <View style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16, overflow: "hidden" }}>
        {timeline
          .slice(-5)
          .reverse()
          .map((p, i, arr) => {
            const modelName = p.modelId && libModels.length > 0 ? libModels.find((m: Any) => m.id === p.modelId)?.name : null;
            return (
              <View
                key={p.sessionId}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  padding: 14,
                  alignItems: "center",
                  borderBottomWidth: i === arr.length - 1 ? 0 : 1,
                  borderBottomColor: LINE,
                }}
              >
                <Text style={[mono, { fontSize: 10, color: C.ink3, fontWeight: "700" }]}>{DOW_FR_S[(new Date(p.date).getDay() + 6) % 7].toUpperCase()}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[mono, { fontSize: 13, color: C.ink0 }]}>
                    {p.allSets.map((s: Any, si: number) => (
                      <Text key={si} style={{ color: s.isAllTimePR || s.isRepPR ? C.gold : C.ink0, fontWeight: s.isAllTimePR || s.isRepPR ? "800" : "600" }}>
                        {si > 0 ? " · " : ""}
                        {s.w}×{s.r}
                        {s.isAllTimePR ? "★" : s.isRepPR ? "✦" : ""}
                      </Text>
                    ))}
                  </Text>
                  <Text style={[mono, { fontSize: 11, color: C.ink2, marginTop: 2 }]}>
                    {p.date} · e1RM {p.e1rm.toFixed(1)} kg{modelName ? " · " + modelName : ""}
                  </Text>
                </View>
                {p.hasAllTimePR ? (
                  <Chip tone="gold">PR</Chip>
                ) : p.hasRepPR ? (
                  <Chip tone="primary">REP</Chip>
                ) : p.kind === "up" ? (
                  <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.success }]}>+{p.delta.toFixed(1)}</Text>
                ) : null}
              </View>
            );
          })}
      </View>

      <ComposePost open={!!liftDraft} onClose={() => setLiftDraft(null)} draft={liftDraft} />
    </ScrollView>
  );
}
