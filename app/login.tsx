import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { C, R } from "@/lib/theme";

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const fn =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email: email.trim(), password })
        : supabase.auth.signUp({ email: email.trim(), password });
    const { error } = await fn;
    setBusy(false);
    if (error) setMsg(error.message);
    // Succès : la redirection est gérée par le layout racine (onAuthStateChange)
  };

  const input = {
    backgroundColor: C.bg2,
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
      <Text style={{ color: C.ink0, fontSize: 34, fontWeight: "800", marginBottom: 4 }}>
        My<Text style={{ color: C.accent }}>Lift</Text>
      </Text>
      <Text style={{ color: C.ink2, fontSize: 15, marginBottom: 32 }}>
        {mode === "login" ? "Connexion" : "Créer un compte"}
      </Text>

      <TextInput
        style={input}
        placeholder="Email"
        placeholderTextColor={C.ink3}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={input}
        placeholder="Mot de passe"
        placeholderTextColor={C.ink3}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {msg && <Text style={{ color: C.danger, marginBottom: 12 }}>{msg}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy || !email || password.length < 6}
        style={({ pressed }) => ({
          backgroundColor: pressed ? C.accentLo : C.accent,
          borderRadius: R.md,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          opacity: busy || !email || password.length < 6 ? 0.5 : 1,
        })}
      >
        {busy ? (
          <ActivityIndicator color={C.ink0} />
        ) : (
          <Text style={{ color: C.ink0, fontSize: 17, fontWeight: "700" }}>
            {mode === "login" ? "Se connecter" : "Créer le compte"}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === "login" ? "signup" : "login")} style={{ marginTop: 20, minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: C.ink2, textAlign: "center" }}>
          {mode === "login" ? "Pas de compte ? " : "Déjà un compte ? "}
          <Text style={{ color: C.accentHi, fontWeight: "600" }}>
            {mode === "login" ? "En créer un" : "Se connecter"}
          </Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
