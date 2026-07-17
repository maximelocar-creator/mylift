// Création / édition de profil — écran soigné (première impression de l'app).
// Username avec vérification d'unicité en direct, ville, bio ≤160, avatar :
// photo iPhone compressée côté client (max 1080px, JPEG) avant upload Storage.
// Sert aussi à la CRÉATION (compte neuf sans profil) — distinct de l'import
// backup qui reste un outil interne.
import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import Animated, { FadeInDown } from "react-native-reanimated";
import { C, L, MOTION } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { useData } from "@/lib/store";
import * as social from "@/db/social";
import { supabase } from "@/lib/supabase";
import { Btn, Label } from "@/ui/kit";
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

export default function ProfileEdit() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useData();
  const { userId } = data;

  const [existing, setExisting] = useState<Any | null>(null);
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null); // locale, à uploader
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreation = existing === null || !existing?.username;

  useEffect(() => {
    social
      .fetchProfile(userId!)
      .then((p) => {
        setExisting(p);
        if (p) {
          setUsername(p.username || "");
          setCity(p.city || "");
          setBio(p.bio || "");
        }
      })
      .catch(() => {});
  }, [userId]);

  // Vérification d'unicité du username (debounce 400 ms)
  useEffect(() => {
    const u = username.trim();
    if (!u || u === existing?.username) {
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
  }, [username, existing]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    // Compression côté client : max 1080px, JPEG (contrainte de coût CLAUDE.md)
    const manipulated = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 1080 } }], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    setAvatarUri(manipulated.uri);
    haptic("light");
  };

  const save = async () => {
    const u = username.trim();
    if (!u || usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "checking") {
      haptic("warning");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let avatar_url: string | undefined;
      if (avatarUri) {
        // Upload Storage (bucket "avatars") — l'URL publique est stockée sur le profil
        const resp = await fetch(avatarUri);
        const blob = await resp.arrayBuffer();
        const path = `${userId}.jpg`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error("Avatar : " + upErr.message);
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatar_url = pub.publicUrl + "?t=" + Date.now();
      }
      const patch: Any = { username: u, city: city.trim() || null, bio: bio.trim().slice(0, 160) || null };
      if (avatar_url) patch.avatar_url = avatar_url;
      if (isCreation && !existing) {
        await social.createProfile(userId!, u);
        await social.updateProfile(userId!, patch);
      } else {
        await social.updateProfile(userId!, patch);
      }
      await data.reload();
      haptic("success");
      router.back();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  const canSave = username.trim().length >= 3 && usernameStatus !== "taken" && usernameStatus !== "invalid" && usernameStatus !== "checking" && !busy;

  const previewProfile = { username: username || existing?.username, avatar_url: avatarUri || existing?.avatar_url };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, minHeight: 44 }}>
          <Ionicons name="chevron-back" size={16} color={C.ink2} />
          <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Profil</Text>
        </Pressable>
        <Animated.View entering={FadeInDown.duration(MOTION.view)}>
          <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: -1, color: C.ink0, marginBottom: 4 }}>
            {isCreation ? "Crée ton profil." : "Modifier le profil."}
          </Text>
          <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 24 }}>
            {isCreation ? "C'est ce que les autres verront de toi sur MyLift." : "Username, ville, bio et photo."}
          </Text>
        </Animated.View>

        {/* Avatar */}
        <Animated.View entering={FadeInDown.delay(60).duration(MOTION.view)} style={{ alignItems: "center", marginBottom: 24 }}>
          <Pressable onPress={pickPhoto} style={{ alignItems: "center" }}>
            <Avatar profile={previewProfile} size={96} />
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
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
          <Text style={{ fontSize: 11, color: C.ink3, marginTop: 10 }}>Photo compressée avant envoi (max 1080px)</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(MOTION.view)}>
          {/* Username */}
          <Label style={{ marginBottom: 8 }}>
            Username <Text style={{ color: C.danger }}>*</Text>
          </Label>
          <View style={{ position: "relative", marginBottom: 4 }}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="maxime"
              placeholderTextColor={C.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                inputStyle,
                { paddingRight: 40, borderColor: usernameStatus === "taken" || usernameStatus === "invalid" ? C.danger : usernameStatus === "ok" ? "rgba(47,210,125,.5)" : L.line },
              ]}
            />
            <View style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}>
              {usernameStatus === "checking" && <ActivityIndicator size="small" color={C.ink3} />}
              {usernameStatus === "ok" && <Ionicons name="checkmark-circle" size={18} color={C.success} />}
              {(usernameStatus === "taken" || usernameStatus === "invalid") && <Ionicons name="close-circle" size={18} color={C.danger} />}
            </View>
          </View>
          <Text style={{ fontSize: 11, color: usernameStatus === "taken" ? C.danger : C.ink3, marginBottom: 16 }}>
            {usernameStatus === "taken"
              ? "Ce nom est déjà pris."
              : usernameStatus === "invalid"
                ? "3-24 caractères : lettres, chiffres, _ ou ."
                : "3-24 caractères, visible par les autres."}
          </Text>

          {/* Ville */}
          <Label style={{ marginBottom: 8 }}>Ville (optionnel)</Label>
          <TextInput value={city} onChangeText={setCity} placeholder="Paris" placeholderTextColor={C.ink3} style={[inputStyle, { marginBottom: 16 }]} />

          {/* Bio */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Label>Bio (optionnel)</Label>
            <Text style={{ fontSize: 11, color: bio.length > 160 ? C.danger : C.ink3 }}>{bio.length}/160</Text>
          </View>
          <TextInput
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, 160))}
            placeholder="Poussé de fonte depuis 2019…"
            placeholderTextColor={C.ink3}
            multiline
            style={[inputStyle, { minHeight: 80, textAlignVertical: "top", marginBottom: 20 }]}
          />

          {!!error && <Text style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{error}</Text>}

          <Btn full onPress={save} disabled={!canSave}>
            {busy ? "Enregistrement…" : isCreation ? "Créer mon profil" : "Enregistrer"}
          </Btn>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
