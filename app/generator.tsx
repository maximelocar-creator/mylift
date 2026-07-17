// Générateur de programme auto — port fidèle de GeneratorForm + SgSliderRow (v40).
// Nom obligatoire, niveau, fréquence 2-6, statut par muscle avec quotas durs
// (max 3 focus, max 4 progression), répartition % par sous-groupe (sliders qui
// se rééquilibrent), résumé volume vs capacité → generateProgram (core, testé
// en parité contre le v40).
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { C, R, L, MOTION, mono } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { useData } from "@/lib/store";
import {
  generateProgram,
  computeVolumeTargets,
  splitVolumeBySubGroups,
  SUB_GROUP_DEFAULT_SPLIT,
  MAX_SETS_PER_SESSION,
  type Any,
} from "@/core/mylift";
import { Btn, Label, ScreenSkeleton } from "@/ui/kit";
import { SgSliderRow } from "@/ui/SgSlider";

const MAX_FOCUS = 3;
const MAX_PROGRESSION = 4;


/* ------------------------------------------------------------------ */
export default function Generator() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useData();
  const { muscleGroups, subGroups, exerciseLib, ready } = data;

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [level, setLevel] = useState("intermediaire");
  const [frequency, setFrequency] = useState(4);
  // Défaut 'maintenance' pour tous — l'utilisateur choisit les muscles à pousser (port v40)
  const [muscleStatus, setMuscleStatus] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    muscleGroups.forEach((g) => (out[g] = "maintenance"));
    return out;
  });
  const [subSplit, setSubSplit] = useState<Record<string, Record<string, number>>>({});
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Groupes ajoutés après le montage → statut par défaut
  useEffect(() => {
    const missing = muscleGroups.filter((g) => !(g in muscleStatus));
    if (missing.length) {
      const next = { ...muscleStatus };
      missing.forEach((g) => (next[g] = "maintenance"));
      setMuscleStatus(next);
    }
  }, [muscleGroups]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(id);
  }, [flash]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { focus: 0, progression: 0, maintenance: 0 };
    muscleGroups.forEach((g) => {
      const v = muscleStatus[g] || "progression";
      c[v] = (c[v] || 0) + 1;
    });
    return c;
  }, [muscleStatus, muscleGroups]);

  const setStatus = (g: string, val: string) => {
    const cur = muscleStatus[g] || "maintenance";
    if (cur === val) return;
    if (val === "focus" && counts.focus >= MAX_FOCUS && cur !== "focus") {
      setFlash({ type: "warn", msg: `Max ${MAX_FOCUS} muscles en focus. Passe-en un autre en progression ou maintenance d'abord.` });
      haptic("warning");
      return;
    }
    if (val === "progression" && counts.progression >= MAX_PROGRESSION && cur !== "progression") {
      setFlash({ type: "warn", msg: `Max ${MAX_PROGRESSION} muscles en progression. Passe-en un autre en maintenance d'abord.` });
      haptic("warning");
      return;
    }
    setMuscleStatus({ ...muscleStatus, [g]: val });
    haptic("light");
  };

  const bulkReset = () => {
    const next: Record<string, string> = {};
    muscleGroups.forEach((g) => (next[g] = "maintenance"));
    setMuscleStatus(next);
    haptic("light");
  };

  const targets = computeVolumeTargets({ level, muscleStatus, muscleGroups });
  const totalSets = Object.values(targets).reduce((a, v) => a + v, 0);
  const weeklyCap = frequency * MAX_SETS_PER_SESSION;
  const nameValid = name.trim().length > 0;

  const go = async () => {
    if (!nameValid) {
      setNameError(true);
      setFlash({ type: "error", msg: "Donne un nom à ton programme." });
      haptic("warning");
      return;
    }
    setBusy(true);
    try {
      const prog = generateProgram({ level, frequency, muscleStatus, subGroupSplit: subSplit, lib: exerciseLib, muscleGroups, name: name.trim() });
      const { replaceProgram } = await import("@/db/repo");
      await replaceProgram(data.userId!, prog);
      await data.setCurrentProgram(prog.id);
      await data.reload();
      haptic("success");
      router.replace(`/program/${prog.id}`);
    } finally {
      setBusy(false);
    }
  };

  const statusColor = (val: string) => (val === "focus" ? C.accent : val === "maintenance" ? C.ink3 : C.ink1);
  const statusBg = (val: string, active: boolean) => {
    if (!active) return C.bg3;
    if (val === "focus") return L.accentWash;
    if (val === "maintenance") return "rgba(120,120,130,.15)";
    return "rgba(52,199,89,.12)";
  };

  if (!ready) return <ScreenSkeleton paddingTop={insets.top + 12} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
          <Ionicons name="chevron-back" size={16} color={C.ink2} />
          <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Retour</Text>
        </Pressable>
        <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.9, color: C.ink0, marginBottom: 20 }}>Programme auto</Text>

        {flash && (
          <Animated.View
            entering={FadeIn.duration(MOTION.local)}
            exiting={FadeOut.duration(MOTION.micro)}
            style={{
              padding: 12,
              marginBottom: 14,
              borderRadius: 10,
              backgroundColor: flash.type === "error" ? L.dangerWash : L.goldWash,
              borderWidth: 1,
              borderColor: flash.type === "error" ? "rgba(255,59,72,.35)" : "rgba(255,194,51,.35)",
            }}
          >
            <Text style={{ color: flash.type === "error" ? C.danger : C.gold, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{flash.msg}</Text>
          </Animated.View>
        )}

        {/* NOM */}
        <Label style={{ marginBottom: 8 }}>
          Nom du programme <Text style={{ color: C.danger }}>*</Text>
        </Label>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (t.trim()) setNameError(false);
          }}
          placeholder="Ex: Lean bulk 4x/sem"
          placeholderTextColor={C.ink3}
          style={{
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: nameError && !nameValid ? C.danger : L.line,
            borderRadius: 12,
            color: C.ink0,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            marginBottom: 18,
          }}
        />

        {/* NIVEAU */}
        <Label style={{ marginBottom: 8 }}>Ton niveau</Label>
        <View style={{ flexDirection: "row", gap: 2, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 12, padding: 3, marginBottom: 14 }}>
          {(
            [
              ["debutant", "Débutant", "< 1 an"],
              ["intermediaire", "Intermédiaire", "1-3 ans"],
              ["confirme", "Confirmé", "3 ans +"],
            ] as const
          ).map(([v, l, sub]) => (
            <Pressable
              key={v}
              onPress={() => {
                setLevel(v);
                haptic("light");
              }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: level === v ? L.bgHover : "transparent", alignItems: "center" }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: level === v ? C.ink0 : C.ink2 }}>{l}</Text>
              <Text style={{ fontSize: 9, fontWeight: "600", color: level === v ? C.ink2 : C.ink3, marginTop: 2 }}>{sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* FREQUENCE */}
        <Label style={{ marginBottom: 8 }}>Séances par semaine</Label>
        <View style={{ flexDirection: "row", gap: 2, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 12, padding: 3, marginBottom: 18 }}>
          {[2, 3, 4, 5, 6].map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                setFrequency(n);
                haptic("light");
              }}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: frequency === n ? L.bgHover : "transparent", alignItems: "center" }}
            >
              <Text style={[mono, { fontSize: 12, fontWeight: "700", color: frequency === n ? C.ink0 : C.ink2 }]}>{n}x</Text>
            </Pressable>
          ))}
        </View>

        {/* STATUT PAR MUSCLE */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Label>Focus par muscle</Label>
          <Pressable onPress={bulkReset} style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: C.bg3, minHeight: 30, justifyContent: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: C.ink2 }}>Reset → maintenance</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 11, color: C.ink3, marginBottom: 6 }}>
          <Text style={{ color: C.accent, fontWeight: "700" }}>★ Focus</Text> +40% vol (max {MAX_FOCUS}) · <Text style={{ color: C.ink1 }}>↑ Progression</Text>{" "}
          baseline (max {MAX_PROGRESSION}) · <Text style={{ color: C.ink3 }}>= Maintenance</Text> 50% vol
        </Text>
        <Text style={[mono, { fontSize: 11, fontWeight: "600", color: C.ink2, marginBottom: 10 }]}>
          <Text style={{ color: counts.focus === MAX_FOCUS ? C.accent : C.ink2 }}>
            {counts.focus}/{MAX_FOCUS} focus
          </Text>{" "}
          ·{" "}
          <Text style={{ color: counts.progression === MAX_PROGRESSION ? C.success : C.ink2 }}>
            {counts.progression}/{MAX_PROGRESSION} progression
          </Text>{" "}
          · {counts.maintenance} maintenance
        </Text>

        <View style={{ gap: 6, marginBottom: 14 }}>
          {muscleGroups.map((g) => {
            const v = muscleStatus[g] || "maintenance";
            const subs = subGroups[g] || [];
            const hasSubGroups = subs.length > 0;
            const isOpen = expandedSub === g && hasSubGroups;
            const targetG = targets[g] || 0;
            const curSplit = subSplit[g] || SUB_GROUP_DEFAULT_SPLIT[g] || {};
            const fullSplit: Record<string, number> = {};
            subs.forEach((s) => {
              fullSplit[s] = curSplit[s] !== undefined ? curSplit[s] : SUB_GROUP_DEFAULT_SPLIT[g]?.[s] || Math.round(100 / subs.length);
            });
            const splitTotal = Object.values(fullSplit).reduce((a, x) => a + x, 0);
            const previewSeries = splitVolumeBySubGroups(g, targetG, fullSplit, subGroups) || {};
            const isCustom = subSplit[g] !== undefined;

            return (
              <View key={g} style={{ borderRadius: 10, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, gap: 8 }}>
                  {/* Zone gauche : dépliable si sous-groupes */}
                  <Pressable
                    disabled={!hasSubGroups}
                    onPress={() => setExpandedSub(isOpen ? null : g)}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, opacity: hasSubGroups ? 1 : 0.85 }}
                  >
                    {hasSubGroups && (
                      <View style={{ backgroundColor: L.accentWash, borderRadius: 6, padding: 4, borderWidth: 1, borderColor: "rgba(252,76,2,.35)" }}>
                        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={12} color={C.accentHi} />
                      </View>
                    )}
                    <View style={{ minWidth: 0 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink0 }}>
                        {g}
                        {isCustom && hasSubGroups && <Text style={{ fontSize: 9, fontWeight: "800", color: C.accentHi }}> CUSTOM</Text>}
                      </Text>
                      <Text style={[mono, { fontSize: 11, color: C.ink3, marginTop: 2 }]}>{targetG} séries/sem</Text>
                    </View>
                  </Pressable>
                  {/* Zone droite : boutons statut */}
                  <View style={{ flexDirection: "row", gap: 3 }}>
                    {(
                      [
                        ["maintenance", "="],
                        ["progression", "↑"],
                        ["focus", "★"],
                      ] as const
                    ).map(([val, icon]) => {
                      const active = v === val;
                      const disabled =
                        (val === "focus" && counts.focus >= MAX_FOCUS && !active) ||
                        (val === "progression" && counts.progression >= MAX_PROGRESSION && !active);
                      return (
                        <Pressable
                          key={val}
                          onPress={() => setStatus(g, val)}
                          style={{
                            minWidth: 38,
                            minHeight: 38,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 8,
                            backgroundColor: statusBg(val, active),
                            borderWidth: 1,
                            borderColor: active ? statusColor(val) + "40" : "transparent",
                            opacity: disabled ? 0.45 : 1,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "800", color: active ? statusColor(val) : disabled ? L.ink4 : C.ink3 }}>{icon}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Panel sous-groupes */}
                {isOpen && (
                  <View style={{ padding: 12, paddingBottom: 14, backgroundColor: C.bg3, borderTopWidth: 1, borderTopColor: L.line }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <Label>Répartition sous-groupes</Label>
                      {(isCustom || splitTotal !== 100) && (
                        <Pressable
                          onPress={() => {
                            const next = { ...subSplit };
                            delete next[g];
                            setSubSplit(next);
                            haptic("light");
                          }}
                          style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: C.bg2, minHeight: 30, justifyContent: "center" }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: C.ink2 }}>↺ Défaut</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ gap: 8 }}>
                      {subs.map((sub) => (
                        <SgSliderRow
                          key={sub}
                          name={sub}
                          pct={fullSplit[sub] || 0}
                          series={previewSeries[sub] || 0}
                          onChange={(newVal) => {
                            // Rebalance proportionnel des autres sous-groupes (port v40)
                            const others = subs.filter((s) => s !== sub);
                            const othersTotal = others.reduce((a, s) => a + (fullSplit[s] || 0), 0);
                            const remaining = Math.max(0, 100 - newVal);
                            const next: Record<string, number> = { [sub]: newVal };
                            if (othersTotal > 0) {
                              others.forEach((s) => {
                                next[s] = (fullSplit[s] || 0) * (remaining / othersTotal);
                              });
                            } else {
                              others.forEach((s) => {
                                next[s] = remaining / others.length;
                              });
                            }
                            setSubSplit({ ...subSplit, [g]: next });
                          }}
                        />
                      ))}
                    </View>
                    <Text style={{ fontSize: 10.5, color: C.ink3, fontStyle: "italic", marginTop: 10 }}>
                      Total {Math.round(splitTotal)}% · ajuste un curseur, les autres se rééquilibrent automatiquement.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* RÉSUMÉ */}
        <View
          style={{
            padding: 12,
            backgroundColor: C.bg2,
            borderWidth: 1,
            borderColor: L.line,
            borderRadius: 10,
            marginBottom: 8,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ fontSize: 11, color: C.ink3 }}>Volume total</Text>
            <Text style={[mono, { fontSize: 16, fontWeight: "800", color: C.ink0 }]}>{totalSets} séries/sem</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 11, color: C.ink3 }}>Capacité {frequency}x/sem</Text>
            <Text style={[mono, { fontSize: 16, fontWeight: "800", color: totalSets > weeklyCap ? C.gold : C.success }]}>{weeklyCap} séries</Text>
          </View>
        </View>
        {totalSets > weeklyCap && (
          <Text style={{ fontSize: 11, color: C.ink3, fontStyle: "italic", marginBottom: 10 }}>
            Le volume sera réparti intelligemment sur les {frequency} séances — certains muscles secondaires verront leur volume réduit si nécessaire.
          </Text>
        )}

        <Btn full onPress={go} disabled={busy} style={{ marginTop: 8 }}>
          ✓ Générer le programme
        </Btn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
