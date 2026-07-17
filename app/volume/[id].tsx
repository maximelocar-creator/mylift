// Cibles de volume — port fidèle de ParamsVolume (v40) : mode lecture/édition
// avec brouillons (rien n'est écrit avant "Enregistrer"), vue d'ensemble
// séries planifiées vs cibles, cible par muscle + répartition sous-groupes
// (sliders qui se rééquilibrent), recalcul auto par niveau (programmes auto),
// garde de sortie si modifications non enregistrées.
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, L, mono } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { useData } from "@/lib/store";
import { programVolume, splitVolumeBySubGroups, computeVolumeTargets, type Any } from "@/core/mylift";
import { Sheet, Btn, Label, ScreenSkeleton } from "@/ui/kit";
import { SgSliderRow } from "@/ui/SgSlider";

export default function VolumeTargets() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useData();
  const { programs, exerciseLib, muscleGroups, subGroups, ready } = data;
  const program = programs.find((p) => p.id === id) || null;

  const [expanded, setExpanded] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draftTargets, setDraftTargets] = useState<Record<string, number> | null>(null);
  const [draftSubTargets, setDraftSubTargets] = useState<Record<string, Record<string, number>> | null>(null);
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const [recomputeLevel, setRecomputeLevel] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const pendingLeaveRef = useRef<Any | null>(null);

  const pv = useMemo(() => programVolume(program, exerciseLib), [program, exerciseLib]);
  const savedTargets: Record<string, number> = program?.volumeTargets?.program || {};
  const savedSubTargets: Record<string, Record<string, number>> = program?.volumeTargets?.subGroups || {};

  const targets = editMode && draftTargets ? draftTargets : savedTargets;
  const subTargets = editMode && draftSubTargets ? draftSubTargets : savedSubTargets;

  const dirty =
    editMode &&
    !!draftTargets &&
    (JSON.stringify(draftTargets) !== JSON.stringify(savedTargets) || JSON.stringify(draftSubTargets) !== JSON.stringify(savedSubTargets));

  // Garde de sortie (équivalent du navGuard v40) : bloque le pop si dirty
  useEffect(() => {
    const unsub = (navigation as Any).addListener("beforeRemove", (e: Any) => {
      if (!dirty) return;
      e.preventDefault();
      pendingLeaveRef.current = e.data.action;
      setLeaveConfirmOpen(true);
    });
    return unsub;
  }, [navigation, dirty]);

  if (!ready) return <ScreenSkeleton paddingTop={insets.top + 12} />;
  if (!program) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg0, alignItems: "center", justifyContent: "center", padding: 40 }}>
        <Text style={{ color: C.ink2, fontWeight: "700", marginBottom: 16 }}>Programme introuvable</Text>
        <Btn kind="ghost" onPress={() => router.back()}>Retour</Btn>
      </View>
    );
  }

  const enterEdit = () => {
    setDraftTargets({ ...savedTargets });
    setDraftSubTargets(JSON.parse(JSON.stringify(savedSubTargets)));
    setEditMode(true);
    haptic("light");
  };

  const saveEdit = async () => {
    if (!draftTargets) {
      setEditMode(false);
      return;
    }
    const dt = { ...draftTargets };
    const dst = JSON.parse(JSON.stringify(draftSubTargets || {}));
    await data.updateProgram(program.id, (p) => {
      if (!p.volumeTargets) p.volumeTargets = { program: {}, sessions: {}, subGroups: {} };
      p.volumeTargets.program = dt;
      p.volumeTargets.subGroups = dst;
    });
    setDraftTargets(null);
    setDraftSubTargets(null);
    setEditMode(false);
    haptic("success");
  };

  const cancelEdit = () => {
    setDraftTargets(null);
    setDraftSubTargets(null);
    setEditMode(false);
    haptic("light");
  };

  const setTarget = (g: string, v: string) => {
    if (!editMode) return;
    const next = { ...(draftTargets || savedTargets) };
    if (v === "" || v === null || v === undefined) delete next[g];
    else next[g] = parseInt(v) || 0;
    setDraftTargets(next);
  };

  const resetSubTargetsForGroup = (g: string) => {
    if (!editMode) return;
    const curTarget = (draftTargets || savedTargets)[g] || 0;
    const split = splitVolumeBySubGroups(g, curTarget, null, subGroups);
    const next = JSON.parse(JSON.stringify(draftSubTargets || savedSubTargets));
    next[g] = split || {};
    setDraftSubTargets(next);
    haptic("light");
  };

  const applyRecompute = async () => {
    const level = recomputeLevel || program.level || "intermediaire";
    const newT = computeVolumeTargets({
      level,
      muscleStatus: program.muscleStatus,
      focus: program.focus,
      priorities: program.priorities || [],
      muscleGroups,
    });
    const sub: Record<string, Record<string, number>> = {};
    Object.entries(newT).forEach(([g, v]) => {
      const customPct = program.subGroupSplit?.[g] || null;
      const split = splitVolumeBySubGroups(g, v as number, customPct, subGroups);
      if (split) sub[g] = split;
    });
    await data.updateProgram(program.id, (p) => {
      p.level = level;
      p.volumeTargets = p.volumeTargets || {};
      p.volumeTargets.program = newT;
      p.volumeTargets.subGroups = sub;
    });
    setRecomputeOpen(false);
    setRecomputeLevel(null);
    // Passe en édition avec les valeurs calculées comme brouillons (port v40)
    setDraftTargets({ ...newT });
    setDraftSubTargets(JSON.parse(JSON.stringify(sub)));
    setEditMode(true);
    haptic("success");
  };

  const resumeLeave = () => {
    const action = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setLeaveConfirmOpen(false);
    if (action) (navigation as Any).dispatch(action);
  };

  const groupsSorted = muscleGroups.slice().sort((a, b) => {
    const va = pv.total[a] || 0,
      vb = pv.total[b] || 0;
    if (va === 0 && vb === 0) return a.localeCompare(b);
    if (va === 0) return 1;
    if (vb === 0) return -1;
    return vb - va;
  });

  const levelLabel = ({ debutant: "Débutant", intermediaire: "Intermédiaire", confirme: "Confirmé" } as Record<string, string>)[program.level] || "—";
  const totalPlanned = Object.values(pv.total).reduce((a: number, v: any) => a + (v || 0), 0);
  const totalTarget = Object.values(targets).reduce((a: number, v: any) => a + (parseInt(String(v)) || 0), 0);
  const totalPct = totalTarget > 0 ? Math.min(100, (totalPlanned / totalTarget) * 100) : 0;
  const overshoot = totalTarget > 0 ? Math.max(0, ((totalPlanned - totalTarget) / totalTarget) * 100) : 0;
  const totalCol = totalPlanned >= totalTarget && totalTarget > 0 ? (totalPlanned > totalTarget * 1.1 ? C.gold : C.success) : C.accent;

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: L.line,
    borderRadius: 10,
    color: C.ink0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    textAlign: "center" as const,
    width: 72,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
          <Ionicons name="chevron-back" size={16} color={C.ink2} />
          <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Programme</Text>
        </Pressable>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: C.ink3, marginBottom: 2 }}>Cibles de volume</Text>
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "800", color: C.ink0, letterSpacing: -0.3 }}>
            {program.name}
          </Text>
          <Text style={{ fontSize: 11, color: C.ink3, marginTop: 4 }}>
            Niveau · {levelLabel} · {program.frequency || "?"}x/sem
          </Text>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {!editMode && (
            <Btn kind="ghost" sm onPress={enterEdit} style={{ flex: 1, minWidth: 120 }}>
              ✎ Modifier
            </Btn>
          )}
          {editMode && (
            <Btn sm onPress={saveEdit} disabled={!dirty} style={{ flex: 1, minWidth: 120 }}>
              ✓ Enregistrer
            </Btn>
          )}
          {editMode && (
            <Btn kind="ghost" sm onPress={cancelEdit} style={{ flex: 1, minWidth: 100 }}>
              ✗ Annuler
            </Btn>
          )}
          {!!program.auto && !editMode && (
            <Btn
              kind="ghost"
              sm
              onPress={() => {
                setRecomputeLevel(program.level || "intermediaire");
                setRecomputeOpen(true);
              }}
              style={{ flex: 1, minWidth: 120 }}
            >
              ↺ Recalcul auto
            </Btn>
          )}
        </View>

        {editMode && dirty && (
          <View style={{ padding: 8, marginBottom: 10, borderRadius: 6, backgroundColor: L.accentWash, borderWidth: 1, borderColor: "rgba(252,76,2,.3)" }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: C.accentHi, textAlign: "center" }}>Modifications non enregistrées</Text>
          </View>
        )}

        {/* Vue d'ensemble */}
        {(totalPlanned > 0 || totalTarget > 0) && (
          <View style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 10, padding: 13, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <Label>Total séries hebdo</Label>
              <Text style={[mono, { fontSize: 13, fontWeight: "800" }]}>
                <Text style={{ color: totalCol }}>{totalPlanned}</Text>
                {totalTarget > 0 && <Text style={{ color: C.ink3, fontWeight: "600" }}> / {totalTarget}</Text>}
              </Text>
            </View>
            {totalTarget > 0 && (
              <>
                <View style={{ height: 6, backgroundColor: C.bg3, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <View style={{ height: "100%", width: `${totalPct}%`, backgroundColor: totalCol, borderRadius: 3 }} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 10, color: C.ink3 }}>
                    {totalPlanned >= totalTarget
                      ? overshoot > 10
                        ? `+${Math.round(overshoot)}% au-dessus de la cible`
                        : "Cible atteinte"
                      : `Manque ${totalTarget - totalPlanned} série${totalTarget - totalPlanned > 1 ? "s" : ""}`}
                  </Text>
                  <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{Math.round(totalPct)}%</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Rangées par muscle */}
        {groupsSorted.map((g) => {
          const subs = subGroups[g] || [];
          const hasSubs = subs.length > 0;
          const isExpanded = expanded === g;
          const subTgtG = subTargets[g] || {};
          const actual = pv.total[g] || 0;
          const target = targets[g] || 0;
          const pct = target ? Math.min(100, (actual / target) * 100) : 0;
          const barCol = actual >= target && target ? C.success : actual >= target * 0.7 && target ? C.accent : L.ink4;
          const totalSub = subs.reduce((a, s) => a + (subTgtG[s] || 0), 0);
          const pctBySub: Record<string, number> = {};
          subs.forEach((s) => {
            pctBySub[s] = totalSub > 0 ? ((subTgtG[s] || 0) / totalSub) * 100 : 0;
          });
          const splitTotal = Object.values(pctBySub).reduce((a, b) => a + b, 0);

          return (
            <View key={g} style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 10, marginBottom: 6, overflow: "hidden" }}>
              <Pressable
                disabled={!hasSubs}
                onPress={() => setExpanded(isExpanded ? null : g)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, minHeight: 56 }}
              >
                {hasSubs && <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={C.ink3} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink0 }}>{g}</Text>
                  <Text style={[mono, { fontSize: 11, color: C.ink3, marginTop: 2 }]}>actuel {actual} séries/sem</Text>
                </View>
                {target ? (
                  <View style={{ width: 60, height: 6, backgroundColor: C.bg3, borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${pct}%`, backgroundColor: barCol, borderRadius: 3 }} />
                  </View>
                ) : (
                  <Text style={{ fontSize: 11, color: C.ink3, width: 60, textAlign: "center" }}>—</Text>
                )}
                <TextInput
                  editable={editMode}
                  defaultValue={targets[g] ? String(targets[g]) : ""}
                  key={g + ":" + editMode + ":" + (targets[g] ?? "")}
                  onEndEditing={(e) => setTarget(g, e.nativeEvent.text)}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={C.ink3}
                  style={[mono, inputStyle, { opacity: editMode ? 1 : 0.55 }]}
                />
              </Pressable>

              {hasSubs && isExpanded && (
                <View style={{ backgroundColor: C.bg3, borderTopWidth: 1, borderTopColor: L.line, padding: 12, paddingBottom: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <Label>Répartition sous-groupes</Label>
                    {editMode && (
                      <Pressable
                        onPress={() => resetSubTargetsForGroup(g)}
                        style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: C.bg2, minHeight: 30, justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "700", color: C.ink2 }}>↺ Défaut</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={{ gap: 8, opacity: editMode ? 1 : 0.6 }} pointerEvents={editMode ? "auto" : "none"}>
                    {subs.map((sub) => (
                      <SgSliderRow
                        key={sub}
                        name={sub}
                        pct={pctBySub[sub]}
                        series={subTgtG[sub] || 0}
                        onChange={(newPct) => {
                          if (!editMode) return;
                          const totalCurG = (draftTargets || savedTargets)[g] || 0;
                          if (totalCurG <= 0) return;
                          // Rebalance proportionnel puis conversion % → séries entières,
                          // le dernier sous-groupe absorbe l'arrondi (port v40)
                          const others = subs.filter((s) => s !== sub);
                          const othersTotal = others.reduce((a, s) => a + (pctBySub[s] || 0), 0);
                          const remaining = Math.max(0, 100 - newPct);
                          const nextPct: Record<string, number> = { [sub]: newPct };
                          if (othersTotal > 0) {
                            others.forEach((s) => {
                              nextPct[s] = (pctBySub[s] || 0) * (remaining / othersTotal);
                            });
                          } else {
                            others.forEach((s) => {
                              nextPct[s] = remaining / others.length;
                            });
                          }
                          const nextSeries: Record<string, number> = {};
                          let placed = 0;
                          subs.forEach((s, i) => {
                            if (i === subs.length - 1) nextSeries[s] = Math.max(0, totalCurG - placed);
                            else {
                              nextSeries[s] = Math.round((nextPct[s] / 100) * totalCurG);
                              placed += nextSeries[s];
                            }
                          });
                          const next = JSON.parse(JSON.stringify(draftSubTargets || savedSubTargets));
                          next[g] = nextSeries;
                          setDraftSubTargets(next);
                        }}
                      />
                    ))}
                  </View>
                  <Text style={{ fontSize: 10.5, color: C.ink3, fontStyle: "italic", marginTop: 10 }}>
                    {((draftTargets || savedTargets)[g] || 0) > 0
                      ? `Total ${Math.round(splitTotal)}% · ajuste un curseur, les autres se rééquilibrent automatiquement.`
                      : "Définis d'abord une cible totale pour ce muscle pour répartir les sous-groupes."}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Recalcul auto */}
        <Sheet
          open={recomputeOpen}
          onClose={() => {
            setRecomputeOpen(false);
            setRecomputeLevel(null);
          }}
          title="Recalculer les cibles"
        >
          <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 14 }}>
            Choisis ton niveau. Après recalcul tu passeras en mode édition pour ajuster et enregistrer.
          </Text>
          <Label style={{ marginBottom: 8 }}>Niveau</Label>
          <View style={{ flexDirection: "row", gap: 2, backgroundColor: C.bg3, borderRadius: 12, padding: 3, marginBottom: 18 }}>
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
                  setRecomputeLevel(v);
                  haptic("light");
                }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: recomputeLevel === v ? L.bgHover : "transparent", alignItems: "center" }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: recomputeLevel === v ? C.ink0 : C.ink2 }}>{l}</Text>
                <Text style={{ fontSize: 9, fontWeight: "600", color: recomputeLevel === v ? C.ink2 : C.ink3, marginTop: 2 }}>{sub}</Text>
              </Pressable>
            ))}
          </View>
          <Btn full onPress={applyRecompute} disabled={!recomputeLevel}>
            ✓ Recalculer
          </Btn>
        </Sheet>

        {/* Sortie non enregistrée */}
        <Sheet open={leaveConfirmOpen} onClose={() => setLeaveConfirmOpen(false)} title="Modifications non enregistrées">
          <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 16 }}>Tu as modifié des cibles sans les enregistrer. Que veux-tu faire ?</Text>
          <View style={{ gap: 8 }}>
            <Btn
              full
              onPress={async () => {
                await saveEdit();
                resumeLeave();
              }}
            >
              Enregistrer
            </Btn>
            <Btn
              kind="danger"
              full
              onPress={() => {
                cancelEdit();
                resumeLeave();
              }}
            >
              Abandonner
            </Btn>
            <Btn
              kind="ghost"
              full
              onPress={() => {
                pendingLeaveRef.current = null;
                setLeaveConfirmOpen(false);
              }}
            >
              Continuer
            </Btn>
          </View>
        </Sheet>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
