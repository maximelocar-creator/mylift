import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { importBackup, ImportResult } from "@/db/importBackup";
import { syncNow } from "@/db/sync";
import { useData } from "@/lib/store";
import { C, R, mono } from "@/lib/theme";

type Profile = { id: string; username: string; current_program_id: string | null };

export default function Home() {
  const insets = useSafeAreaInsets();
  const data = useData();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepMsg, setStepMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ logs: number; weights: number } | null>(null);

  const loadState = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile(data ?? null);
    if (data) {
      const logs = await supabase.from("workout_logs").select("*", { count: "exact", head: true });
      const w = await supabase.from("weights").select("*", { count: "exact", head: true });
      setCounts({ logs: logs.count ?? 0, weights: w.count ?? 0 });
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) loadState(uid);
    });
  }, []);

  const createProfile = async () => {
    if (!userId) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .insert({ id: userId, username: username.trim() });
    setBusy(false);
    if (error) {
      setErr(error.message.includes("duplicate") ? "Ce nom est déjà pris." : error.message);
      return;
    }
    loadState(userId);
  };

  const pickAndImport = async () => {
    if (!userId) return;
    setErr(null);
    setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: "application/json" });
    if (picked.canceled || !picked.assets?.[0]) return;
    setBusy(true);
    try {
      const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const backup = JSON.parse(raw);
      const res = await importBackup(backup, userId, setStepMsg);
      setResult(res);
      await loadState(userId);
      // Redescend l'état serveur dans SQLite puis rafraîchit le store :
      // les données importées apparaissent immédiatement dans l'app.
      setStepMsg("Synchronisation locale…");
      await syncNow();
      await data.reload();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
      setStepMsg(null);
    }
  };

  const card = {
    backgroundColor: C.bg1,
    borderRadius: R.md,
    padding: 20,
    marginBottom: 16,
  } as const;

  if (!userId) return <View style={{ flex: 1, backgroundColor: C.bg0 }} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}
    >
      <Text style={{ color: C.ink0, fontSize: 28, fontWeight: "800", marginBottom: 24 }}>
        My<Text style={{ color: C.accent }}>Lift</Text>
        <Text style={{ color: C.ink3, fontSize: 15, fontWeight: "400" }}>  ·  Phase 0</Text>
      </Text>

      {!profile ? (
        <View style={card}>
          <Text style={{ color: C.ink0, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
            Choisis ton nom d'utilisateur
          </Text>
          <Text style={{ color: C.ink2, marginBottom: 16 }}>
            Visible par les autres quand le social arrivera. 3 à 24 caractères.
          </Text>
          <TextInput
            style={{
              backgroundColor: C.bg2, color: C.ink0, borderRadius: R.sm,
              paddingHorizontal: 16, height: 52, fontSize: 16, marginBottom: 12,
            }}
            placeholder="maxime"
            placeholderTextColor={C.ink3}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          {err && <Text style={{ color: C.danger, marginBottom: 12 }}>{err}</Text>}
          <Pressable
            onPress={createProfile}
            disabled={busy || username.trim().length < 3}
            style={{
              backgroundColor: C.accent, borderRadius: R.md, height: 52,
              alignItems: "center", justifyContent: "center",
              opacity: busy || username.trim().length < 3 ? 0.5 : 1,
            }}
          >
            {busy ? <ActivityIndicator color={C.ink0} /> : (
              <Text style={{ color: C.ink0, fontWeight: "700", fontSize: 16 }}>Valider</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <>
          <View style={card}>
            <Text style={{ color: C.ink2, fontSize: 13, marginBottom: 4 }}>Connecté</Text>
            <Text style={{ color: C.ink0, fontSize: 20, fontWeight: "700" }}>@{profile.username}</Text>
            {counts && (
              <Text style={{ color: C.ink2, marginTop: 8, ...mono }}>
                {counts.logs} séances · {counts.weights} pesées sur le serveur
              </Text>
            )}
          </View>

          <View style={card}>
            <Text style={{ color: C.ink0, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
              Importer ton backup v40
            </Text>
            <Text style={{ color: C.ink2, marginBottom: 16 }}>
              Sélectionne le fichier JSON exporté depuis la PWA. Relançable sans risque de doublon.
            </Text>
            <Pressable
              onPress={pickAndImport}
              disabled={busy}
              style={{
                backgroundColor: C.accent, borderRadius: R.md, height: 52,
                alignItems: "center", justifyContent: "center", opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color={C.ink0} />
                  {stepMsg && <Text style={{ color: C.ink0 }}>{stepMsg}</Text>}
                </View>
              ) : (
                <Text style={{ color: C.ink0, fontWeight: "700", fontSize: 16 }}>
                  Choisir le fichier et importer
                </Text>
              )}
            </Pressable>
            {err && <Text style={{ color: C.danger, marginTop: 12 }}>{err}</Text>}
          </View>

          {result && (
            <View style={card}>
              <Text
                style={{
                  color: result.allOk ? C.success : C.danger,
                  fontSize: 18, fontWeight: "800", marginBottom: 12,
                }}
              >
                {result.allOk ? "Parité totale — zéro perte" : "Écarts détectés"}
              </Text>
              {result.lines.map((l) => (
                <View
                  key={l.label}
                  style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}
                >
                  <Text style={{ color: C.ink1, flex: 1 }}>{l.label}</Text>
                  <Text style={{ color: l.ok ? C.success : C.danger, ...mono }}>
                    {String(l.actual)}/{String(l.expected)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => supabase.auth.signOut()}
            style={{ minHeight: 44, justifyContent: "center", marginTop: 8 }}
          >
            <Text style={{ color: C.ink3, textAlign: "center" }}>Se déconnecter</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
</KeyboardAvoidingView>
  );
}