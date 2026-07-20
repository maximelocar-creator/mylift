// Mise à jour des posts DÉJÀ publiés au nouveau format (KPIs complets,
// détail par exo + machine, % de force / % 30 jours).
// Tourne côté client avec la session de l'utilisateur : chacun ne peut
// réécrire que SES posts (la RLS l'impose, sondée en prod).
// Les logs viennent du miroir local — donc aucun recalcul serveur.
import { supabase } from "./supabase";
import { buildSessionSticker, buildLiftSticker, bestSetOf, machineNameOf } from "./stickerData";
import type { Any } from "../core/mylift";

export async function backfillMyPosts(
  userId: string,
  journalLogs: Any[],
  exerciseLib: Any[]
): Promise<{ updated: number; skipped: number; error: string | null }> {
  let updated = 0;
  let skipped = 0;
  try {
    const { data: posts, error } = await supabase.from("posts").select("id,type,log_id,lift_ref").eq("owner_id", userId).limit(200);
    if (error) return { updated: 0, skipped: 0, error: error.message };

    for (const p of posts ?? []) {
      let next: Any | null = null;

      if (p.type === "session") {
        // Retrouve la séance d'origine dans le journal local
        const log = journalLogs.find((l: Any) => l.id === p.log_id);
        if (!log) {
          skipped++;
          continue;
        }
        const st = buildSessionSticker(log, journalLogs, exerciseLib);
        const prs: Any[] = log.prs || [];
        next = {
          ...(p.lift_ref || {}),
          stats: {
            durationSec: log.durationSec || 0,
            tonnage: st.tonnage,
            prs: prs.length,
            exos: st.exoCount,
            sets: st.setCount,
            strengthPct: st.strengthPct,
          },
          prList: prs.map((pr: Any) => ({
            exName: pr.exName,
            weight: pr.weight,
            reps: pr.reps,
            type: pr.type,
            machineName: machineNameOf({ exId: pr.exId, modelId: pr.modelId }, exerciseLib),
          })),
          exos: st.exos,
        };
      } else if (p.type === "lift") {
        // Pas de log_id sur un lift : on retrouve l'exo par son nom pour
        // recalculer la progression 30 jours (et la machine si identifiable)
        const exName = p.lift_ref?.exName;
        if (!exName) {
          skipped++;
          continue;
        }
        let exId: string | null = null;
        let modelId: string | null = null;
        for (let i = journalLogs.length - 1; i >= 0 && !exId; i--) {
          const found = (journalLogs[i].exercises || []).find((ex: Any) => ex.exName === exName);
          if (found) {
            exId = found.exId ?? null;
            modelId = found.modelId ?? null;
          }
        }
        const st = buildLiftSticker({
          exName,
          exId,
          modelId,
          isPR: !!p.lift_ref?.prType,
          best: { weight: p.lift_ref?.weight ?? 0, reps: p.lift_ref?.reps ?? 0, rir: p.lift_ref?.rir ?? null },
          journalLogs,
          exerciseLib,
        });
        next = { ...(p.lift_ref || {}), machineName: p.lift_ref?.machineName ?? st.machineName, progress30Pct: st.progress30Pct };
      }

      if (!next) {
        skipped++;
        continue;
      }
      const { error: upErr } = await supabase.from("posts").update({ lift_ref: next }).eq("id", p.id);
      if (upErr) skipped++;
      else updated++;
    }
    return { updated, skipped, error: null };
  } catch (e: any) {
    return { updated, skipped, error: e?.message ?? String(e) };
  }
}
