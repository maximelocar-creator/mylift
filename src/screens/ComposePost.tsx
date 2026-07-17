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
import { Sheet, Btn, Label, Chip } from "../ui/kit";
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
  const [storyFormat, setStoryFormat] = useState(true);

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

  const exportInstagram = async (story: boolean) => {
    setStoryFormat(story);
    haptic("light");
    // Laisse les vues off-screen se re-rendre au bon format avant capture
    await new Promise((r) => setTimeout(r, 80));
    try {
      if (story) {
        // 1. Tentative DIRECTE : sticker transparent posé dans l'éditeur de
        // story Instagram (build EAS + Instagram installé). En Expo Go ou
        // sans Instagram → false, on retombe sur le share sheet générique.
        const stickerUri = await captureRef(stickerRef, { format: "png", quality: 1, result: "tmpfile", width: 1080 });
        if (await shareStickerToInstagramStories(stickerUri)) {
          haptic("success");
          return;
        }
      }
      const uri = await captureRef(shotRef, { format: "png", quality: 1, result: "tmpfile", width: 1080, height: story ? 1920 : 1080 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Exporter vers Instagram" });
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
      <ShareCard draft={draft} title={effTitle} story={storyFormat} shotRef={shotRef} />
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
                📷 Appareil
              </Btn>
              <Btn kind="ghost" onPress={async () => setPhoto((await pickFromLibrary()) ?? null)} style={{ flex: 1 }}>
                🖼 Galerie
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
          <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 16, lineHeight: 19 }}>
            Ton post est dans le feed. Tu peux aussi l'exporter en image vers Instagram (le partage ouvre le menu iOS — choisis Instagram, en story ou en
            publication).
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <Btn kind="gold" onPress={() => exportInstagram(true)} style={{ flex: 1 }}>
              Story Instagram
            </Btn>
            <Btn kind="gold" onPress={() => exportInstagram(false)} style={{ flex: 1 }}>
              Post carré
            </Btn>
          </View>
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
