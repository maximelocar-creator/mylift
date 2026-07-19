// Login / signup — parcours principal des futurs testeurs : finition native.
// L'import de backup v40 (outil interne de migration) est isolé derrière un
// lien discret en bas d'écran, jamais une étape du flow.
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { C, R, L, MOTION } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { appleAvailable, signInWithApple, signInWithGoogle } from "@/lib/oauth";

// Lu par le Dashboard au premier rendu : ouvre l'écran d'import une fois.
export const OPEN_IMPORT_FLAG = "mylift_open_import_once";

export default function Login() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [importArmed, setImportArmed] = useState(false);
  const [appleOk, setAppleOk] = useState(false);

  useEffect(() => {
    appleAvailable().then(setAppleOk);
  }, []);

  const socialSignIn = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      haptic("error");
      setMsg(error);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(OPEN_IMPORT_FLAG).then((v) => setImportArmed(v === "1"));
  }, []);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const fn =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email: email.trim(), password })
        : supabase.auth.signUp({ email: email.trim(), password });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      haptic("error");
      setMsg(error.message);
    } else {
      haptic("success");
      // La redirection est gérée par le layout racine (routes protégées)
    }
  };

  const toggleImport = async () => {
    const next = !importArmed;
    setImportArmed(next);
    haptic("light");
    if (next) await AsyncStorage.setItem(OPEN_IMPORT_FLAG, "1");
    else await AsyncStorage.removeItem(OPEN_IMPORT_FLAG);
  };

  const canSubmit = !!email && password.length >= 6 && !busy;

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: L.line,
    color: C.ink0,
    borderRadius: R.sm,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    marginBottom: 12,
  } as const;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg0, justifyContent: "center", padding: 24 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View entering={FadeInDown.duration(MOTION.view).springify().damping(24)}>
        <Text style={{ color: C.ink0, fontSize: 38, fontWeight: "900", letterSpacing: -1.5, marginBottom: 4 }}>
          My<Text style={{ color: C.accent }}>Lift</Text>
        </Text>
        <Text style={{ color: C.ink2, fontSize: 15, marginBottom: 32 }}>{mode === "login" ? "Connexion" : "Créer un compte"}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(MOTION.view).springify().damping(24)}>
        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={C.ink3}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={inputStyle}
          placeholder="Mot de passe"
          placeholderTextColor={C.ink3}
          secureTextEntry
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChangeText={setPassword}
        />
      </Animated.View>

      {msg && (
        <Animated.Text entering={FadeIn.duration(MOTION.local)} style={{ color: C.danger, marginBottom: 12, fontSize: 13 }}>
          {msg}
        </Animated.Text>
      )}

      <Animated.View entering={FadeInDown.delay(120).duration(MOTION.view).springify().damping(24)} style={btnStyle}>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          onPressIn={() => {
            btnScale.value = withSpring(0.975, MOTION.microSpring);
          }}
          onPressOut={() => {
            btnScale.value = withSpring(1, MOTION.microSpring);
          }}
          style={{
            backgroundColor: C.accent,
            borderRadius: R.md,
            height: 52,
            alignItems: "center",
            justifyContent: "center",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {busy ? (
            <ActivityIndicator color={C.ink0} />
          ) : (
            <Text style={{ color: C.ink0, fontSize: 17, fontWeight: "700" }}>{mode === "login" ? "Se connecter" : "Créer le compte"}</Text>
          )}
        </Pressable>

        {/* Providers sociaux — validation réelle au premier build EAS (cf. CLAUDE.md) */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: L.line }} />
          <Text style={{ color: C.ink3, fontSize: 11 }}>ou</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: L.line }} />
        </View>
        <View style={{ gap: 8 }}>
          {appleOk && (
            <Pressable
              onPress={() => socialSignIn(signInWithApple)}
              disabled={busy}
              style={({ pressed }) => ({ backgroundColor: pressed ? "#E4E4E8" : "#fff", borderRadius: R.md, height: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: busy ? 0.6 : 1 })}
            >
              <Ionicons name="logo-apple" size={19} color="#000" style={{ marginTop: -2 }} />
              <Text style={{ color: "#000", fontSize: 15, fontWeight: "700" }}>Continuer avec Apple</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => socialSignIn(signInWithGoogle)}
            disabled={busy}
            style={({ pressed }) => ({ backgroundColor: pressed ? L.bgHover : "rgba(255,255,255,.07)", borderWidth: 1, borderColor: L.line, borderRadius: R.md, height: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: busy ? 0.6 : 1 })}
          >
            <Ionicons name="logo-google" size={17} color={C.ink0} />
            <Text style={{ color: C.ink0, fontSize: 15, fontWeight: "700" }}>Continuer avec Google</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            haptic("light");
            setMode(mode === "login" ? "signup" : "login");
          }}
          style={{ marginTop: 20, minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: C.ink2, textAlign: "center" }}>
            {mode === "login" ? "Pas de compte ? " : "Déjà un compte ? "}
            <Text style={{ color: C.accentHi, fontWeight: "600" }}>{mode === "login" ? "En créer un" : "Se connecter"}</Text>
          </Text>
        </Pressable>
      </Animated.View>

      {/* Outil interne : import d'un ancien backup v40 (jamais une étape du flow).
          Armé → l'écran d'import s'ouvrira une fois après connexion. */}
      <Pressable
        onPress={toggleImport}
        style={{
          position: "absolute",
          bottom: insets.bottom + 16,
          alignSelf: "center",
          minHeight: 44,
          justifyContent: "center",
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ color: importArmed ? C.accentHi : C.ink3, fontSize: 12, textAlign: "center" }}>
          {importArmed ? "✓ L'import s'ouvrira après connexion" : "Importer un ancien backup"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
