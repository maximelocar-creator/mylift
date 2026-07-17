// Sélecteurs de stats partagés — L'UNIQUE point de calcul pour tout chiffre
// affiché sur le Dashboard ET l'écran Progrès. Chaque agrégat vient d'un seul
// appel à src/core/mylift.ts, mémoïsé ici : un même chiffre ne peut plus être
// recalculé différemment sur deux écrans.
import { useMemo } from "react";
import {
  progressionSummary,
  muscleIndexSummary,
  periodKPI,
  deltaPct,
  weekActualVolume,
  tonnageSession,
  startOfWeek,
  exoScore,
  iso,
  daysAgo,
  type Any,
} from "../core/mylift";
import { DOW_FR_S } from "./format";
import { useData } from "./store";

/** Stats sur une période glissante (28j pour le dashboard, choix libre côté Progrès). */
export function usePeriodStats(periodDays: number) {
  const { journalLogs, exerciseLib } = useData();
  return useMemo(() => {
    const summary = progressionSummary(journalLogs, exerciseLib, periodDays);
    const muscleRanked = muscleIndexSummary(journalLogs, exerciseLib, periodDays);

    const cutIso = iso(daysAgo(periodDays));
    const byDate: Record<string, number> = {};
    journalLogs.forEach((s) => {
      if (s.date < cutIso) return;
      byDate[s.date] = (byDate[s.date] || 0) + tonnageSession(s);
    });
    const tonnagePts = Object.keys(byDate)
      .sort()
      .map((date) => ({ date, value: byDate[date] }));
    const totalTonnage = tonnagePts.reduce((a, p) => a + p.value, 0);

    let prevTonnage: number | null = null;
    if (periodDays < 99999) {
      const cutStart = iso(daysAgo(periodDays * 2));
      prevTonnage = journalLogs.filter((s) => s.date >= cutStart && s.date < cutIso).reduce((a, s) => a + tonnageSession(s), 0);
    }
    const tonnageDeltaPct = prevTonnage !== null && prevTonnage > 0 ? ((totalTonnage - prevTonnage) / prevTonnage) * 100 : null;

    return { summary, muscleRanked, tonnagePts, totalTonnage, prevTonnage, tonnageDeltaPct };
  }, [journalLogs, exerciseLib, periodDays]);
}

/** Stats de la semaine en cours (7j glissants + semaine calendaire pour le volume). */
export function useWeekStats() {
  const { journalLogs, exerciseLib } = useData();
  return useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const weekKPI = periodKPI(journalLogs, 7);
    const actualVol = weekActualVolume(journalLogs, exerciseLib, weekStart);
    const tonnageDeltaPct = deltaPct(weekKPI.curr.tonnage, weekKPI.prev.tonnage);
    const scoreDeltaPct = deltaPct(weekKPI.curr.score, weekKPI.prev.score);

    // Streak 7 derniers jours
    const streak: Any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const id = iso(d);
      streak.push({ iso: id, dow: DOW_FR_S[(d.getDay() + 6) % 7], today: i === 0, done: journalLogs.some((l) => l.date === id) });
    }

    // Exo au meilleur score sur 7j
    const scoreMap: Record<string, number> = {};
    weekKPI.rawSessions.forEach((s: Any) =>
      (s.exercises || []).forEach((ex: Any) => {
        const sc = exoScore(ex);
        if (sc > 0) scoreMap[ex.exName || "?"] = (scoreMap[ex.exName || "?"] || 0) + sc;
      })
    );
    const topExo = Object.entries(scoreMap).sort((a, b) => b[1] - a[1])[0] || null;

    // Dernier PR (tout l'historique)
    let lastPR: Any | null = null;
    const sorted = [...journalLogs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const s of sorted) {
      if (s.prs?.length) {
        lastPR = { pr: s.prs[0], date: s.date };
        break;
      }
    }

    return { weekStart, weekKPI, actualVol, tonnageDeltaPct, scoreDeltaPct, streak, topExo, lastPR };
  }, [journalLogs, exerciseLib]);
}
