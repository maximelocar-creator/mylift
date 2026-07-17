// Éditeur de programme — port v40 ParamsProgram + EditVariantsSheet.
// CRUD complet : séances (ajout/rename/suppression), exos (ajout via picker
// recherche+filtre muscle, réordonnancement, déplacement inter-séances,
// suppression), séries (stepper 1-6), cibles par machine (program_model_targets),
// variantes planifiées (principale ★ + ajout depuis la biblio du même muscle).
// Toutes les écritures passent par store.updateProgram (copie mutée → diff SQLite
// + queue de sync), sémantique identique au updateCurrentProgram v40.
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, R, L, mono } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { useData } from "@/lib/store";
import { programVolume, splitVolumeBySubGroups, computeVolumeTargets, validateMuscleStatus, SUB_GROUPS_DEFAULT, type Any } from "@/core/mylift";
import { Sheet, ConfirmSheet, Btn, Chip, Label, PickerSheet, ScreenSkeleton } from "@/ui/kit";
import { uid } from "@/db/repo";

/* ------------------------------------------------------------------ */
/* Barre de volume compacte (port VolumeBar v40)                       */
/* ------------------------------------------------------------------ */
function VolumeBar({ label, actual, target, compact }: { label: string; actual: number; target: number; compact?: boolean }) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : actual > 0 ? 100 : 0;
  const color = target === 0 ? L.ink4 : actual >= target ? (actual > target * 1.1 ? C.gold : C.success) : actual >= target * 0.5 ? C.accent : L.ink4;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text numberOfLines={1} style={{ width: compact ? 70 : 78, fontSize: compact ? 11 : 12, fontWeight: "600", color: compact ? C.ink2 : C.ink1 }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: compact ? 4 : 6, backgroundColor: C.bg3, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
      </View>
      <Text style={[mono, { width: 52, textAlign: "right", fontSize: compact ? 10 : 11, fontWeight: "600", color: C.ink2 }]}>
        <Text style={{ color: C.ink0, fontWeight: "700" }}>{actual}</Text>
        {target ? " / " + target : ""}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* EditVariantsSheet — port v40                                        */
/* ------------------------------------------------------------------ */
function EditVariantsSheet({
  open,
  onClose,
  target,
  program,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  target: { sid: string; exIdx: number } | null;
  program: Any | null;
  onSave: (choices: Any[]) => void;
}) {
  const { exerciseLib } = useData();
  const [choices, setChoices] = useState<Any[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    const sess = program?.sessions?.find((s: Any) => s.id === target.sid);
    const ex = sess?.exercises?.[target.exIdx];
    // Nettoyage v40 : on retire les `sets` divergents par variante (ancienne donnée)
    const cleaned = (ex?.choices || []).map((c: Any) => {
      const { sets, ...rest } = c || {};
      return rest;
    });
    setChoices(cleaned);
  }, [open, target, program]);

  if (!open || !target) return null;
  const principalMuscle = choices[0]?.muscleGroup;
  const usedIds = new Set(choices.map((c) => c.exId).filter(Boolean));
  const pool = principalMuscle
    ? exerciseLib.filter((l) => l.muscleGroup === principalMuscle && !usedIds.has(l.id))
    : exerciseLib.filter((l) => !usedIds.has(l.id));

  const addVariant = (libEx: Any) => {
    setChoices([...choices, { exId: libEx.id, weight: "", machine: "", muscleGroup: libEx.muscleGroup, subGroup: libEx.subGroup || null }]);
    setPickerOpen(false);
  };
  const updateWeight = (idx: number, w: string) => {
    const next = [...choices];
    next[idx] = { ...next[idx], weight: w };
    setChoices(next);
  };
  const removeVariant = (idx: number) => {
    if (choices.length <= 1) {
      haptic("warning");
      return;
    }
    const next = [...choices];
    next.splice(idx, 1);
    setChoices(next);
    haptic("light");
  };
  const setAsPrincipal = (idx: number) => {
    if (idx === 0) return;
    const next = [...choices];
    const [moved] = next.splice(idx, 1);
    next.unshift(moved);
    setChoices(next);
    haptic("light");
  };
  const updateModelTargetForChoice = (choiceIdx: number, modelId: string, weight: string) => {
    const next = [...choices];
    const ch = { ...next[choiceIdx] };
    const targets = ch.modelTargets ? [...ch.modelTargets] : [];
    const existing = targets.find((t: Any) => t.modelId === modelId);
    const w = weight === "" ? "" : parseFloat(weight) || "";
    if (existing) existing.weight = w;
    else targets.push({ modelId, weight: w });
    ch.modelTargets = targets;
    next[choiceIdx] = ch;
    setChoices(next);
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Variantes de l'exercice">
        <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 12 }}>
          Variante 1 = principale par défaut. Pendant la séance, tu pourras switcher entre variantes.
        </Text>
        <View style={{ gap: 8, marginBottom: 10 }}>
          {choices.map((ch, idx) => {
            const libEx = ch.exId ? exerciseLib.find((l) => l.id === ch.exId) : null;
            const isPrincipal = idx === 0;
            const variantModels = libEx?.models || [];
            const variantTargets = ch.modelTargets || [];
            const hasModels = variantModels.length > 0;
            return (
              <View
                key={idx}
                style={{
                  padding: 12,
                  backgroundColor: isPrincipal ? L.accentWash : C.bg3,
                  borderWidth: 1,
                  borderColor: isPrincipal ? "rgba(252,76,2,.35)" : L.line,
                  borderRadius: 10,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: isPrincipal ? C.accent : C.ink3 }}>
                      {isPrincipal ? "★ Principale" : "Variante " + (idx + 1)}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0, marginTop: 2 }}>
                      {libEx?.name || ch.name || "?"}
                    </Text>
                    {!!libEx?.subGroup && <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{libEx.subGroup}</Text>}
                  </View>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {!isPrincipal && (
                      <Pressable onPress={() => setAsPrincipal(idx)} hitSlop={6} style={{ padding: 6 }}>
                        <Text style={{ color: C.accent, fontSize: 14, fontWeight: "700" }}>★</Text>
                      </Pressable>
                    )}
                    {choices.length > 1 && (
                      <Pressable onPress={() => removeVariant(idx)} hitSlop={6} style={{ padding: 6 }}>
                        <Ionicons name="close" size={15} color={C.danger} />
                      </Pressable>
                    )}
                  </View>
                </View>
                {!hasModels && (
                  <View>
                    <Label style={{ marginBottom: 3 }}>Poids cible (kg)</Label>
                    <TextInput
                      value={ch.weight === null || ch.weight === undefined ? "" : String(ch.weight)}
                      onChangeText={(t) => updateWeight(idx, t)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={C.ink3}
                      style={[
                        mono,
                        {
                          backgroundColor: "rgba(255,255,255,.04)",
                          borderWidth: 1,
                          borderColor: L.line,
                          borderRadius: 8,
                          color: C.ink0,
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          fontSize: 12,
                          textAlign: "center",
                        },
                      ]}
                    />
                  </View>
                )}
                {hasModels && (
                  <View style={{ marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.08)", gap: 6 }}>
                    <Label>Modèles</Label>
                    {variantModels.map((m: Any) => {
                      const programmed = variantTargets.find((t: Any) => t.modelId === m.id);
                      return (
                        <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: C.ink1 }}>
                            {m.name}
                          </Text>
                          <TextInput
                            value={programmed?.weight === null || programmed?.weight === undefined ? "" : String(programmed.weight)}
                            onChangeText={(t) => updateModelTargetForChoice(idx, m.id, t)}
                            keyboardType="decimal-pad"
                            placeholder="kg"
                            placeholderTextColor={C.ink3}
                            style={[
                              mono,
                              {
                                width: 60,
                                backgroundColor: "rgba(255,255,255,.04)",
                                borderWidth: 1,
                                borderColor: L.line,
                                borderRadius: 8,
                                color: C.ink0,
                                paddingVertical: 4,
                                paddingHorizontal: 6,
                                fontSize: 11,
                                textAlign: "center",
                              },
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {pool.length > 0 && (
          <Btn kind="ghost" full onPress={() => setPickerOpen(true)} style={{ marginBottom: 10 }}>
            ＋ Ajouter une variante
          </Btn>
        )}
        <Btn full onPress={() => onSave(choices)}>
          ✓ Enregistrer
        </Btn>
      </Sheet>
      <PickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Ajouter une variante"
        search
        options={pool.map((l) => ({ value: l.id, label: l.name, sub: (l.subGroup ? l.subGroup + " · " : "") + (l.compound ? "poly" : "iso") }))}
        onPick={(id) => {
          const libEx = exerciseLib.find((l) => l.id === id);
          if (libEx) addVariant(libEx);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Éditeur principal                                                   */
/* ------------------------------------------------------------------ */
export default function ProgramEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData();
  const { programs, exerciseLib, muscleGroups, subGroups, ready } = data;
  const program = programs.find((p) => p.id === id) || null;

  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("Séance");
  const [renameSession, setRenameSession] = useState<Any | null>(null);
  const [renameSessionVal, setRenameSessionVal] = useState("");
  const [deleteProgOpen, setDeleteProgOpen] = useState(false);
  const [deleteSessionOpen, setDeleteSessionOpen] = useState<Any | null>(null);
  const [addExoTo, setAddExoTo] = useState<string | null>(null);
  const [pickerMuscle, setPickerMuscle] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [muscleFilterOpen, setMuscleFilterOpen] = useState(false);
  const [delExoOpen, setDelExoOpen] = useState<Any | null>(null);
  const [moveToSessionFor, setMoveToSessionFor] = useState<Any | null>(null);
  const [editVariantsFor, setEditVariantsFor] = useState<{ sid: string; exIdx: number } | null>(null);
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const [statusSel, setStatusSel] = useState<Record<string, string>>({});

  const pv = useMemo(() => programVolume(program, exerciseLib), [program, exerciseLib]);
  const targets: Record<string, number> = program?.volumeTargets?.program || {};

  if (!ready) return <ScreenSkeleton paddingTop={insets.top + 12} />;
  if (!program) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg0, alignItems: "center", justifyContent: "center", padding: 40 }}>
        <Text style={{ color: C.ink2, fontWeight: "700", marginBottom: 16 }}>Programme introuvable</Text>
        <Btn kind="ghost" onPress={() => router.back()}>Retour</Btn>
      </View>
    );
  }

  const update = (mutator: (p: Any) => void) => data.updateProgram(program.id, mutator);

  const addSession = async () => {
    if (!newSessionName.trim()) return;
    await update((p) => {
      p.sessions.push({ id: uid(), name: newSessionName.trim(), exercises: [] });
    });
    setNewSessionName("Séance");
    setAddSessionOpen(false);
    haptic("success");
  };

  const addExoToSession = async (libEx: Any) => {
    const sid = addExoTo;
    if (!sid) return;
    await update((p) => {
      const s = p.sessions.find((x: Any) => x.id === sid);
      if (!s) return;
      s.exercises.push({
        id: uid(),
        sets: 3,
        muscleGroup: libEx.muscleGroup,
        choices: [{ exId: libEx.id, weight: "", machine: "", muscleGroup: libEx.muscleGroup }],
        isCompound: !!libEx.compound,
        history: [],
      });
    });
    setAddExoTo(null);
    setPickerMuscle("");
    setPickerQuery("");
    haptic("success");
  };

  const updateExoSets = (sid: string, exIdx: number, sets: number) =>
    update((p) => {
      const s = p.sessions.find((x: Any) => x.id === sid);
      if (s && s.exercises[exIdx]) s.exercises[exIdx].sets = Math.max(1, sets || 1);
    });

  const updateExoWeight = (sid: string, exIdx: number, weight: string) =>
    update((p) => {
      const s = p.sessions.find((x: Any) => x.id === sid);
      if (s && s.exercises[exIdx]?.choices?.[0]) s.exercises[exIdx].choices[0].weight = weight;
    });

  const updateExoModelTarget = (sid: string, exIdx: number, modelId: string, weight: string) =>
    update((p) => {
      const s = p.sessions.find((x: Any) => x.id === sid);
      if (!s || !s.exercises[exIdx]) return;
      const ex = s.exercises[exIdx];
      const mts = ex.modelTargets || [];
      const existing = mts.find((t: Any) => t.modelId === modelId);
      const w = weight === "" ? "" : parseFloat(weight) || "";
      if (existing) existing.weight = w;
      else mts.push({ modelId, weight: w });
      ex.modelTargets = mts;
    });

  const moveExo = (sid: string, exIdx: number, dir: number) => {
    haptic("light");
    update((p) => {
      const s = p.sessions.find((x: Any) => x.id === sid);
      if (!s) return;
      const ni = exIdx + dir;
      if (ni < 0 || ni >= s.exercises.length) return;
      [s.exercises[exIdx], s.exercises[ni]] = [s.exercises[ni], s.exercises[exIdx]];
    });
  };

  const moveExoToSession = async (sourceSid: string, exIdx: number, targetSid: string) => {
    if (sourceSid === targetSid) return;
    await update((p) => {
      const src = p.sessions.find((x: Any) => x.id === sourceSid);
      const tgt = p.sessions.find((x: Any) => x.id === targetSid);
      if (!src || !tgt || !src.exercises[exIdx]) return;
      const [moved] = src.exercises.splice(exIdx, 1);
      tgt.exercises.push(moved);
    });
    setExpandedSession(targetSid);
    setMoveToSessionFor(null);
    haptic("success");
  };

  // Widget volume programme (port renderVolumeWidget)
  const groupsWithActivity = [...new Set([...Object.keys(targets), ...Object.keys(pv.total)])].filter(
    (g) => (pv.total[g] || 0) > 0 || (targets[g] || 0) > 0
  );
  groupsWithActivity.sort((a, b) => (targets[b] || 0) - (targets[a] || 0));
  const subTargetsCfg: Record<string, Record<string, number>> = program?.volumeTargets?.subGroups || {};
  const totalProgramSets = Object.values(pv.total).reduce((a: number, v: any) => a + (v || 0), 0);
  const totalProgramTarget = Object.values(targets).reduce((a: number, v: any) => a + (parseInt(String(v)) || 0), 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
      {/* Retour */}
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
        <Ionicons name="chevron-back" size={16} color={C.ink2} />
        <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Réglages</Text>
      </Pressable>

      {/* Nom + actions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TextInput
          value={nameDraft ?? program.name}
          onChangeText={setNameDraft}
          onBlur={() => {
            const v = (nameDraft ?? "").trim();
            if (v && v !== program.name) {
              update((p) => {
                p.name = v;
              });
            }
            setNameDraft(null);
          }}
          style={{
            flex: 1,
            fontWeight: "700",
            fontSize: 16,
            color: C.ink0,
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: L.line,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        />
        <Pressable
          onPress={async () => {
            const copy = await data.duplicateProgram(program.id);
            haptic("success");
            if (copy) router.replace(`/program/${copy.id}`);
          }}
          style={{ padding: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,.07)", minHeight: 44, justifyContent: "center" }}
        >
          <Ionicons name="copy-outline" size={16} color={C.ink1} />
        </Pressable>
        <Pressable
          onPress={() => setDeleteProgOpen(true)}
          style={{ padding: 10, borderRadius: 10, backgroundColor: L.dangerWash, minHeight: 44, justifyContent: "center" }}
        >
          <Ionicons name="trash-outline" size={16} color={C.danger} />
        </Pressable>
      </View>

      {/* Meta + focus muscles */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, flex: 1, minWidth: 0 }}>
          {!!program.level && <Chip>{program.level}</Chip>}
          {!!program.frequency && <Chip>{program.frequency}x/sem</Chip>}
          {(program.muscleStatus
            ? Object.entries(program.muscleStatus)
                .filter(([, v]) => v === "focus")
                .map(([g]) => g)
            : program.priorities || []
          ).map((g: string) => (
            <Chip key={g} tone="primary">
              ★ {g}
            </Chip>
          ))}
        </View>
        <Btn
          kind="ghost"
          sm
          onPress={() => {
            // Restaure depuis muscleStatus, sinon priorities (legacy), sinon maintenance partout (port v40)
            const init: Record<string, string> = {};
            if (program.muscleStatus && Object.keys(program.muscleStatus).length) {
              Object.assign(init, program.muscleStatus);
            } else {
              muscleGroups.forEach((g) => (init[g] = "maintenance"));
              (program.priorities || []).forEach((g: string) => (init[g] = "focus"));
            }
            setStatusSel(init);
            setEditStatusOpen(true);
          }}
        >
          ★ Focus muscles
        </Btn>
      </View>

      {/* Volume programme */}
      {groupsWithActivity.length > 0 && (
        <View style={{ padding: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 12, marginBottom: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Label>Volume programme</Label>
            <Pressable
              onPress={() => router.push(`/volume/${program.id}`)}
              hitSlop={6}
              style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: "rgba(255,255,255,.05)" }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: C.accentHi }}>✎ Cibles</Text>
            </Pressable>
            <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.ink2 }]}>
              <Text style={{ color: C.ink0 }}>{totalProgramSets}</Text>
              {totalProgramTarget > 0 ? <Text style={{ color: C.ink3 }}> / {totalProgramTarget}</Text> : null}
              <Text style={{ color: C.ink3 }}> séries/sem</Text>
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {groupsWithActivity.map((g) => {
              const subs = subGroups[g] || SUB_GROUPS_DEFAULT[g] || [];
              const subActual = pv.totalSub?.[g] || {};
              const subTgt = subTargetsCfg[g] || (targets[g] ? splitVolumeBySubGroups(g, targets[g], null, subGroups) : null) || {};
              return (
                <View key={g}>
                  <VolumeBar label={g} actual={pv.total[g] || 0} target={targets[g] || 0} />
                  {subs.length > 0 && (
                    <View style={{ paddingLeft: 16, marginTop: 4, gap: 4, borderLeftWidth: 1, borderLeftColor: L.line, marginLeft: 6 }}>
                      {subs.map((sg) => (
                        <View key={sg} style={{ opacity: 0.78 }}>
                          <VolumeBar label={sg} actual={subActual[sg] || 0} target={(subTgt as Any)[sg] || 0} compact />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Séances */}
      {(program.sessions || []).map((s: Any) => {
        const expanded = expandedSession === s.id;
        const sessionVol: Record<string, number> = pv.perSession[s.id] || {};
        const sessionVolTotal = Object.values(sessionVol).reduce((a, v) => a + v, 0);
        return (
          <View key={s.id} style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: R.md, marginBottom: 8, overflow: "hidden" }}>
            {/* En-tête séance */}
            <Pressable
              onPress={() => setExpandedSession(expanded ? null : s.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 13 }}
            >
              <View style={{ backgroundColor: L.accentWash, borderRadius: 6, padding: 4, borderWidth: 1, borderColor: "rgba(252,76,2,.35)" }}>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={12} color={C.accentHi} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontWeight: "700", color: C.ink0, fontSize: 14 }}>
                {s.name}
              </Text>
              <Text style={[mono, { fontSize: 11, color: C.ink3 }]}>{sessionVolTotal} séries</Text>
              <Pressable
                onPress={() => {
                  setRenameSession(s);
                  setRenameSessionVal(s.name);
                }}
                hitSlop={6}
                style={{ padding: 6 }}
              >
                <Ionicons name="pencil" size={14} color={C.ink2} />
              </Pressable>
              <Pressable onPress={() => setDeleteSessionOpen(s)} hitSlop={6} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={14} color={C.danger} />
              </Pressable>
            </Pressable>

            {expanded && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                {/* Mini-breakdown volume séance */}
                {Object.keys(sessionVol).length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {Object.entries(sessionVol)
                      .sort((a, b) => b[1] - a[1])
                      .map(([g, v]) => (
                        <Chip key={g}>
                          {g} {v}
                        </Chip>
                      ))}
                  </View>
                )}

                {/* Exos */}
                {(s.exercises || []).map((ex: Any, ei: number) => {
                  const c = ex.choices?.[0];
                  const libEx = c?.exId ? exerciseLib.find((l) => l.id === c.exId) : null;
                  const nVariants = (ex.choices || []).length;
                  const models = libEx?.models || [];
                  const modelTargets = ex.modelTargets || [];
                  const hasModels = models.length > 0;
                  const setting = libEx?.setting;
                  const sets = parseInt(ex.sets) || 1;
                  return (
                    <View key={ex.id} style={{ backgroundColor: C.bg3, borderRadius: 10, marginBottom: 4, padding: 11, gap: 8 }}>
                      {/* Ligne principale */}
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: C.ink0, flexShrink: 1 }}>
                              {libEx?.name || ex.exName || "?"}
                            </Text>
                            {!!libEx?.compound && (
                              <View style={{ backgroundColor: L.bgHover, paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4 }}>
                                <Text style={{ fontSize: 8, color: C.ink2, fontWeight: "600" }}>poly</Text>
                              </View>
                            )}
                          </View>
                          <Text numberOfLines={1} style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                            {libEx?.muscleGroup || ex.muscleGroup}
                            {libEx?.subGroup ? " · " + libEx.subGroup : ""}
                          </Text>
                          {!!setting && !hasModels && (
                            <Text numberOfLines={1} style={{ fontSize: 10, color: C.ink3, marginTop: 3, fontStyle: "italic" }}>
                              {setting}
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 6 }}>
                          <View style={{ flexDirection: "row", gap: 2 }}>
                            <Pressable onPress={() => moveExo(s.id, ei, -1)} disabled={ei === 0} hitSlop={4} style={{ padding: 4, opacity: ei === 0 ? 0.3 : 1 }}>
                              <Ionicons name="chevron-up" size={14} color={C.ink3} />
                            </Pressable>
                            <Pressable
                              onPress={() => moveExo(s.id, ei, 1)}
                              disabled={ei === s.exercises.length - 1}
                              hitSlop={4}
                              style={{ padding: 4, opacity: ei === s.exercises.length - 1 ? 0.3 : 1 }}
                            >
                              <Ionicons name="chevron-down" size={14} color={C.ink3} />
                            </Pressable>
                            <Pressable
                              onPress={() => setDelExoOpen({ sid: s.id, exIdx: ei, exName: libEx?.name || ex.exName || "cet exercice" })}
                              hitSlop={4}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="close" size={14} color={C.danger} />
                            </Pressable>
                          </View>
                          {(program.sessions || []).length > 1 && (
                            <Pressable
                              onPress={() => setMoveToSessionFor({ sid: s.id, exIdx: ei, exName: libEx?.name || ex.exName || "cet exercice" })}
                              style={{
                                paddingVertical: 2,
                                paddingHorizontal: 6,
                                borderRadius: 6,
                                backgroundColor: "rgba(255,255,255,.04)",
                                borderWidth: 1,
                                borderColor: L.line,
                              }}
                            >
                              <Text style={{ fontSize: 9, fontWeight: "700", color: C.ink3 }}>⇄ vers séance</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>

                      {/* Séries + cible */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                            backgroundColor: C.bg2,
                            borderWidth: 1,
                            borderColor: L.line,
                            borderRadius: 8,
                            padding: 2,
                          }}
                        >
                          <Pressable
                            onPress={() => {
                              haptic("light");
                              updateExoSets(s.id, ei, sets - 1);
                            }}
                            disabled={sets <= 1}
                            style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center", opacity: sets <= 1 ? 0.3 : 1 }}
                          >
                            <Text style={{ color: C.ink2, fontSize: 16, fontWeight: "700" }}>−</Text>
                          </Pressable>
                          <Text style={[mono, { minWidth: 28, textAlign: "center", fontSize: 13, fontWeight: "800", color: C.ink0 }]}>{sets}×</Text>
                          <Pressable
                            onPress={() => {
                              haptic("light");
                              updateExoSets(s.id, ei, sets + 1);
                            }}
                            disabled={sets >= 6}
                            style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center", opacity: sets >= 6 ? 0.3 : 1 }}
                          >
                            <Text style={{ color: C.accent, fontSize: 16, fontWeight: "700" }}>+</Text>
                          </Pressable>
                        </View>
                        {!hasModels ? (
                          <TextInput
                            defaultValue={c?.weight === null || c?.weight === undefined ? "" : String(c.weight)}
                            onEndEditing={(e) => updateExoWeight(s.id, ei, e.nativeEvent.text)}
                            keyboardType="decimal-pad"
                            placeholder="kg cible"
                            placeholderTextColor={C.ink3}
                            style={[
                              mono,
                              {
                                flex: 1,
                                backgroundColor: "rgba(255,255,255,.04)",
                                borderWidth: 1,
                                borderColor: L.line,
                                borderRadius: 8,
                                color: C.ink0,
                                paddingVertical: 6,
                                paddingHorizontal: 8,
                                fontSize: 12,
                                textAlign: "center",
                              },
                            ]}
                          />
                        ) : (
                          <Text style={{ flex: 1, fontSize: 10, color: C.ink3, fontStyle: "italic", textAlign: "right" }}>
                            {models.length} modèle{models.length > 1 ? "s" : ""}
                          </Text>
                        )}
                      </View>

                      {/* Cibles par machine */}
                      {hasModels && (
                        <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.05)", gap: 4 }}>
                          {models.map((m: Any) => {
                            const programmed = modelTargets.find((t: Any) => t.modelId === m.id);
                            return (
                              <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: C.ink1 }}>
                                  {m.name}
                                </Text>
                                <TextInput
                                  defaultValue={programmed?.weight === null || programmed?.weight === undefined ? "" : String(programmed.weight)}
                                  onEndEditing={(e) => updateExoModelTarget(s.id, ei, m.id, e.nativeEvent.text)}
                                  keyboardType="decimal-pad"
                                  placeholder="kg"
                                  placeholderTextColor={C.ink3}
                                  style={[
                                    mono,
                                    {
                                      width: 60,
                                      backgroundColor: "rgba(255,255,255,.04)",
                                      borderWidth: 1,
                                      borderColor: L.line,
                                      borderRadius: 8,
                                      color: C.ink0,
                                      paddingVertical: 4,
                                      paddingHorizontal: 6,
                                      fontSize: 11,
                                      textAlign: "center",
                                    },
                                  ]}
                                />
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Variantes */}
                      <Pressable onPress={() => setEditVariantsFor({ sid: s.id, exIdx: ei })} style={{ alignSelf: "flex-start", paddingVertical: 3, minHeight: 30, justifyContent: "center" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: nVariants > 1 ? C.accentHi : C.ink3 }}>
                          {nVariants > 1 ? `${nVariants} variantes d'exo ▸` : "+ variante d'exo"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}

                <Btn
                  kind="ghost"
                  sm
                  full
                  onPress={() => {
                    setAddExoTo(s.id);
                    setPickerMuscle("");
                    setPickerQuery("");
                  }}
                  style={{ marginTop: 6 }}
                >
                  ＋ Exercice
                </Btn>
              </View>
            )}
          </View>
        );
      })}

      <Btn kind="ghost" full onPress={() => setAddSessionOpen(true)} style={{ marginTop: 10 }}>
        ＋ Ajouter une séance
      </Btn>

      {/* ---- Sheets ---- */}

      {/* Nouvelle séance */}
      <Sheet open={addSessionOpen} onClose={() => setAddSessionOpen(false)} title="Nouvelle séance">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={newSessionName}
            onChangeText={setNewSessionName}
            autoFocus
            style={{
              flex: 1,
              backgroundColor: "rgba(255,255,255,.04)",
              borderWidth: 1,
              borderColor: L.line,
              borderRadius: 12,
              color: C.ink0,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
            }}
          />
          <Btn onPress={addSession}>Ajouter</Btn>
        </View>
      </Sheet>

      {/* Renommer séance */}
      <Sheet
        open={!!renameSession}
        onClose={() => {
          setRenameSession(null);
          setRenameSessionVal("");
        }}
        title="Renommer la séance"
      >
        <TextInput
          value={renameSessionVal}
          onChangeText={setRenameSessionVal}
          autoFocus
          style={{
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: L.line,
            borderRadius: 12,
            color: C.ink0,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            marginBottom: 10,
          }}
        />
        <Btn
          full
          onPress={async () => {
            const n = renameSessionVal.trim();
            if (!n || !renameSession) {
              haptic("warning");
              return;
            }
            const sid = renameSession.id;
            await update((p) => {
              const ss = p.sessions.find((x: Any) => x.id === sid);
              if (ss) ss.name = n;
            });
            setRenameSession(null);
            setRenameSessionVal("");
            haptic("success");
          }}
        >
          ✓ Enregistrer
        </Btn>
      </Sheet>

      {/* Ajouter un exercice (recherche + filtre muscle) */}
      <Sheet
        open={!!addExoTo}
        onClose={() => {
          setAddExoTo(null);
          setPickerQuery("");
        }}
        title="Ajouter un exercice"
      >
        <TextInput
          value={pickerQuery}
          onChangeText={setPickerQuery}
          placeholder="Rechercher…"
          placeholderTextColor={C.ink3}
          style={{
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: L.line,
            borderRadius: 12,
            color: C.ink0,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 15,
            marginBottom: 10,
          }}
        />
        <Pressable
          onPress={() => setMuscleFilterOpen(true)}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 12,
            borderRadius: 10,
            backgroundColor: C.bg3,
            borderWidth: 1,
            borderColor: L.line,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 13, color: pickerMuscle ? C.ink0 : C.ink3, fontWeight: "600" }}>{pickerMuscle || "Tous les groupes"}</Text>
          <Ionicons name="chevron-down" size={14} color={C.ink3} />
        </Pressable>
        <View style={{ gap: 4 }}>
          {(() => {
            const q = pickerQuery.trim().toLowerCase();
            const filtered = exerciseLib
              .filter((l) => !pickerMuscle || l.muscleGroup === pickerMuscle)
              .filter((l) => !q || l.name.toLowerCase().includes(q) || (l.subGroup || "").toLowerCase().includes(q))
              .sort((a, b) => (a.muscleGroup || "").localeCompare(b.muscleGroup || "") || (b.priority || 5) - (a.priority || 5));
            if (filtered.length === 0)
              return (
                <Text style={{ color: C.ink3, textAlign: "center", padding: 24 }}>
                  {q ? `Aucun résultat pour « ${pickerQuery} »` : "Aucun exercice"}
                </Text>
              );
            return filtered.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => addExoToSession(l)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: 11,
                  borderRadius: 10,
                  backgroundColor: pressed ? L.bgHover : C.bg3,
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: C.ink0 }}>
                    {l.name}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 10, color: C.ink3, marginTop: 2 }}>
                    {l.muscleGroup}
                    {l.subGroup ? " · " + l.subGroup : ""} · {l.compound ? "poly" : "iso"}
                  </Text>
                </View>
                <Ionicons name="add" size={16} color={C.accent} />
              </Pressable>
            ));
          })()}
        </View>
      </Sheet>

      <PickerSheet
        open={muscleFilterOpen}
        onClose={() => setMuscleFilterOpen(false)}
        title="Groupe musculaire"
        options={[{ value: "", label: "Tous les groupes" }, ...muscleGroups.map((g) => ({ value: g, label: g }))]}
        onPick={(v) => {
          setPickerMuscle(v);
          setMuscleFilterOpen(false);
        }}
      />

      {/* Variantes */}
      <EditVariantsSheet
        open={!!editVariantsFor}
        onClose={() => setEditVariantsFor(null)}
        target={editVariantsFor}
        program={program}
        onSave={async (newChoices) => {
          if (!editVariantsFor) return;
          const { sid, exIdx } = editVariantsFor;
          await update((p) => {
            const s = p.sessions.find((x: Any) => x.id === sid);
            if (!s) return;
            const ex = s.exercises[exIdx];
            if (!ex) return;
            ex.choices = newChoices;
            const principal = newChoices[0];
            if (principal) {
              ex.muscleGroup = principal.muscleGroup || ex.muscleGroup;
              ex.subGroup = principal.subGroup || ex.subGroup;
            }
          });
          setEditVariantsFor(null);
          haptic("success");
        }}
      />

      {/* Déplacer vers une autre séance */}
      <Sheet open={!!moveToSessionFor} onClose={() => setMoveToSessionFor(null)} title="Déplacer vers…">
        {moveToSessionFor && (
          <View>
            <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 12 }}>
              Choisir la séance d'accueil pour <Text style={{ color: C.ink0, fontWeight: "700" }}>« {moveToSessionFor.exName} »</Text>. L'exercice sera
              ajouté à la fin de la séance choisie.
            </Text>
            <View style={{ gap: 6 }}>
              {(program.sessions || [])
                .filter((s: Any) => s.id !== moveToSessionFor.sid)
                .map((s: Any) => (
                  <Pressable
                    key={s.id}
                    onPress={() => moveExoToSession(moveToSessionFor.sid, moveToSessionFor.exIdx, s.id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: pressed ? L.bgHover : C.bg3,
                      borderWidth: 1,
                      borderColor: L.line,
                    })}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>
                        {s.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                        {(s.exercises || []).length} exo{(s.exercises || []).length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={C.accentHi} />
                  </Pressable>
                ))}
            </View>
          </View>
        )}
      </Sheet>

      {/* Statut par muscle (port EditMuscleStatusSheet v40) */}
      <Sheet open={editStatusOpen} onClose={() => setEditStatusOpen(false)} title="Statut par muscle">
        <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 12 }}>
          <Text style={{ color: C.accent, fontWeight: "700" }}>★ Focus</Text> +50% · <Text style={{ color: C.ink1 }}>↑ Progression</Text> baseline ·{" "}
          <Text style={{ color: C.ink3 }}>= Maintenance</Text> 60%
        </Text>
        <View style={{ gap: 4, marginBottom: 10 }}>
          {muscleGroups.map((g) => {
            const v = statusSel[g] || "progression";
            return (
              <View
                key={g}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.bg3, minHeight: 48 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink0 }}>{g}</Text>
                <View style={{ flexDirection: "row", gap: 3 }}>
                  {([["maintenance", "="], ["progression", "↑"], ["focus", "★"]] as const).map(([val, icon]) => {
                    const active = v === val;
                    const col = val === "focus" ? C.accent : val === "maintenance" ? C.ink3 : C.ink1;
                    const bg = !active ? C.bg2 : val === "focus" ? L.accentWash : val === "maintenance" ? "rgba(120,120,130,.15)" : L.successWash;
                    return (
                      <Pressable
                        key={val}
                        onPress={() => {
                          haptic("light");
                          setStatusSel({ ...statusSel, [g]: val });
                        }}
                        style={{
                          minWidth: 36,
                          minHeight: 36,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 6,
                          backgroundColor: bg,
                          borderWidth: 1,
                          borderColor: active ? col + "40" : "transparent",
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: active ? col : C.ink3 }}>{icon}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        {(() => {
          const validation = validateMuscleStatus({
            muscleStatus: statusSel,
            frequency: program.frequency || 4,
            level: program.level || "intermediaire",
            muscleGroups,
          });
          if (!validation.warnings.length) return null;
          return (
            <View style={{ padding: 10, backgroundColor: "rgba(255,204,0,.1)", borderWidth: 1, borderColor: "rgba(255,204,0,.3)", borderRadius: 8, marginBottom: 10 }}>
              {validation.warnings.map((w: string, i: number) => (
                <Text key={i} style={{ fontSize: 11, color: C.ink1, lineHeight: 15, marginBottom: i < validation.warnings.length - 1 ? 4 : 0 }}>
                  ⚠ {w}
                </Text>
              ))}
            </View>
          );
        })()}
        <Btn
          full
          onPress={async () => {
            // Port v40 onSave : recompute des cibles de volume depuis le statut
            const newTargets = computeVolumeTargets({ level: program.level, muscleStatus: statusSel, muscleGroups });
            await update((p) => {
              p.muscleStatus = statusSel;
              p.volumeTargets = p.volumeTargets || { program: {}, sessions: {} };
              p.volumeTargets.program = newTargets;
            });
            setEditStatusOpen(false);
            haptic("success");
          }}
        >
          ✓ Enregistrer
        </Btn>
      </Sheet>

      {/* Confirmations */}
      <ConfirmSheet
        open={deleteProgOpen}
        onClose={() => setDeleteProgOpen(false)}
        onConfirm={async () => {
          setDeleteProgOpen(false);
          await data.deleteProgram(program.id);
          router.back();
        }}
        title="Supprimer le programme ?"
        message={`"${program.name}" sera supprimé. Les séances déjà journalisées sont conservées.`}
      />
      <ConfirmSheet
        open={!!deleteSessionOpen}
        onClose={() => setDeleteSessionOpen(null)}
        onConfirm={async () => {
          const sid = deleteSessionOpen?.id;
          setDeleteSessionOpen(null);
          await update((p) => {
            p.sessions = p.sessions.filter((ss: Any) => ss.id !== sid);
          });
        }}
        title="Supprimer la séance ?"
        message={deleteSessionOpen ? `"${deleteSessionOpen.name}" et ses exercices seront supprimés.` : ""}
      />
      <ConfirmSheet
        open={!!delExoOpen}
        onClose={() => setDelExoOpen(null)}
        onConfirm={async () => {
          const target = delExoOpen;
          setDelExoOpen(null);
          if (!target) return;
          await update((p) => {
            const s = p.sessions.find((x: Any) => x.id === target.sid);
            if (s) s.exercises.splice(target.exIdx, 1);
          });
        }}
        title="Supprimer l'exercice"
        message={delExoOpen ? `Retirer « ${delExoOpen.exName} » de cette séance ? Les séries déjà enregistrées dans le journal ne sont pas affectées.` : ""}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
