// Onboarding grand public — premier lancement d'un compte NEUF (aucune donnée).
// Étape 1 : création du profil (username unicité live, ville, bio, photo via
// le pipeline image partagé). Étape 2 : premier programme — générateur auto
// (moteur déjà porté/testé en parité) OU création manuelle guidée (éditeur
// existant). Parcours totalement séparé de l'import backup (outil interne
// Maxime, accessible seulement via le lien discret du login).
import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { C, L, MOTION, mono } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { useData } from "@/lib/store";
import * as social from "@/db/social";
import { pickFromLibrary, uploadImage, type PickedImage } from "@/lib/images";
import { syncNow } from "@/db/sync";
import { Btn, Label, Sheet } from "@/ui/kit";
import { Avatar } from "@/ui/Avatar";
import type { Any } from "@/core/mylift";

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

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useData();
  const { userId, profile, programs, ready } = data;

  // L'étape découle de l'état réel : pas de profil → 1, pas de programme → 2,
  // programme créé → 3 (bienvenue + amis).
  const hasProfile = !!profile?.username;
  const [step, setStep] = useState<1 | 2 | 3>(hasProfile ? (programs.length > 0 ? 3 : 2) : 1);
  useEffect(() => {
    if (hasProfile && step === 1) setStep(2);
    if (hasProfile && programs.length > 0 && step === 2) setStep(3);
  }, [hasProfile, programs.length]);

  // --- Étape 1 : profil ---
  const [username, setUsername] = useState("");
  const [ville, setVille] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const u = username.trim();
    if (!u) {
      setUsernameStatus("idle");
      return;
    }
    if (u.length < 3 || u.length > 24 || !/^[a-zA-Z0-9_\.]+$/.test(u)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const ok = await social.checkUsernameAvailable(u, userId!);
        setUsernameStatus(ok ? "ok" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
  }, [username]);

  const saveProfile = async () => {
    const u = username.trim();
    if (!u || usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "checking") {
      haptic("warning");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let avatar_url: string | undefined;
      if (photo) avatar_url = await uploadImage("avatars", `${userId}.jpg`, photo, 256);
      const existing = await social.fetchProfile(userId!);
      if (!existing) await social.createProfile(userId!, u);
      const patch: Any = { username: u, ville: ville.trim() || null, bio: bio.trim().slice(0, 160) || null };
      if (avatar_url) patch.avatar_url = avatar_url;
      await social.updateProfile(userId!, patch);
      // Redescend le profil dans SQLite pour que la garde de nav le voie
      await syncNow();
      await data.reload();
      haptic("success");
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  // --- Étape 2 : premier programme ---
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");

  const createManual = async () => {
    if (!manualName.trim()) return;
    const p = await data.createProgram(manualName.trim());
    await data.setCurrentProgram(p.id);
    setManualOpen(false);
    haptic("success");
    router.push(`/program/${p.id}`);
  };

  const canSaveProfile = username.trim().length >= 3 && usernameStatus !== "taken" && usernameStatus !== "invalid" && usernameStatus !== "checking" && !busy;
  const previewProfile = { username: username || "?", avatar_url: photo?.uri };

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg0 }} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        {/* En-tête + progression */}
        <Animated.View entering={FadeInDown.duration(MOTION.view)}>
          <Text style={{ color: C.ink0, fontSize: 34, fontWeight: "900", letterSpacing: -1.4 }}>
            Bienvenue sur My<Text style={{ color: C.accent }}>Lift</Text>
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 16, marginBottom: 28 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? C.accent : C.bg3 }} />
            ))}
          </View>
        </Animated.View>

        {step === 1 && (
          <Animated.View entering={FadeIn.duration(MOTION.view)}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink0, marginBottom: 4 }}>Crée ton profil</Text>
            <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 24 }}>C'est ce que les autres verront de toi.</Text>

            <Pressable onPress={async () => setPhoto((await pickFromLibrary(true)) ?? photo)} style={{ alignItems: "center", marginBottom: 24 }}>
              <Avatar profile={previewProfile} size={96} />
              <View
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: "32%",
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: C.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: C.bg0,
                }}
              >
                <Ionicons name="camera" size={15} color="#fff" />
              </View>
            </Pressable>

            <Label style={{ marginBottom: 8 }}>
              Username <Text style={{ color: C.danger }}>*</Text>
            </Label>
            <View style={{ position: "relative", marginBottom: 4 }}>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="tonpseudo"
                placeholderTextColor={C.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  inputStyle,
                  {
                    paddingRight: 40,
                    borderColor:
                      usernameStatus === "taken" || usernameStatus === "invalid" ? C.danger : usernameStatus === "ok" ? "rgba(47,210,125,.5)" : L.line,
                  },
                ]}
              />
              <View style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}>
                {usernameStatus === "checking" && <ActivityIndicator size="small" color={C.ink3} />}
                {usernameStatus === "ok" && <Ionicons name="checkmark-circle" size={18} color={C.success} />}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && <Ionicons name="close-circle" size={18} color={C.danger} />}
              </View>
            </View>
            <Text style={{ fontSize: 11, color: usernameStatus === "taken" ? C.danger : C.ink3, marginBottom: 16 }}>
              {usernameStatus === "taken" ? "Ce nom est déjà pris." : usernameStatus === "invalid" ? "3-24 caractères : lettres, chiffres, _ ou ." : "3-24 caractères, unique."}
            </Text>

            <Label style={{ marginBottom: 8 }}>Ville (optionnel)</Label>
            <TextInput value={ville} onChangeText={setVille} placeholder="Paris" placeholderTextColor={C.ink3} style={[inputStyle, { marginBottom: 16 }]} />

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Label>Bio (optionnel)</Label>
              <Text style={{ fontSize: 11, color: C.ink3 }}>{bio.length}/160</Text>
            </View>
            <TextInput
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 160))}
              placeholder="Poussé de fonte depuis…"
              placeholderTextColor={C.ink3}
              multiline
              style={[inputStyle, { minHeight: 72, textAlignVertical: "top", marginBottom: 20 }]}
            />

            {!!error && <Text style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{error}</Text>}

            <Btn full onPress={saveProfile} disabled={!canSaveProfile}>
              {busy ? "Création…" : "Continuer"}
            </Btn>
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View entering={FadeIn.duration(MOTION.view)}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink0, marginBottom: 4 }}>Ton premier programme</Text>
            <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 24 }}>
              Tu démarres avec la bibliothèque d'exercices MyLift. Choisis comment construire tes séances :
            </Text>

            <Pressable
              onPress={() => {
                haptic("medium");
                router.push("/generator");
              }}
              style={({ pressed }) => ({
                padding: 20,
                borderRadius: 18,
                backgroundColor: pressed ? L.bgHover : C.bg2,
                borderWidth: 1,
                borderColor: "rgba(252,76,2,.35)",
                marginBottom: 10,
              })}
            >
              <Text style={{ fontSize: 26, marginBottom: 8 }}>🧠</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: C.ink0 }}>Générer automatiquement</Text>
              <Text style={{ fontSize: 13, color: C.ink2, marginTop: 4, lineHeight: 18 }}>
                Quelques questions (niveau, fréquence, muscles prioritaires) et MyLift construit un programme adapté.
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: C.accentHi, marginTop: 10 }}>Recommandé pour commencer →</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                haptic("light");
                setManualName("");
                setManualOpen(true);
              }}
              style={({ pressed }) => ({
                padding: 20,
                borderRadius: 18,
                backgroundColor: pressed ? L.bgHover : C.bg2,
                borderWidth: 1,
                borderColor: L.line,
                marginBottom: 20,
              })}
            >
              <Text style={{ fontSize: 26, marginBottom: 8 }}>✏️</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: C.ink0 }}>Créer manuellement</Text>
              <Text style={{ fontSize: 13, color: C.ink2, marginTop: 4, lineHeight: 18 }}>
                Nomme ton programme puis compose tes séances exo par exo, avec variantes et cibles.
              </Text>
            </Pressable>

            <Pressable onPress={() => router.replace("/")} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: C.ink3, textAlign: "center", fontSize: 13 }}>Plus tard — explorer l'app d'abord</Text>
            </Pressable>
          </Animated.View>
        )}

        {step === 3 && (
          <Animated.View entering={FadeIn.duration(MOTION.view)}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🎉</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink0, marginBottom: 4 }}>Bienvenue, @{profile?.username} !</Text>
            <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 24, lineHeight: 19 }}>
              Ton programme <Text style={{ fontWeight: "700", color: C.ink1 }}>{programs[0]?.name}</Text> est prêt. Dernière chose : MyLift est plus motivant
              à plusieurs — retrouve tes amis pour voir leurs séances et leurs PRs.
            </Text>

            <Pressable
              onPress={() => {
                haptic("light");
                router.push("/search");
              }}
              style={({ pressed }) => ({
                padding: 20,
                borderRadius: 18,
                backgroundColor: pressed ? L.bgHover : C.bg2,
                borderWidth: 1,
                borderColor: "rgba(252,76,2,.35)",
                marginBottom: 20,
              })}
            >
              <Text style={{ fontSize: 26, marginBottom: 8 }}>👥</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: C.ink0 }}>Ajouter des amis</Text>
              <Text style={{ fontSize: 13, color: C.ink2, marginTop: 4, lineHeight: 18 }}>
                Cherche-les par username et envoie une demande. Tu pourras aussi te faire scanner via ton QR code, sur ton profil.
              </Text>
            </Pressable>

            <Btn full onPress={() => router.replace("/")}>
              C'est parti →
            </Btn>
          </Animated.View>
        )}

        {/* Nom du programme manuel */}
        <Sheet open={manualOpen} onClose={() => setManualOpen(false)} title="Nom du programme">
          <TextInput
            value={manualName}
            onChangeText={setManualName}
            placeholder="Ex: Mon programme"
            placeholderTextColor={C.ink3}
            autoFocus
            style={[inputStyle, { marginBottom: 12 }]}
          />
          <Btn full disabled={!manualName.trim()} onPress={createManual}>
            ✓ Créer et composer
          </Btn>
        </Sheet>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
