// Dashboard — port v40 : hero KPI switchable (persisté sur le device), streak 7j,
// séances, records, tonnage 7j, exo du moment, muscle qui progresse, volume cible
// hebdo, carte Pesée cliquable.
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import {
  progressionSummary,
  muscleIndexSummary,
  periodKPI,
  deltaPct,
  weekActualVolume,
  startOfWeek,
  exoScore,
  daysAgo,
  iso,
  type Any,
} from "@/core/mylift";
import { formatNum, formatDur, formatRelative, formatDate, DOW_FR_S } from "@/lib/format";
import { Sheet, Card, Chip, Label, LINE, ACCENT_WASH, GOLD_WASH, SUCCESS_WASH } from "@/ui/kit";

type KpiDef = { label: string; compute: (ctx: Any) => { big: string; unit: string; sub: string; [k: string]: any } };

// Port fidèle de DASHBOARD_KPIS (v40)
const DASHBOARD_KPIS: Record<string, KpiDef> = {
  surcharge: {
    label: "Surcharge progressive",
    compute: (ctx) => {
      const s = progressionSummary(ctx.journalLogs, ctx.exerciseLib, 28);
      return {
        big: s.up + "/" + s.total,
        unit: "exos en progression",
        sub: s.prs + (s.prs > 1 ? " nouveaux PR" : " PR") + " · " + s.pct + "% du cycle",
        summary: s,
      };
    },
  },
  muscle_progress: {
    label: "Muscle qui progresse le plus",
    compute: (ctx) => {
      const ranked = muscleIndexSummary(ctx.journalLogs, ctx.exerciseLib, 28);
      if (!ranked.length) return { big: "—", unit: "", sub: "Pas assez de données (28j)", ranked: [] };
      const top = ranked[0];
      const sign = top.deltaPct >= 0 ? "+" : "";
      return {
        big: top.muscleGroup,
        unit: sign + top.deltaPct.toFixed(1) + " %",
        sub: top.prs + " PR · " + top.positives + "/" + top.exoCount + " exos en hausse",
        ranked,
      };
    },
  },
  tonnage: {
    label: "Tonnage",
    compute: (ctx) => {
      const k = periodKPI(ctx.journalLogs, 7);
      const dp = deltaPct(k.curr.tonnage, k.prev.tonnage);
      return {
        big: formatNum(k.curr.tonnage / 1000, 1),
        unit: "t · 7j",
        sub: dp !== null ? (dp > 0 ? "▲" : dp < 0 ? "▼" : "") + " " + Math.abs(dp).toFixed(1) + "% vs semaine précédente" : "première semaine",
      };
    },
  },
  score: {
    label: "Score d'entraînement",
    compute: (ctx) => {
      const k = periodKPI(ctx.journalLogs, 7);
      const dp = deltaPct(k.curr.score, k.prev.score);
      return {
        big: formatNum(k.curr.score, 0),
        unit: "points · 7j",
        sub: dp !== null ? (dp > 0 ? "▲" : dp < 0 ? "▼" : "") + " " + Math.abs(dp).toFixed(1) + "% vs semaine précédente" : "première semaine",
      };
    },
  },
  sessions: {
    label: "Séances",
    compute: (ctx) => {
      const k = periodKPI(ctx.journalLogs, 7);
      const freq = ctx.currentProgram?.sessions?.length || 4;
      return {
        big: k.curr.sessions + "",
        unit: "/ " + freq + " · 7j",
        sub: k.curr.sets + " séries · " + formatDur(k.curr.duration),
      };
    },
  },
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useData();
  const { journalLogs, exerciseLib, programs, profile, muscleGroups, weights } = data;

  // Préférence d'affichage : LOCALE au device (décision verrouillée)
  const [heroKpi, setHeroKpi] = useState<string>("surcharge");
  const [kpiPickerOpen, setKpiPickerOpen] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem("mylift_dash_hero").then((v) => {
      if (v && DASHBOARD_KPIS[v]) setHeroKpi(v);
    });
  }, []);
  const pickHero = (k: string) => {
    setHeroKpi(k);
    AsyncStorage.setItem("mylift_dash_hero", k).catch(() => {});
    setKpiPickerOpen(false);
  };

  const currentProgram = useMemo(() => programs.find((p) => p.id === profile?.currentProgramId) || programs[0] || null, [programs, profile]);
  const ctx = { journalLogs, exerciseLib, programs, currentProgram };

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const actualVol = useMemo(() => weekActualVolume(journalLogs, exerciseLib, weekStart), [journalLogs, exerciseLib, weekStart]);
  const weekKPI = useMemo(() => periodKPI(journalLogs, 7), [journalLogs]);
  const hero = DASHBOARD_KPIS[heroKpi].compute(ctx);

  const streak = useMemo(() => {
    const days: Any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const id = iso(d);
      days.push({ iso: id, dow: DOW_FR_S[(d.getDay() + 6) % 7], today: i === 0, done: journalLogs.some((l) => l.date === id) });
    }
    return days;
  }, [journalLogs]);

  const topExo = useMemo(() => {
    const map: Record<string, number> = {};
    weekKPI.rawSessions.forEach((s: Any) =>
      (s.exercises || []).forEach((ex: Any) => {
        const sc = exoScore(ex);
        if (sc > 0) map[ex.exName || "?"] = (map[ex.exName || "?"] || 0) + sc;
      })
    );
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0] || null;
  }, [weekKPI]);

  const lastPR = useMemo(() => {
    const sorted = [...journalLogs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const s of sorted) if (s.prs?.length) return { pr: s.prs[0], date: s.date };
    return null;
  }, [journalLogs]);

  const muscleProgs = useMemo(() => muscleIndexSummary(journalLogs, exerciseLib, 28), [journalLogs, exerciseLib]);

  // Volume cible hebdo
  const volTargets: Record<string, number> = currentProgram?.volumeTargets?.program || {};
  const volEntries: [string, number][] = Object.entries(actualVol).filter(([, v]) => v > 0);
  muscleGroups.forEach((g) => {
    if (volTargets[g] && !actualVol[g]) volEntries.push([g, 0]);
  });
  volEntries.sort((a, b) => {
    const ta = volTargets[a[0]] || 0,
      tb = volTargets[b[0]] || 0;
    if (ta !== tb) return tb - ta;
    return b[1] - a[1];
  });

  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const tonDp = deltaPct(weekKPI.curr.tonnage, weekKPI.prev.tonnage);
  const totalSessions = currentProgram?.sessions?.length || 4;
  const sessPct = Math.min(100, (weekKPI.curr.sessions / totalSessions) * 100);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 40 }}>
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
          <Text style={[mono, { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", color: C.ink3 }]}>
            Cette semaine · {formatDate(iso(weekStart))} → {formatDate(iso(weekEnd))}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>
            {profile?.username ? `Salut ${profile.username}.` : "Ton training."}
          </Text>
          {programs.length > 1 && currentProgram && (
            <Pressable
              onPress={() => {
                const idx = programs.findIndex((p) => p.id === currentProgram.id);
                data.setCurrentProgram(programs[(idx + 1) % programs.length].id);
              }}
            >
              <Chip tone="primary">{currentProgram.name}</Chip>
            </Pressable>
          )}
        </View>
        {journalLogs.length === 0 && <Text style={{ color: C.ink2, fontSize: 14, marginTop: 6 }}>Aucune séance encore. Va au Journal pour démarrer.</Text>}
      </View>

      {/* HERO KPI */}
      <Pressable onPress={() => setKpiPickerOpen(true)}>
        <Card feat style={{ marginBottom: 10, padding: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
              <Label>{DASHBOARD_KPIS[heroKpi].label}</Label>
            </View>
            <Chip>Changer ▾</Chip>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <Text style={[mono, { fontSize: 52, fontWeight: "900", letterSpacing: -2, color: C.ink0, lineHeight: 56 }]}>{hero.big}</Text>
            <Text style={{ fontSize: 16, color: C.ink2, fontWeight: "500" }}>{hero.unit}</Text>
          </View>
          <Text style={{ fontSize: 13, color: C.ink2, marginTop: 8 }}>{hero.sub}</Text>

          {/* Détail surcharge : top 3 progressions */}
          {heroKpi === "surcharge" && hero.summary?.items?.length > 0 && (
            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE, gap: 4 }}>
              {hero.summary.items.slice(0, 3).map((it: Any) => (
                <View key={it.key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: C.ink1, flex: 1, marginRight: 8 }}>
                    {it.name}
                  </Text>
                  <Text style={[mono, { fontSize: 12, fontWeight: "700", color: it.deltaPct > 0 ? C.success : C.ink3 }]}>
                    {(it.deltaPct >= 0 ? "+" : "") + it.deltaPct.toFixed(1)}%{it.hasAllTimePR ? " 🏆" : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {heroKpi === "muscle_progress" && hero.ranked?.length > 1 && (
            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE, gap: 4 }}>
              {hero.ranked.slice(1, 4).map((m: Any) => (
                <View key={m.muscleGroup} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: C.ink1 }}>{m.muscleGroup}</Text>
                  <Text style={[mono, { fontSize: 12, fontWeight: "700", color: m.deltaPct >= 0 ? C.success : C.ink3 }]}>
                    {(m.deltaPct >= 0 ? "+" : "") + m.deltaPct.toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Pressable>

      {/* BENTO */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        {/* Streak */}
        <Card style={{ flex: 1 }}>
          <Label style={{ marginBottom: 8 }}>Streak 7j</Label>
          <Text style={[mono, { fontSize: 28, fontWeight: "800", color: C.ink0 }]}>
            {streak.filter((d) => d.done).length}
            <Text style={{ fontSize: 14, color: C.ink2, fontWeight: "500" }}> / 7</Text>
          </Text>
          <View style={{ flexDirection: "row", gap: 5, marginTop: 10, height: 34, alignItems: "flex-end" }}>
            {streak.map((d) => (
              <View
                key={d.iso}
                style={{
                  flex: 1,
                  height: "100%",
                  borderRadius: 4,
                  backgroundColor: d.done ? C.accent : d.today ? ACCENT_WASH : C.bg3,
                  borderWidth: d.today && !d.done ? 1 : 0,
                  borderColor: "rgba(252,76,2,.5)",
                  borderStyle: "dashed",
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 6 }}>
            {streak.map((d) => (
              <Text key={d.iso} style={{ color: C.ink3, fontSize: 9, fontWeight: "600" }}>
                {d.dow.charAt(0)}
              </Text>
            ))}
          </View>
        </Card>

        {/* Séances */}
        <Card style={{ flex: 1 }}>
          <Label style={{ marginBottom: 8 }}>Séances</Label>
          <Text style={[mono, { fontSize: 20, fontWeight: "800", color: C.ink0 }]}>
            {weekKPI.curr.sessions}
            <Text style={{ fontSize: 14, color: C.ink2, fontWeight: "500" }}> / {totalSessions}</Text>
          </Text>
          <View style={{ height: 6, backgroundColor: C.bg3, borderRadius: 3, overflow: "hidden", marginTop: 10, marginBottom: 8 }}>
            <View style={{ height: "100%", width: `${sessPct}%`, backgroundColor: sessPct >= 100 ? C.gold : C.accent, borderRadius: 3 }} />
          </View>
          <Text style={[mono, { fontSize: 11, color: C.ink3 }]}>{weekKPI.curr.sets} séries</Text>
          <Text style={[mono, { fontSize: 11, color: C.ink3 }]}>{formatDur(weekKPI.curr.duration)}</Text>
        </Card>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        {/* Records */}
        <Card style={{ flex: 1, backgroundColor: "#151020", borderColor: "rgba(255,194,51,.25)" }}>
          <Label style={{ marginBottom: 8, color: C.gold }}>Records</Label>
          <Text style={[mono, { fontSize: 28, fontWeight: "800", color: C.gold }]}>{weekKPI.curr.prs}</Text>
          <Text style={{ fontSize: 12, color: C.ink2, marginTop: 6 }}>
            {weekKPI.curr.prs > 0 ? "cette semaine" : lastPR ? "dernier " + formatRelative(lastPR.date) : "aucun pour le moment"}
          </Text>
        </Card>

        {/* Tonnage 7j */}
        <Card style={{ flex: 1 }}>
          <Label style={{ marginBottom: 8 }}>Tonnage 7j</Label>
          <Text style={[mono, { fontSize: 28, fontWeight: "800", color: C.ink0 }]}>
            {formatNum(weekKPI.curr.tonnage / 1000, 1)}
            <Text style={{ fontSize: 14, color: C.ink2, fontWeight: "500" }}> t</Text>
          </Text>
          <Text style={[mono, { fontSize: 12, fontWeight: "700", marginTop: 6, color: tonDp === null ? C.ink3 : tonDp > 0 ? C.success : C.ink3 }]}>
            {tonDp === null ? "—" : (tonDp > 0 ? "▲ +" : tonDp < 0 ? "▼ " : "") + tonDp.toFixed(1) + "%"}
          </Text>
        </Card>
      </View>

      {/* Exo du moment */}
      {topExo && (
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
            <Label>Exo du moment</Label>
          </View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: C.ink0 }}>{topExo[0]}</Text>
          <Text style={[mono, { fontSize: 13, color: C.ink2, marginTop: 4 }]}>Score {formatNum(topExo[1])} pts</Text>
        </Card>
      )}

      {/* Muscle qui progresse */}
      {muscleProgs.length > 0 && (
        <Pressable onPress={() => router.navigate("/progression")}>
          <Card style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
                <Label>Muscle qui progresse</Label>
              </View>
              <Text style={{ fontSize: 11, color: C.ink3 }}>28 j</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: C.ink0 }}>{muscleProgs[0].muscleGroup}</Text>
                <Text style={[mono, { fontSize: 13, color: C.ink2, marginTop: 4 }]}>
                  {(muscleProgs[0].deltaPct >= 0 ? "+" : "") + muscleProgs[0].deltaPct.toFixed(1)}% · {muscleProgs[0].exoCount} exo
                  {muscleProgs[0].exoCount > 1 ? "s" : ""}
                  {muscleProgs[0].prs > 0 ? " · " + muscleProgs[0].prs + " PR" : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[mono, { fontSize: 24, fontWeight: "800", color: muscleProgs[0].deltaPct >= 0 ? C.success : C.ink3 }]}>
                  {muscleProgs[0].exoCount > 0 ? Math.round((muscleProgs[0].positives / muscleProgs[0].exoCount) * 100) : 0}%
                </Text>
                <Text style={{ fontSize: 11, color: C.ink3 }}>exos en hausse</Text>
              </View>
            </View>
            {muscleProgs.length > 1 && (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE, gap: 4 }}>
                {muscleProgs.slice(1, 4).map((m: Any) => (
                  <View key={m.muscleGroup} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: C.ink1 }}>{m.muscleGroup}</Text>
                    <Text style={[mono, { fontSize: 12, fontWeight: "700", color: m.deltaPct >= 0 ? C.success : C.ink3 }]}>
                      {(m.deltaPct >= 0 ? "+" : "") + m.deltaPct.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Pressable>
      )}

      {/* Volume cible hebdo */}
      {volEntries.length > 0 && (
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
              <Label>Volume cible · hebdo</Label>
            </View>
            <Text style={{ fontSize: 11, color: C.ink3 }}>jour {((new Date().getDay() + 6) % 7) + 1}/7</Text>
          </View>
          <View style={{ gap: 9 }}>
            {volEntries.map(([g, actual]) => {
              const target = volTargets[g] || 0;
              const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
              const color =
                target === 0 ? "#383B4D" : actual >= target ? (actual > target * 1.1 ? C.gold : C.success) : actual >= target * 0.5 ? C.accent : "#383B4D";
              return (
                <View key={g} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text numberOfLines={1} style={{ width: 78, fontSize: 12, fontWeight: "600", color: C.ink1 }}>
                    {g}
                  </Text>
                  <View style={{ flex: 1, height: 6, backgroundColor: C.bg3, borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
                  </View>
                  <Text style={[mono, { width: 52, textAlign: "right", fontSize: 11, fontWeight: "600", color: C.ink2 }]}>
                    <Text style={{ color: C.ink0, fontWeight: "700" }}>{actual}</Text>
                    {target ? " / " + target : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Carte Pesée cliquable */}
      <Pressable onPress={() => router.navigate("/pesee")}>
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Label style={{ marginBottom: 6 }}>Pesée</Label>
              {lastWeight ? (
                <Text style={[mono, { fontSize: 24, fontWeight: "800", color: C.ink0 }]}>
                  {lastWeight.weight}
                  <Text style={{ fontSize: 13, color: C.ink2, fontWeight: "500" }}> kg · {formatRelative(lastWeight.date)}</Text>
                </Text>
              ) : (
                <Text style={{ fontSize: 13, color: C.ink3 }}>Aucune pesée enregistrée</Text>
              )}
            </View>
            <Text style={{ color: C.ink3, fontSize: 18 }}>›</Text>
          </View>
        </Card>
      </Pressable>

      {/* KPI picker */}
      <Sheet open={kpiPickerOpen} onClose={() => setKpiPickerOpen(false)} title="KPI principal">
        <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 14 }}>Choisis le KPI affiché en hero. Les autres restent visibles en cartes.</Text>
        <View style={{ gap: 8 }}>
          {Object.entries(DASHBOARD_KPIS).map(([k, def]) => {
            const active = heroKpi === k;
            const val = def.compute(ctx);
            return (
              <Pressable
                key={k}
                onPress={() => pickHero(k)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: active ? ACCENT_WASH : C.bg3,
                  borderWidth: 1,
                  borderColor: active ? "rgba(252,76,2,.4)" : LINE,
                }}
              >
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: active ? C.accentHi : C.ink0 }}>{def.label}</Text>
                  <Text style={[mono, { fontSize: 12, color: C.ink2, marginTop: 2 }]}>
                    {val.big} {val.unit}
                  </Text>
                </View>
                {active && <Text style={{ color: C.accent, fontSize: 16 }}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </ScrollView>
  );
}
