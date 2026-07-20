// Composition de post (Phase 3) — opt-in, jamais automatique.
// Type "séance" (depuis le récap : UN SEUL post, PR(s) valorisés dedans —
// décision Maxime) ou "lift" (PR isolé, ex. depuis ExoDetail).
// Photo : appareil OU galerie, pipeline image partagé (1080px JPEG, repli
// data-URI). Après publication : export Instagram (story/post) — image générée
// client à la DA MyLift (tokens theme.ts), partagée via le share sheet iOS.
// MACHINES : décision Maxime (20/07/2026) — le nom de la machine est
// désormais inclus dans les posts du feed (la TABLE exercise_models reste
// privée en base ; c'est le nom, recopié dans un post publié volontairement,
// qui devient visible par les amis).
import { useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { C, L, mono } from "../lib/theme";
import { haptic } from "../lib/haptics";
import { shareStickerToInstagramStories } from "../lib/instagram";
import { useData } from "../lib/store";
import * as social from "../db/social";
import { pickFromLibrary, takePhoto, uploadImage, type PickedImage } from "../lib/images";
import { Sheet, Btn, Label, Chip, afterSheetClose } from "../ui/kit";
import { formatDur, formatNum } from "../lib/format";
import { Sparkline } from "../ui/Sparkline";
import { buildSessionSticker, buildLiftSticker, bestSetOf, machineNameOf, type SessionSticker, type LiftSticker, type CurvePoint } from "../lib/stickerData";
import type { Any } from "../core/mylift";

export type PostDraft = {
  type: "lift" | "session";
  defaultTitle: string;
  log_id?: string | null;
  // lift : {exName, weight, reps, prType?} · séance : {stats:{durationSec,tonnage,prs}, prList:[{exName,weight,reps,type}]}
  lift_ref: Any;
  // Données RICHES pour le sticker Instagram (machine, détail par exo,
  // courbes). LOCALES : jamais transmises à createPost, donc les machines
  // ne fuitent pas dans le feed.
  sticker?: SessionSticker | LiftSticker | null;
};

const inputStyle = {
  backgroundColor: "rgba(255,255,255,.04)",
  borderWidth: 1,
  borderColor: L.line,
  borderRadius: 12,
  color: C.ink0,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
} as const;

/* Visuel d'export Instagram — DA MyLift, uniquement des tokens du thème. */
function ShareCard({ draft, title, story, shotRef }: { draft: PostDraft; title: string; story: boolean; shotRef: any }) {
  const lift = draft.type === "lift" ? draft.lift_ref : null;
  const stats = draft.type === "session" ? draft.lift_ref?.stats : null;
  const prList: Any[] = draft.type === "session" ? (draft.lift_ref?.prList ?? []) : [];
  const W = 360;
  const H = story ? 640 : 360;
  return (
    <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }} style={{ position: "absolute", left: -9999, width: W, height: H }}>
      <View style={{ width: W, height: H, backgroundColor: C.bg0, padding: 28, justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: C.ink0, fontSize: 22, fontWeight: "900", letterSpacing: -0.8 }}>
            My<Text style={{ color: C.accent }}>Lift</Text>
          </Text>
          <View style={{ width: 44, height: 4, backgroundColor: C.accent, borderRadius: 2, marginTop: 10 }} />
        </View>
        <View>
          <Text style={{ color: C.ink2, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
            {draft.type === "lift" ? "Nouveau record" : "Séance terminée"}
          </Text>
          <Text style={{ color: C.ink0, fontSize: story ? 28 : 24, fontWeight: "900", letterSpacing: -0.8, lineHeight: story ? 33 : 28 }} numberOfLines={3}>
            {title}
          </Text>
          {lift && (
            <Text style={[mono, { color: C.gold, fontSize: story ? 44 : 36, fontWeight: "900", letterSpacing: -1.5, marginTop: 14 }]}>
              {lift.weight} kg × {lift.reps}
            </Text>
          )}
          {lift && <Text style={{ color: C.ink1, fontSize: 15, fontWeight: "600", marginTop: 4 }}>{lift.exName}</Text>}
          {stats && (
            <View style={{ flexDirection: "row", gap: 18, marginTop: 16 }}>
              {!!stats.durationSec && (
                <View>
                  <Text style={[mono, { color: C.ink0, fontSize: 22, fontWeight: "800" }]}>{formatDur(stats.durationSec)}</Text>
                  <Text style={{ color: C.ink3, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>durée</Text>
                </View>
              )}
              {!!stats.tonnage && (
                <View>
                  <Text style={[mono, { color: C.ink0, fontSize: 22, fontWeight: "800" }]}>{formatNum(stats.tonnage / 1000, 1)} t</Text>
                  <Text style={{ color: C.ink3, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>volume</Text>
                </View>
              )}
              {!!stats.prs && (
                <View>
                  <Text style={[mono, { color: C.gold, fontSize: 22, fontWeight: "800" }]}>{stats.prs}</Text>
                  <Text style={{ color: C.gold, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>PR{stats.prs > 1 ? "s" : ""}</Text>
                </View>
              )}
            </View>
          )}
          {prList.length > 0 && (
            <View style={{ marginTop: 14, gap: 4 }}>
              {prList.slice(0, 3).map((pr, i) => (
                <Text key={i} style={[mono, { color: C.gold, fontSize: 14, fontWeight: "800" }]}>
                  🏆 {pr.exName} · {pr.weight}×{pr.reps}
                </Text>
              ))}
            </View>
          )}
        </View>
        <Text style={{ color: C.ink3, fontSize: 11, fontWeight: "600" }}>Suivi de progression · mylift</Text>
      </View>
    </ViewShot>
  );
}

/* Sticker story Instagram — PNG TRANSPARENT posé sur la photo de
   l'utilisateur (obligatoire pour la story). Contenu défini par Maxime :
   marque + haltère, trait orange, puis le détail de la séance ou du lift,
   la note saisie si elle existe, et une courbe de progression orange. */
const S_W = 380;
const S_PAD_OUT = 10;
const S_PAD_CARD = 22;
const S_CONTENT = S_W - S_PAD_OUT * 2 - S_PAD_CARD * 2; // largeur utile réelle

function StickerHeader() {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="barbell" size={22} color={C.accent} />
        <Text style={{ color: C.ink0, fontSize: 19, fontWeight: "900", letterSpacing: -0.7 }}>
          My<Text style={{ color: C.accent }}>Lift</Text>
        </Text>
      </View>
      <View style={{ height: 3, backgroundColor: C.accent, borderRadius: 2, marginTop: 10, marginBottom: 14 }} />
    </View>
  );
}

const kickerStyle = { color: C.accentHi, fontSize: 10.5, fontWeight: "800" as const, textTransform: "uppercase" as const, letterSpacing: 2 };

function StickerNote({ text }: { text?: string | null }) {
  if (!text?.trim()) return null;
  return (
    <Text numberOfLines={3} style={{ color: C.ink1, fontSize: 12.5, fontStyle: "italic", lineHeight: 17, marginTop: 12 }}>
      « {text.trim()} »
    </Text>
  );
}

function StickerCurve({ points, label }: { points: CurvePoint[]; label: string }) {
  if (!points || points.length < 2) return null;
  return (
    <View style={{ marginTop: 14 }}>
      <Sparkline points={points} width={S_CONTENT} height={52} />
      {!!label && (
        <Text style={[mono, { color: C.accentHi, fontSize: 11, fontWeight: "800", marginTop: 4 }]}>{label}</Text>
      )}
    </View>
  );
}

function StickerCard({ draft, title, note, shotRef }: { draft: PostDraft; title: string; note?: string | null; shotRef: any }) {
  const st = draft.sticker;
  const session = st?.kind === "session" ? st : null;
  const lift = st?.kind === "lift" ? st : null;
  // Repli si les données riches manquent (ancien chemin)
  const rawLift = draft.type === "lift" ? draft.lift_ref : null;

  return (
    <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }} style={{ position: "absolute", left: -9999, width: S_W }}>
      {/* Racine SANS fond → PNG transparent posé sur la photo */}
      <View style={{ width: S_W, backgroundColor: "transparent", padding: S_PAD_OUT }}>
        <View style={{ backgroundColor: L.scrimStrong, borderRadius: 26, padding: S_PAD_CARD, borderWidth: 1, borderColor: L.lineStrong }}>
          <StickerHeader />

          {/* ---------- SÉANCE ---------- */}
          {session && (
            <>
              <Text style={kickerStyle}>Séance terminée</Text>
              <Text numberOfLines={2} style={{ color: C.ink0, fontSize: 24, fontWeight: "900", letterSpacing: -0.8, lineHeight: 27, marginTop: 4 }}>
                {session.sessionName}
              </Text>

              {/* Durée / volume / PR */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14, rowGap: 10 }}>
                {[
                  { v: formatDur(session.durationSec), l: "durée", gold: false },
                  { v: `${formatNum(session.tonnage / 1000, 1)} t`, l: "volume", gold: false },
                  { v: String(session.exoCount), l: "exos", gold: false },
                  { v: String(session.setCount), l: "séries", gold: false },
                  { v: String(session.prCount), l: session.prCount > 1 ? "PRs" : "PR", gold: session.prCount > 0 },
                ].map((k, i) => (
                  <View key={i} style={{ width: "33.3%" }}>
                    <Text style={[mono, { color: k.gold ? C.gold : C.ink0, fontSize: 19, fontWeight: "800" }]}>{k.v}</Text>
                    <Text style={{ color: k.gold ? C.gold : C.ink2, fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
                      {k.l}
                    </Text>
                  </View>
                ))}
              </View>

              {/* PRs détaillés */}
              {session.prList.length > 0 && (
                <View style={{ marginTop: 12, gap: 3 }}>
                  {session.prList.slice(0, 3).map((pr: Any, i: number) => (
                    <Text key={i} style={[mono, { color: C.gold, fontSize: 12, fontWeight: "800" }]}>
                      ★ {pr.exName} · {pr.weight} kg × {pr.reps}
                    </Text>
                  ))}
                </View>
              )}

              {/* Détail par exo : nom / machine / séries / meilleure série */}
              <View style={{ marginTop: 14, gap: 7 }}>
                {session.exos.map((e, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: C.ink0, fontSize: 12.5, fontWeight: "700" }}>
                        {e.exName}
                      </Text>
                      {!!e.machineName && (
                        <Text numberOfLines={1} style={{ color: C.ink2, fontSize: 10.5, marginTop: 1 }}>
                          {e.machineName}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {!!e.best && (
                        <Text style={[mono, { color: C.ink1, fontSize: 12, fontWeight: "800" }]}>
                          {e.best.reps} × {e.best.weight} kg
                          {e.best.rir !== null ? ` · RIR ${e.best.rir}` : ""}
                        </Text>
                      )}
                      <Text style={[mono, { color: C.ink3, fontSize: 10 }]}>
                        {e.sets} série{e.sets > 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <StickerNote text={note} />
              <StickerCurve points={session.curve} label={session.curveLabel} />
            </>
          )}

          {/* ---------- LIFT ---------- */}
          {lift && (
            <>
              <Text style={[kickerStyle, lift.isPR ? { color: C.gold } : null]}>{lift.isPR ? "Nouveau record" : "Performance"}</Text>
              <Text numberOfLines={2} style={{ color: C.ink0, fontSize: 24, fontWeight: "900", letterSpacing: -0.8, lineHeight: 27, marginTop: 4 }}>
                {lift.exName}
              </Text>
              {!!lift.machineName && <Text style={{ color: C.ink2, fontSize: 12.5, marginTop: 2 }}>{lift.machineName}</Text>}
              <Text style={[mono, { color: C.gold, fontSize: 34, fontWeight: "900", letterSpacing: -1.2, marginTop: 12 }]}>
                {lift.best.reps} × {lift.best.weight} kg
              </Text>
              {lift.best.rir !== null && (
                <Text style={[mono, { color: C.ink2, fontSize: 12.5, fontWeight: "700", marginTop: 2 }]}>RIR {lift.best.rir}</Text>
              )}
              <StickerNote text={note} />
              <StickerCurve points={lift.curve} label={lift.curveLabel} />
            </>
          )}

          {/* ---------- Repli (données riches absentes) ---------- */}
          {!session && !lift && (
            <>
              <Text style={kickerStyle}>{draft.type === "lift" ? (draft.lift_ref?.prType ? "Nouveau record" : "Performance") : "Séance terminée"}</Text>
              <Text numberOfLines={2} style={{ color: C.ink0, fontSize: 22, fontWeight: "900", letterSpacing: -0.7, lineHeight: 26, marginTop: 4 }}>
                {title}
              </Text>
              {rawLift && (
                <Text style={[mono, { color: C.gold, fontSize: 32, fontWeight: "900", letterSpacing: -1.2, marginTop: 10 }]}>
                  {rawLift.reps} × {rawLift.weight} kg
                </Text>
              )}
              <StickerNote text={note} />
            </>
          )}
        </View>
      </View>
    </ViewShot>
  );
}

/* Construit le brouillon "séance complète" d'un log.
   lift_ref (envoyé au serveur) reste SANS machine ; les données riches du
   sticker (machines, détail par exo, courbe) restent locales. */
export function sessionDraftOf(log: Any, journalLogs?: Any[], exerciseLib?: Any[]): PostDraft {
  const prs: Any[] = log.prs || [];
  const ton = (log.exercises || []).reduce(
    (a: number, ex: Any) => a + (ex.sets || []).reduce((b: number, s: Any) => b + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0),
    0
  );
  return {
    type: "session",
    log_id: log.id,
    defaultTitle: `Séance ${log.sessionName || ""}`.trim() + (prs.length ? ` · ${prs.length} PR${prs.length > 1 ? "s" : ""}` : ""),
    lift_ref: {
      stats: { durationSec: log.durationSec || 0, tonnage: ton, prs: prs.length },
      prList: prs.map((pr: Any) => ({
        exName: pr.exName,
        weight: pr.weight,
        reps: pr.reps,
        type: pr.type,
        machineName: exerciseLib ? machineNameOf({ exId: pr.exId, modelId: pr.modelId }, exerciseLib) : null,
      })),
      // Détail par exo (nom, machine, séries, meilleure série) — même contenu
      // que le sticker, désormais visible dans le feed
      exos: journalLogs && exerciseLib ? buildSessionSticker(log, journalLogs, exerciseLib).exos : [],
    },
    sticker: journalLogs && exerciseLib ? buildSessionSticker(log, journalLogs, exerciseLib) : null,
  };
}

/* Point d'entrée de partage d'une séance (récap de fin OU journal) :
   choix « séance complète » ou « un lift précis » (meilleure série de chaque
   exo, PR signalé). Une seule Sheet dont le contenu commute (jamais deux
   Modals swappées), puis ComposePost s'ouvre via afterSheetClose. */
export function ShareSessionSheet({ log, open, onClose }: { log: Any | null; open: boolean; onClose: () => void }) {
  const { journalLogs, exerciseLib } = useData();
  const [mode, setMode] = useState<"choose" | "lift">("choose");
  const [draft, setDraft] = useState<PostDraft | null>(null);

  const candidates: Any[] = (log?.exercises || [])
    .map((ex: Any) => {
      const sets = (ex.sets || []).filter((s: Any) => (parseFloat(s.weight) || 0) > 0 && (parseInt(s.reps) || 0) > 0);
      if (!sets.length) return null;
      const best = sets.reduce((a: Any, b: Any) =>
        parseFloat(b.weight) > parseFloat(a.weight) || (parseFloat(b.weight) === parseFloat(a.weight) && parseInt(b.reps) > parseInt(a.reps)) ? b : a
      );
      const w = parseFloat(best.weight);
      const r = parseInt(best.reps);
      const pr = (log?.prs || []).find((p: Any) => p.exName === ex.exName && parseFloat(p.weight) === w);
      return { exName: ex.exName, weight: w, reps: r, prType: pr?.type ?? null, exId: ex.exId ?? null, modelId: ex.modelId ?? null, ex };
    })
    .filter(Boolean);

  const pick = (d: PostDraft) => {
    onClose();
    haptic("light");
    afterSheetClose(() => setDraft(d));
  };

  const closeChooser = () => {
    setMode("choose");
    onClose();
  };

  return (
    <>
      <Sheet open={open} onClose={closeChooser} title={mode === "choose" ? "Partager" : "Choisir le lift"}>
        {mode === "choose" ? (
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => log && pick(sessionDraftOf(log, journalLogs, exerciseLib))}
              style={({ pressed }) => ({ padding: 16, borderRadius: 14, backgroundColor: pressed ? L.bgHover : C.bg3, borderWidth: 1, borderColor: L.line })}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: C.ink0 }}>Séance complète</Text>
              <Text style={{ fontSize: 12, color: C.ink2, marginTop: 3, lineHeight: 17 }}>
                Durée, volume et PRs mis en avant dans un seul post.
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!candidates.length) {
                  haptic("warning");
                  return;
                }
                setMode("lift");
                haptic("light");
              }}
              style={({ pressed }) => ({
                padding: 16,
                borderRadius: 14,
                backgroundColor: pressed ? L.bgHover : C.bg3,
                borderWidth: 1,
                borderColor: L.line,
                opacity: candidates.length ? 1 : 0.5,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: C.ink0 }}>Un lift précis</Text>
              <Text style={{ fontSize: 12, color: C.ink2, marginTop: 3, lineHeight: 17 }}>
                Mets en avant une seule perf (meilleure série d'un exo).
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {candidates.map((c: Any, i: number) => (
              <Pressable
                key={i}
                onPress={() =>
                  pick({
                    type: "lift",
                    defaultTitle: `${c.exName} · ${c.weight} kg × ${c.reps}`,
                    lift_ref: {
                      exName: c.exName,
                      weight: c.weight,
                      reps: c.reps,
                      machineName: machineNameOf(c.ex, exerciseLib),
                      rir: bestSetOf(c.ex)?.rir ?? null,
                      ...(c.prType ? { prType: c.prType } : {}),
                    },
                    sticker: buildLiftSticker({
                      exName: c.exName,
                      exId: c.exId,
                      modelId: c.modelId,
                      isPR: !!c.prType,
                      best: bestSetOf(c.ex) ?? { weight: c.weight, reps: c.reps, rir: null },
                      journalLogs,
                      exerciseLib,
                    }),
                  })
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: pressed ? L.bgHover : C.bg3,
                  borderWidth: 1,
                  borderColor: c.prType ? "rgba(255,194,51,.3)" : L.line,
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: C.ink0 }}>
                    {c.exName}
                  </Text>
                </View>
                <Text style={[mono, { fontSize: 13, fontWeight: "800", color: c.prType ? C.gold : C.ink1 }]}>
                  {c.weight} kg × {c.reps}
                </Text>
                {!!c.prType && <Text style={{ fontSize: 12 }}>🏆</Text>}
              </Pressable>
            ))}
            <Btn kind="ghost" full onPress={() => setMode("choose")} style={{ marginTop: 4 }}>
              ‹ Retour
            </Btn>
          </View>
        )}
      </Sheet>

      <ComposePost
        open={!!draft}
        onClose={() => {
          setDraft(null);
          setMode("choose");
        }}
        draft={draft}
      />
    </>
  );
}

export function ComposePost({ open, onClose, draft, onPublished }: { open: boolean; onClose: () => void; draft: PostDraft | null; onPublished?: (id: string) => void }) {
  const { userId } = useData();
  const [title, setTitle] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const shotRef = useRef(null);
  const stickerRef = useRef(null);

  if (!draft) return null;
  const effTitle = title ?? draft.defaultTitle;
  const stats = draft.type === "session" ? draft.lift_ref?.stats : null;
  const prList: Any[] = draft.type === "session" ? (draft.lift_ref?.prList ?? []) : [];
  const lift = draft.type === "lift" ? draft.lift_ref : null;

  const reset = () => {
    setTitle(null);
    setText("");
    setPhoto(null);
    setPublished(false);
    setError(null);
  };

  const publish = async () => {
    if (!effTitle.trim()) {
      haptic("warning");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let image_url: string | null = null;
      if (photo) {
        const path = `${userId}/${Date.now()}.jpg`;
        image_url = await uploadImage("posts", path, photo, 640);
      }
      const id = await social.createPost(userId!, {
        type: draft.type,
        title: effTitle.trim(),
        text: text.trim() || null,
        lift_ref: draft.lift_ref,
        log_id: draft.log_id ?? null,
        image_url,
      });
      haptic("success");
      setPublished(true);
      onPublished?.(id);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  const exportInstagram = async () => {
    // Photo OBLIGATOIRE pour la story (décision Maxime) — elle sert de fond
    // plein écran sous le sticker. Le post du feed, lui, reste publiable sans.
    if (!photo?.uri) {
      setError("Ajoute une photo (appareil ou galerie) : elle sert de fond à ta story.");
      haptic("warning");
      return;
    }
    haptic("light");
    // Laisse les vues off-screen se rendre avant capture
    await new Promise((r) => setTimeout(r, 80));
    try {
      // Fond de la story :
      //  - photo choisie dans MyLift → elle sert de fond, le sticker MyLift
      //    transparent se pose dessus (rendu façon Strava) ;
      //  - pas de photo → la carte MyLift 9:16 fait le fond (jamais le
      //    dégradé violet par défaut d'Instagram).
      const stickerUri = await captureRef(stickerRef, { format: "png", quality: 1, result: "tmpfile", width: 1080 });
      if (await shareStickerToInstagramStories(photo.uri, stickerUri)) {
        haptic("success");
        return;
      }
      // Repli (Instagram absent / Expo Go) : carte MyLift via le share sheet
      const uri = await captureRef(shotRef, { format: "png", quality: 1, result: "tmpfile", width: 1080, height: 1920 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Partager en story Instagram" });
      }
    } catch (e: any) {
      setError("Export : " + (e?.message ?? String(e)));
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={published ? "Publié ✓" : draft.type === "lift" ? "Partager ce lift" : "Partager la séance"}
    >
      {/* Vues hors écran, prêtes pour la capture */}
      <ShareCard draft={draft} title={effTitle} story shotRef={shotRef} />
      <StickerCard draft={draft} title={effTitle} note={text} shotRef={stickerRef} />

      {!published ? (
        <View>
          {/* Aperçu chiffres / PRs (jamais de machine) */}
          {lift && (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
              <Text style={[mono, { fontSize: 24, fontWeight: "900", color: C.gold }]}>
                {lift.weight} kg × {lift.reps}
              </Text>
              <Text style={{ fontSize: 13, color: C.ink2, flexShrink: 1 }}>{lift.exName}</Text>
            </View>
          )}
          {stats && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {!!stats.durationSec && <Chip>{formatDur(stats.durationSec)}</Chip>}
              {!!stats.tonnage && <Chip>{formatNum(stats.tonnage / 1000, 1)} t</Chip>}
              {!!stats.prs && <Chip tone="gold">{stats.prs} PR{stats.prs > 1 ? "s" : ""}</Chip>}
            </View>
          )}
          {prList.length > 0 && (
            <View style={{ marginBottom: 12, gap: 4 }}>
              {prList.map((pr, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="trophy" size={12} color={C.gold} />
                  <Text style={[mono, { fontSize: 12.5, fontWeight: "800", color: C.gold }]}>
                    {pr.exName} · {pr.weight}×{pr.reps}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Label style={{ marginBottom: 8 }}>Titre</Label>
          <TextInput value={effTitle} onChangeText={setTitle} style={[inputStyle, { marginBottom: 12 }]} placeholderTextColor={C.ink3} />

          <Label style={{ marginBottom: 8 }}>Texte (optionnel)</Label>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Raconte…"
            placeholderTextColor={C.ink3}
            multiline
            style={[inputStyle, { minHeight: 64, textAlignVertical: "top", marginBottom: 12 }]}
          />

          {/* Photo : appareil OU galerie */}
          <Label style={{ marginBottom: 8 }}>Photo (optionnel)</Label>
          {photo ? (
            <View style={{ marginBottom: 14 }}>
              <Image source={{ uri: photo.uri }} style={{ width: "100%", height: 180, borderRadius: 12, backgroundColor: C.bg3 }} resizeMode="cover" />
              <Pressable
                onPress={() => setPhoto(null)}
                style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,.6)", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              <Btn kind="ghost" onPress={async () => setPhoto((await takePhoto()) ?? null)} style={{ flex: 1 }}>
                <Ionicons name="camera-outline" size={15} color={C.ink1} /> Appareil
              </Btn>
              <Btn kind="ghost" onPress={async () => setPhoto((await pickFromLibrary()) ?? null)} style={{ flex: 1 }}>
                <Ionicons name="images-outline" size={15} color={C.ink1} /> Galerie
              </Btn>
            </View>
          )}

          {!!error && <Text style={{ color: C.danger, fontSize: 12, marginBottom: 10 }}>{error}</Text>}

          <Btn full onPress={publish} disabled={busy || !effTitle.trim()}>
            {busy ? "Publication…" : "Publier dans le feed"}
          </Btn>

          {/* Story Instagram SANS publier dans le feed — les deux chemins sont
              indépendants (décision Maxime : story directe possible seule) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: L.line }} />
            <Text style={{ color: C.ink3, fontSize: 11 }}>ou</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: L.line }} />
          </View>
          <Pressable
            onPress={() => exportInstagram()}
            disabled={!photo}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              height: 52,
              borderRadius: 14,
              backgroundColor: pressed ? "#C21E5C" : "#E1306C",
              opacity: photo ? 1 : 0.45,
            })}
          >
            <Ionicons name="logo-instagram" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Story Instagram seulement</Text>
          </Pressable>
          {!photo && (
            <Text style={{ color: C.ink3, fontSize: 11.5, textAlign: "center", marginTop: 8, lineHeight: 16 }}>
              La story a besoin d'une photo : elle sert de fond sous ton sticker MyLift.
            </Text>
          )}
        </View>
      ) : (
        <View>
          <Pressable
            onPress={() => exportInstagram()}
            disabled={!photo}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              height: 52,
              borderRadius: 14,
              backgroundColor: pressed ? "#C21E5C" : "#E1306C",
              marginBottom: 10,
              opacity: photo ? 1 : 0.45,
            })}
          >
            <Ionicons name="logo-instagram" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
              {draft.type === "lift" ? "Partage ton lift en story" : "Partage ta séance en story"}
            </Text>
          </Pressable>
          {!photo && (
            <Text style={{ color: C.ink3, fontSize: 11.5, textAlign: "center", marginBottom: 10, lineHeight: 16 }}>
              Reviens en arrière pour ajouter une photo : la story en a besoin comme fond.
            </Text>
          )}
          {!!error && <Text style={{ color: C.danger, fontSize: 12, marginBottom: 10 }}>{error}</Text>}
          <Btn
            kind="ghost"
            full
            onPress={() => {
              reset();
              onClose();
            }}
          >
            Fermer
          </Btn>
        </View>
      )}
    </Sheet>
  );
}
