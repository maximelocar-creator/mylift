// Réglages — passe fonctionnelle (étape 6, à peaufiner ensuite) :
// compte + sync, programmes (choix du courant), bibliothèque (liste par muscle,
// ajout d'exo custom et de machines), groupes musculaires, import backup v40.
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, LinearTransition, Easing } from "react-native-reanimated";
import { C, L, MOTION, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { devResetIfTestAccount } from "@/lib/devReset";
import { MUSCLE_GROUPS_DEFAULT, programVolume, type Any } from "@/core/mylift";
import { Sheet, ConfirmSheet, Card, Chevron, Chip, Label, SectionLabel, Btn, PickerSheet, SyncDot, afterSheetClose, LINE, ACCENT_WASH } from "@/ui/kit";
import { haptic } from "@/lib/haptics";
import MuscleGroupsSection from "@/screens/MuscleGroupsSection";
import { healthAvailable, healthDiagnostic, initHealth, isHealthEnabled, setHealthEnabled } from "@/lib/health";
import { getRestTarget, setRestTarget, formatRestTarget, REST_TARGET_MIN, REST_TARGET_MAX, REST_TARGET_STEP, REST_TARGET_DEFAULT } from "@/lib/restTarget";

// Couleurs de machine (mêmes clés que v40)
const MODEL_COLOR_HEX: Record<string, string> = {
  coral: "#FC4C02", blue: "#378ADD", green: "#639922", purple: "#7F77DD",
  amber: "#EF9F27", pink: "#D4537E", teal: "#1D9E75",
};

/* Ligne d'exercice de la bibliothèque — lisible, cible tactile ≥48px,
   compte de machines visible, tap → gestion des machines. */
function ExoRow({ exo, showGroup, onPress }: { exo: Any; showGroup?: boolean; onPress: () => void }) {
  const nModels = exo.models?.length || 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        minHeight: 48,
        backgroundColor: pressed ? L.bgHover : C.bg3,
        borderWidth: 1,
        borderColor: LINE,
        borderRadius: 10,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: C.ink0 }}>
          {exo.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
          {showGroup && exo.muscleGroup ? exo.muscleGroup + " · " : ""}
          {exo.subGroup ? exo.subGroup + " · " : ""}
          {exo.compound ? "poly" : "iso"}
        </Text>
      </View>
      {nModels > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.06)" }}>
          <Ionicons name="hardware-chip-outline" size={11} color={C.ink2} />
          <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.ink2 }]}>{nModels}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={14} color={C.ink3} />
    </Pressable>
  );
}

export default function Params() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useData();
  const { profile, programs, exerciseLib, muscleGroups, subGroups, pendingSync } = data;

  const [libOpen, setLibOpen] = useState(false);
  const [newProgMenuOpen, setNewProgMenuOpen] = useState(false);
  const [newProgOpen, setNewProgOpen] = useState(false);
  const [newProgName, setNewProgName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [libMuscle, setLibMuscle] = useState<string | null>(null);
  const [libSearch, setLibSearch] = useState("");
  const [addExoOpen, setAddExoOpen] = useState(false);
  const [newExoName, setNewExoName] = useState("");
  const [newExoSub, setNewExoSub] = useState<string | null>(null);
  const [newExoCompound, setNewExoCompound] = useState(false);
  const [modelExo, setModelExo] = useState<Any | null>(null);
  const [restTarget, setRestTargetState] = useState(REST_TARGET_DEFAULT);
  useEffect(() => {
    if (data.userId) getRestTarget(data.userId).then(setRestTargetState);
  }, [data.userId]);
  const bumpRestTarget = (delta: number) => {
    if (!data.userId) return;
    const next = Math.min(REST_TARGET_MAX, Math.max(REST_TARGET_MIN, restTarget + delta));
    if (next === restTarget) {
      haptic("warning");
      return;
    }
    setRestTargetState(next);
    setRestTarget(data.userId, next);
    haptic("light");
  };

  const [healthOn, setHealthOn] = useState(false);
  const [healthMsg2, setHealthMsg2] = useState<string | null>(null);
  useEffect(() => {
    if (data.userId) isHealthEnabled(data.userId).then(setHealthOn);
  }, [data.userId]);

  const toggleHealth = async (on: boolean) => {
    if (!data.userId) return;
    setHealthMsg2(null);
    if (!on) {
      setHealthOn(false);
      await setHealthEnabled(data.userId, false);
      haptic("light");
      return;
    }
    if (!healthAvailable()) {
      setHealthMsg2("Indisponible — " + (healthDiagnostic() ?? "raison inconnue"));
      haptic("warning");
      return;
    }
    const granted = await initHealth(); // déclenche la popup de permission iOS
    if (granted) {
      setHealthOn(true);
      await setHealthEnabled(data.userId, true);
      setHealthMsg2("Activé ✓ — la sync tourne à chaque ouverture de l'écran Pesée.");
      haptic("success");
    } else {
      setHealthMsg2(
        (healthDiagnostic() ? "Échec (" + healthDiagnostic() + "). " : "") +
          "Vérifie dans Réglages iOS → Confidentialité → Santé → MyLift que lecture et écriture du poids sont autorisées."
      );
      haptic("error");
    }
  };
  const [newModelName, setNewModelName] = useState("");
  const [newModelSetting, setNewModelSetting] = useState("");
  const [editModel, setEditModel] = useState<Any | null>(null); // {id, name, setting, color}
  const [deleteModelConfirm, setDeleteModelConfirm] = useState<Any | null>(null);

  const groups = muscleGroups.length ? muscleGroups : MUSCLE_GROUPS_DEFAULT;
  const currentProgram = useMemo(() => programs.find((p) => p.id === profile?.currentProgramId) || programs[0] || null, [programs, profile]);

  const libByMuscle = useMemo(() => {
    const out: Record<string, Any[]> = {};
    exerciseLib.forEach((e) => {
      const g = e.muscleGroup || "Autre";
      if (!out[g]) out[g] = [];
      out[g].push(e);
    });
    return out;
  }, [exerciseLib]);

  // Recherche transverse dans toute la bibliothèque (≥2 caractères)
  const libResults = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    if (q.length < 2) return null;
    return exerciseLib
      .filter((e) => (e.name || "").toLowerCase().includes(q))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .slice(0, 40);
  }, [libSearch, exerciseLib]);

  const addExo = async () => {
    if (!libMuscle || newExoName.trim().length < 2) return;
    await data.addExercise({ name: newExoName.trim(), muscleGroup: libMuscle, subGroup: newExoSub, compound: newExoCompound });
    setNewExoName("");
    setNewExoSub(null);
    setNewExoCompound(false);
    setAddExoOpen(false);
  };

  const addModel = async () => {
    if (!modelExo || newModelName.trim().length < 2) return;
    await data.addExerciseModel(modelExo.id, { name: newModelName.trim(), setting: newModelSetting.trim() || null });
    setNewModelName("");
    setNewModelSetting("");
    setModelExo(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, minHeight: 44 }}>
        <Ionicons name="chevron-back" size={16} color={C.ink2} />
        <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Profil</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>Réglages.</Text>
        <SyncDot />
      </View>

      {/* Compte */}
      <Card style={{ marginBottom: 10 }}>
        <Text style={{ color: C.ink2, fontSize: 13, marginBottom: 4 }}>Connecté</Text>
        <Text style={{ color: C.ink0, fontSize: 18, fontWeight: "700" }}>@{profile?.username || "…"}</Text>
        <Text style={{ color: pendingSync > 0 ? C.gold : C.success, fontSize: 12, marginTop: 6 }}>
          {pendingSync > 0 ? `${pendingSync} écriture(s) en attente de sync` : "Synchronisé"}
        </Text>
      </Card>

      {/* Programmes */}
      <SectionLabel right={`${programs.length}`}>Programmes</SectionLabel>
      <View style={{ gap: 6, marginBottom: 6 }}>
        {programs.map((p) => {
          const active = p.id === currentProgram?.id;
          const vol = programVolume(p, exerciseLib);
          const totalSets = Object.values(vol.total).reduce((a: number, v: any) => a + v, 0);
          return (
            <View
              key={p.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 14,
                backgroundColor: active ? ACCENT_WASH : C.bg2,
                borderWidth: 1,
                borderColor: active ? "rgba(252,76,2,.4)" : LINE,
                borderRadius: 16,
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={() => { haptic("light"); data.setCurrentProgram(p.id); }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: active ? C.accentHi : C.ink0 }}>{p.name}</Text>
                <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                  {(p.sessions || []).length} séances · {totalSets} séries/sem
                  {p.level ? " · " + p.level : ""}
                </Text>
              </Pressable>
              {active && <Text style={{ color: C.accent, fontSize: 15 }}>✓</Text>}
              <Pressable
                onPress={() => router.push(`/program/${p.id}`)}
                hitSlop={6}
                style={{ padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,.05)" }}
              >
                <Ionicons name="pencil" size={14} color={C.ink2} />
              </Pressable>
            </View>
          );
        })}
        {programs.length === 0 && (
          <Text style={{ color: C.ink3, fontSize: 13, padding: 12 }}>
            Aucun programme. Importe ton backup v40 ou crée un programme vide.
          </Text>
        )}
        <Btn kind="ghost" sm full onPress={() => setNewProgMenuOpen(true)}>
          ＋ Nouveau programme
        </Btn>
      </View>

      {/* Bibliothèque — en-tête repliable, recherche transverse, dépli animé */}
      <Animated.View layout={LinearTransition.duration(260).easing(Easing.bezier(0.32, 0.72, 0, 1))} style={{ marginTop: 18 }}>
        <Pressable
          onPress={() => {
            setLibOpen(!libOpen);
            haptic("light");
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
            backgroundColor: pressed ? L.bgHover : C.bg2,
            borderWidth: 1,
            borderColor: LINE,
            borderRadius: 16,
            marginBottom: 10,
          })}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>Bibliothèque d'exercices</Text>
            <Text style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>
              {exerciseLib.length} exo{exerciseLib.length > 1 ? "s" : ""} · {groups.length} muscle{groups.length > 1 ? "s" : ""}
            </Text>
          </View>
          <Chevron open={libOpen} />
        </Pressable>

        {libOpen && (
          <Animated.View entering={FadeInDown.duration(MOTION.local)} style={{ marginBottom: 6 }}>
            {/* Recherche transverse */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(255,255,255,.04)",
                borderWidth: 1,
                borderColor: LINE,
                borderRadius: 12,
                paddingHorizontal: 12,
                marginBottom: 10,
              }}
            >
              <Ionicons name="search" size={15} color={C.ink3} />
              <TextInput
                value={libSearch}
                onChangeText={setLibSearch}
                placeholder="Rechercher un exercice…"
                placeholderTextColor={C.ink3}
                autoCapitalize="none"
                style={{ flex: 1, color: C.ink0, paddingVertical: 10, fontSize: 14 }}
              />
              {libSearch.length > 0 && (
                <Pressable onPress={() => setLibSearch("")} hitSlop={8} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color={C.ink3} />
                </Pressable>
              )}
            </View>

            {/* Résultats de recherche (toutes catégories confondues) */}
            {libResults !== null ? (
              <View style={{ gap: 5 }}>
                {libResults.length === 0 && (
                  <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center", paddingVertical: 18 }}>Aucun exercice pour « {libSearch.trim()} »</Text>
                )}
                {libResults.map((e, i) => (
                  <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i * 18, 180)).duration(MOTION.local)}>
                    <ExoRow exo={e} showGroup onPress={() => setModelExo(e)} />
                  </Animated.View>
                ))}
              </View>
            ) : (
              <Animated.View layout={LinearTransition.duration(260).easing(Easing.bezier(0.32, 0.72, 0, 1))} style={{ gap: 5 }}>
                {groups.map((g) => {
                  const exos = libByMuscle[g] || [];
                  const open = libMuscle === g;
                  return (
                    <Animated.View key={g} layout={LinearTransition.duration(260).easing(Easing.bezier(0.32, 0.72, 0, 1))}>
                      <Pressable
                        onPress={() => {
                          setLibMuscle(open ? null : g);
                          haptic("light");
                        }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          minHeight: 48,
                          backgroundColor: open ? ACCENT_WASH : pressed ? L.bgHover : C.bg2,
                          borderWidth: 1,
                          borderColor: open ? "rgba(252,76,2,.35)" : LINE,
                          borderRadius: 12,
                        })}
                      >
                        <Chevron open={open} size={14} color={open ? C.accentHi : C.ink3} />
                        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: open ? C.accentHi : C.ink0 }}>{g}</Text>
                        <Text style={[mono, { fontSize: 11.5, fontWeight: "700", color: C.ink3 }]}>{exos.length}</Text>
                      </Pressable>

                      {open && (
                        <Animated.View entering={FadeInDown.duration(MOTION.local)} style={{ paddingTop: 6, paddingLeft: 10, gap: 5 }}>
                          {exos.length === 0 && (
                            <Text style={{ fontSize: 12.5, color: C.ink3, paddingVertical: 8 }}>Aucun exercice dans ce muscle.</Text>
                          )}
                          {exos.map((e, i) => (
                            <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i * 16, 160)).duration(MOTION.local)}>
                              <ExoRow exo={e} onPress={() => setModelExo(e)} />
                            </Animated.View>
                          ))}
                          <Btn kind="ghost" sm full onPress={() => setAddExoOpen(true)} style={{ marginTop: 2, marginBottom: 4 }}>
                            ＋ Exercice dans {g}
                          </Btn>
                        </Animated.View>
                      )}
                    </Animated.View>
                  );
                })}
              </Animated.View>
            )}
          </Animated.View>
        )}
      </Animated.View>

      {/* Groupes musculaires — la section porte son propre en-tête repliable */}
      <View style={{ marginTop: 18 }}>
        <MuscleGroupsSection />
      </View>

      {/* Timer de repos */}
      <SectionLabel>Séance</SectionLabel>
      <View style={{ padding: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.ink0, fontSize: 14, fontWeight: "700" }}>Repos cible</Text>
            <Text style={{ color: C.ink3, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
              Durée visée du timer de repos (ajustable en séance par +30s).
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: C.bg3, borderWidth: 1, borderColor: LINE, borderRadius: 10, padding: 3 }}>
            <Pressable
              onPress={() => bumpRestTarget(-REST_TARGET_STEP)}
              disabled={restTarget <= REST_TARGET_MIN}
              hitSlop={6}
              style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", opacity: restTarget <= REST_TARGET_MIN ? 0.35 : 1 }}
            >
              <Text style={{ color: C.ink1, fontSize: 17, fontWeight: "800" }}>−</Text>
            </Pressable>
            <Text style={[mono, { minWidth: 48, textAlign: "center", fontSize: 15, fontWeight: "800", color: C.ink0 }]}>
              {formatRestTarget(restTarget)}
            </Text>
            <Pressable
              onPress={() => bumpRestTarget(REST_TARGET_STEP)}
              disabled={restTarget >= REST_TARGET_MAX}
              hitSlop={6}
              style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", opacity: restTarget >= REST_TARGET_MAX ? 0.35 : 1 }}
            >
              <Text style={{ color: C.accentHi, fontSize: 17, fontWeight: "800" }}>＋</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Apple Santé */}
      <SectionLabel>Apple Santé</SectionLabel>
      <View style={{ padding: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Tuile façon app Santé : cœur dégradé sur fond blanc */}
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
            }}
          >
            <Ionicons name="heart" size={19} color="#FF2D55" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.ink0, fontSize: 14, fontWeight: "700" }}>Synchroniser les pesées</Text>
            <Text style={{ color: C.ink3, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
              Lit le poids saisi ailleurs (balance, autre app) et écrit tes pesées MyLift dans Santé.
            </Text>
          </View>
          <Switch value={healthOn} onValueChange={toggleHealth} trackColor={{ true: C.accent }} />
        </View>
        {!!healthMsg2 && <Text style={{ color: C.ink2, fontSize: 11.5, marginTop: 8, lineHeight: 16 }}>{healthMsg2}</Text>}
      </View>

      {/* Données */}
      <SectionLabel>Données</SectionLabel>
      <Pressable onPress={() => router.push("/home")} style={{ padding: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16, marginBottom: 10 }}>
        <Text style={{ color: C.ink0, fontSize: 14, fontWeight: "700" }}>Importer le backup v40</Text>
        <Text style={{ color: C.ink3, fontSize: 12, marginTop: 2 }}>Fichier JSON exporté depuis la PWA · relançable sans doublon</Text>
      </Pressable>

      <Pressable onPress={async () => {
            try {
              await devResetIfTestAccount(); // no-op hors compte test@test.fr
            } catch {}
            supabase.auth.signOut();
          }} style={{ minHeight: 44, justifyContent: "center", marginTop: 8 }}>
        <Text style={{ color: C.ink3, textAlign: "center" }}>Se déconnecter</Text>
      </Pressable>

      {/* Sheet : menu nouveau programme (port v40) */}
      <Sheet open={newProgMenuOpen} onClose={() => setNewProgMenuOpen(false)} title="Nouveau programme">
        <Btn
          full
          onPress={() => {
            haptic("medium");
            setNewProgMenuOpen(false);
            router.push("/generator");
          }}
          style={{ marginBottom: 8 }}
        >
          Générateur auto
        </Btn>
        <Btn
          kind="ghost"
          full
          onPress={() => {
            haptic("light");
            setNewProgMenuOpen(false);
            setNewProgName("");
            afterSheetClose(() => setNewProgOpen(true));
          }}
        >
          Programme vide
        </Btn>
      </Sheet>

      {/* Sheet : nouveau programme vide */}
      <Sheet open={newProgOpen} onClose={() => setNewProgOpen(false)} title="Nom du programme">
        <TextInput
          value={newProgName}
          onChangeText={setNewProgName}
          placeholder="Ex: Mon programme"
          placeholderTextColor={C.ink3}
          autoFocus
          style={{
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: LINE,
            borderRadius: 12,
            color: C.ink0,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            marginBottom: 12,
          }}
        />
        {!!createError && <Text style={{ color: C.danger, fontSize: 12, marginBottom: 10 }}>{createError}</Text>}
        <Btn
          full
          disabled={!newProgName.trim()}
          onPress={async () => {
            try {
              const p = await data.createProgram(newProgName.trim());
              await data.setCurrentProgram(p.id);
              setNewProgOpen(false);
              haptic("success");
              afterSheetClose(() => router.push(`/program/${p.id}`));
            } catch (e: any) {
              haptic("error");
              setCreateError(e?.message ?? String(e));
            }
          }}
        >
          ✓ Créer
        </Btn>
      </Sheet>

      {/* Sheet : nouvel exo custom */}
      <Sheet open={addExoOpen} onClose={() => setAddExoOpen(false)} title={"Nouvel exo · " + (libMuscle || "")}>
        <Label style={{ marginBottom: 8 }}>Nom</Label>
        <TextInput
          value={newExoName}
          onChangeText={setNewExoName}
          placeholder="Curl poulie unilatéral"
          placeholderTextColor={C.ink3}
          style={{
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: LINE,
            borderRadius: 12,
            color: C.ink0,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            marginBottom: 12,
          }}
        />
        {!!libMuscle && (subGroups[libMuscle]?.length || 0) > 0 && (
          <>
            <Label style={{ marginBottom: 8 }}>Sous-muscle</Label>
            <View style={{ gap: 4, marginBottom: 12 }}>
              {(subGroups[libMuscle] || []).map((sg) => {
                const active = newExoSub === sg;
                return (
                  <Pressable
                    key={sg}
                    onPress={() => setNewExoSub(active ? null : sg)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      minHeight: 44,
                      borderRadius: 10,
                      backgroundColor: active ? ACCENT_WASH : C.bg3,
                      borderWidth: 1,
                      borderColor: active ? "rgba(252,76,2,.4)" : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: active ? C.accentHi : C.ink1 }}>{sg}</Text>
                    {active && <Ionicons name="checkmark" size={16} color={C.accent} />}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ color: C.ink1, fontSize: 14, fontWeight: "600" }}>Polyarticulaire</Text>
          <Switch value={newExoCompound} onValueChange={setNewExoCompound} trackColor={{ true: C.accent, false: C.bg3 }} />
        </View>
        <Btn full onPress={addExo} disabled={newExoName.trim().length < 2}>
          Créer
        </Btn>
      </Sheet>

      {/* Sheet : nouvelle machine pour un exo */}
      <Sheet open={!!modelExo} onClose={() => setModelExo(null)} title={modelExo ? "Machines · " + modelExo.name : ""}>
        {modelExo && (
          <View>
            {(modelExo.models || []).length > 0 && (
              <View style={{ gap: 4, marginBottom: 14 }}>
                {(modelExo.models || []).map((m: Any) => {
                  const em = editModel;
                  const isEditing = em?.id === m.id;
                  const hex = MODEL_COLOR_HEX[m.color || "coral"] || MODEL_COLOR_HEX.coral;
                  if (!isEditing || !em) {
                    // Géométrie stable : hauteur fixe, le setting change le contenu, pas la ligne
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setEditModel({ id: m.id, name: m.name, setting: m.setting || "", color: m.color || "coral" })}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingHorizontal: 12,
                          height: 56,
                          backgroundColor: C.bg3,
                          borderRadius: 10,
                        }}
                      >
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hex }} />
                        <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: C.ink0 }}>
                            {m.name}
                          </Text>
                          <Text numberOfLines={1} style={{ fontSize: 11, color: C.ink3, fontStyle: m.setting ? "italic" : "normal", marginTop: 1 }}>
                            {m.setting || "aucun réglage"}
                          </Text>
                        </View>
                        <Ionicons name="pencil" size={13} color={C.ink3} />
                      </Pressable>
                    );
                  }
                  return (
                    <View key={m.id} style={{ padding: 12, backgroundColor: C.bg3, borderRadius: 10, borderWidth: 1, borderColor: "rgba(252,76,2,.35)", gap: 8 }}>
                      <TextInput
                        value={em.name}
                        onChangeText={(t) => setEditModel({ ...em, name: t })}
                        placeholder="Nom de la machine"
                        placeholderTextColor={C.ink3}
                        style={{ backgroundColor: "rgba(255,255,255,.05)", borderRadius: 8, color: C.ink0, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: "700" }}
                      />
                      <TextInput
                        value={em.setting}
                        onChangeText={(t) => setEditModel({ ...em, setting: t })}
                        placeholder="Réglage (siège 4, dossier 2…)"
                        placeholderTextColor={C.ink3}
                        style={{ backgroundColor: "rgba(255,255,255,.05)", borderRadius: 8, color: C.ink0, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 }}
                      />
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        {Object.entries(MODEL_COLOR_HEX).map(([key, cHex]) => (
                          <Pressable
                            key={key}
                            onPress={() => setEditModel({ ...em, color: key })}
                            hitSlop={6}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: cHex,
                              borderWidth: em.color === key ? 2 : 0,
                              borderColor: C.ink0,
                            }}
                          />
                        ))}
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <Pressable onPress={() => setDeleteModelConfirm(m)} hitSlop={6} style={{ padding: 8 }}>
                          <Ionicons name="trash-outline" size={16} color={C.danger} />
                        </Pressable>
                        <Btn kind="ghost" sm onPress={() => setEditModel(null)} style={{ flex: 1 }}>
                          Annuler
                        </Btn>
                        <Btn
                          sm
                          disabled={!em.name.trim()}
                          onPress={async () => {
                            await data.updateExerciseModel(em.id, {
                              name: em.name.trim(),
                              setting: em.setting.trim() || null,
                              color: em.color,
                            });
                            setEditModel(null);
                            haptic("success");
                          }}
                          style={{ flex: 1 }}
                        >
                          Enregistrer
                        </Btn>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            <Label style={{ marginBottom: 8 }}>Nouvelle machine</Label>
            <TextInput
              value={newModelName}
              onChangeText={setNewModelName}
              placeholder="Hammer Strength"
              placeholderTextColor={C.ink3}
              style={{
                backgroundColor: "rgba(255,255,255,.04)",
                borderWidth: 1,
                borderColor: LINE,
                borderRadius: 12,
                color: C.ink0,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                marginBottom: 10,
              }}
            />
            <TextInput
              value={newModelSetting}
              onChangeText={setNewModelSetting}
              placeholder="Réglage (siège 4, dossier 2…)"
              placeholderTextColor={C.ink3}
              style={{
                backgroundColor: "rgba(255,255,255,.04)",
                borderWidth: 1,
                borderColor: LINE,
                borderRadius: 12,
                color: C.ink0,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                marginBottom: 16,
              }}
            />
            <Btn full onPress={addModel} disabled={newModelName.trim().length < 2}>
              Ajouter
            </Btn>
          </View>
        )}
      </Sheet>

      {/* Suppression machine */}
      <ConfirmSheet
        open={!!deleteModelConfirm}
        onClose={() => setDeleteModelConfirm(null)}
        onConfirm={async () => {
          const m = deleteModelConfirm;
          setDeleteModelConfirm(null);
          setEditModel(null);
          if (m) await data.deleteExerciseModel(m.id);
        }}
        title="Supprimer cette machine ?"
        message={deleteModelConfirm ? `"${deleteModelConfirm.name}" sera supprimée. L'historique des séries faites dessus est conservé dans le journal.` : ""}
      />
    </ScrollView>
  );
}
