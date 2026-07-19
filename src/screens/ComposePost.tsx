// Composition de post (Phase 3) — opt-in, jamais automatique.
// Type "séance" (depuis le récap : UN SEUL post, PR(s) valorisés dedans —
// décision Maxime) ou "lift" (PR isolé, ex. depuis ExoDetail).
// Photo : appareil OU galerie, pipeline image partagé (1080px JPEG, repli
// data-URI). Après publication : export Instagram (story/post) — image générée
// client à la DA MyLift (tokens theme.ts), partagée via le share sheet iOS.
// CONFIDENTIALITÉ : les payloads ne contiennent JAMAIS de nom de machine.
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
import type { Any } from "../core/mylift";

export type PostDraft = {
  type: "lift" | "session";
  defaultTitle: string;
  log_id?: string | null;
  // lift : {exName, weight, reps, prType?} · séance : {stats:{durationSec,tonnage,prs}, prList:[{exName,weight,reps,type}]}
  lift_ref: Any;
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

/* Sticker story Instagram — PNG TRANSPARENT épuré (style Strava) : éléments
   posés sur la photo de l'utilisateur, scrim léger derrière le texte pour la
   lisibilité. Variante A séance / B lift selon draft.type. Pas de carte
   pleine : seul le bloc de contenu porte un voile sombre arrondi. */
function StickerCard({ draft, title, shotRef }: { draft: PostDraft; title: string; shotRef: any }) {
  const lift = draft.type === "lift" ? draft.lift_ref : null;
  const stats = draft.type === "session" ? draft.lift_ref?.stats : null;
  const prList: Any[] = draft.type === "session" ? (draft.lift_ref?.prList ?? []) : [];
  return (
    <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }} style={{ position: "absolute", left: -9999, width: 340 }}>
      {/* Racine SANS fond → PNG transparent */}
      <View style={{ width: 340, backgroundColor: "transparent", padding: 10 }}>
        <View style={{ backgroundColor: L.scrim, borderRadius: 26, padding: 22, borderWidth: 1, borderColor: L.lineStrong }}>
          <Text style={{ color: C.ink0, fontSize: 17, fontWeight: "900", letterSpacing: -0.6 }}>
            My<Text style={{ color: C.accent }}>Lift</Text>
          </Text>
          <Text style={{ color: C.ink2, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2, marginTop: 10 }}>
            {draft.type === "lift" ? "Nouveau record" : "Séance terminée"}
          </Text>
          <Text style={{ color: C.ink0, fontSize: 22, fontWeight: "900", letterSpacing: -0.7, lineHeight: 26, marginTop: 4 }} numberOfLines={2}>
            {title}
          </Text>
          {lift && (
            <>
              <Text style={[mono, { color: C.gold, fontSize: 38, fontWeight: "900", letterSpacing: -1.4, marginTop: 10 }]}>
                {lift.weight} kg × {lift.reps}
              </Text>
              <Text style={{ color: C.ink1, fontSize: 13.5, fontWeight: "600", marginTop: 2 }}>{lift.exName}</Text>
            </>
          )}
          {stats && (
            <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
              {!!stats.durationSec && (
                <View>
                  <Text style={[mono, { color: C.ink0, fontSize: 19, fontWeight: "800" }]}>{formatDur(stats.durationSec)}</Text>
                  <Text style={{ color: C.ink2, fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>durée</Text>
                </View>
              )}
              {!!stats.tonnage && (
                <View>
                  <Text style={[mono, { color: C.ink0, fontSize: 19, fontWeight: "800" }]}>{formatNum(stats.tonnage / 1000, 1)} t</Text>
                  <Text style={{ color: C.ink2, fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>volume</Text>
                </View>
              )}
              {!!stats.prs && (
                <View>
                  <Text style={[mono, { color: C.gold, fontSize: 19, fontWeight: "800" }]}>{stats.prs}</Text>
                  <Text style={{ color: C.gold, fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
                    PR{stats.prs > 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>
          )}
          {prList.length > 0 && (
            <View style={{ marginTop: 10, gap: 3 }}>
              {prList.slice(0, 2).map((pr, i) => (
                <Text key={i} style={[mono, { color: C.gold, fontSize: 12.5, fontWeight: "800" }]}>
                  🏆 {pr.exName} · {pr.weight}×{pr.reps}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </ViewShot>
  );
}

/* Construit le brouillon "séance complète" d'un log (payload sans machine). */
export function sessionDraftOf(log: Any): PostDraft {
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
      prList: prs.map((pr: Any) => ({ exName: pr.exName, weight: pr.weight, reps: pr.reps, type: pr.type })),
    },
  };
}

/* Point d'entrée de partage d'une séance (récap de fin OU journal) :
   choix « séance complète » ou « un lift précis » (meilleure série de chaque
   exo, PR signalé). Une seule Sheet dont le contenu commute (jamais deux
   Modals swappées), puis ComposePost s'ouvre via afterSheetClose. */
export function ShareSessionSheet({ log, open, onClose }: { log: Any | null; open: boolean; onClose: () => void }) {
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
      return { exName: ex.exName, weight: w, reps: r, prType: pr?.type ?? null };
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
              onPress={() => log && pick(sessionDraftOf(log))}
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
                    lift_ref: { exName: c.exName, weight: c.weight, reps: c.reps, ...(c.prType ? { prType: c.prType } : {}) },
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
    haptic("light");
    // Laisse les vues off-screen se rendre avant capture
    await new Promise((r) => setTimeout(r, 80));
    try {
      // 1. Tentative DIRECTE : sticker transparent posé dans l'éditeur de
      // story Instagram (build EAS + Instagram installé). En Expo Go ou
      // sans Instagram → false, on retombe sur le share sheet générique.
      const stickerUri = await captureRef(stickerRef, { format: "png", quality: 1, result: "tmpfile", width: 1080 });
      if (await shareStickerToInstagramStories(stickerUri)) {
        haptic("success");
        return;
      }
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
      <StickerCard draft={draft} title={effTitle} shotRef={stickerRef} />

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
              {!!stats.durationSec && <Chip>⏱ {formatDur(stats.durationSec)}</Chip>}
              {!!stats.tonnage && <Chip>{formatNum(stats.tonnage / 1000, 1)} t</Chip>}
              {!!stats.prs && <Chip tone="gold">🏆 {stats.prs} PR{stats.prs > 1 ? "s" : ""}</Chip>}
            </View>
          )}
          {prList.length > 0 && (
            <View style={{ marginBottom: 12, gap: 3 }}>
              {prList.map((pr, i) => (
                <Text key={i} style={[mono, { fontSize: 12.5, fontWeight: "800", color: C.gold }]}>
                  🏆 {pr.exName} · {pr.weight}×{pr.reps}
                </Text>
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
        </View>
      ) : (
        <View>
          <Pressable
            onPress={() => exportInstagram()}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              height: 52,
              borderRadius: 14,
              backgroundColor: pressed ? "#C21E5C" : "#E1306C",
              marginBottom: 10,
            })}
          >
            <Ionicons name="logo-instagram" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
              {draft.type === "lift" ? "Partage ton lift en story" : "Partage ta séance en story"}
            </Text>
          </Pressable>
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
