// Séance live — port fidèle de SessionLive/RestTimer/SetRow (v40 app.jsx).
// Points verrouillés :
//  - header compact 1 ligne (retour, dot vert, nom, chrono, Annuler rouge, Fin orange)
//  - timer de repos : cible 2 min, +30s, démarrage 100% MANUEL (jamais auto)
//  - séries verrouillées tant que la précédente n'est pas validée
//  - "la dernière fois" recalculée au changement de variante/modèle (exoKey complet)
//  - PRs calculés à la validation d'UNE série (computePRsForSet) et à la
//    finalisation (computePRs) — sémantique poids brut, PAS e1RM
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, mono } from "../lib/theme";
import { haptic } from "../lib/haptics";
import { useData } from "../lib/store";
import { exoKey, exoTimeline, isValidSet, type Any } from "../core/mylift";
import { pad2, formatRelative } from "../lib/format";
import { Sheet, ConfirmSheet, Btn, PickerSheet, Label, LINE, ACCENT_WASH, SUCCESS_WASH, INK4, afterSheetClose } from "../ui/kit";

/* ==================================================================== */
/* Chrono global de séance                                              */
/* ==================================================================== */
function SessionElapsed({ startedAt }: { startedAt: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const int = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(int);
  }, []);
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const label = h > 0 ? `${h}h${pad2(m % 60)}` : `${m}:${pad2(sec % 60)}`;
  return <Text style={[mono, { fontSize: 11, color: C.ink3, fontWeight: "600" }]}>{label}</Text>;
}

/* ==================================================================== */
/* Timer de repos — gros, central, manuel                               */
/* ==================================================================== */
function RestTimer({
  seconds,
  running,
  targetSeconds = 120,
  onStart,
  onStop,
  onReset,
  onAddRest,
}: {
  seconds: number;
  running: boolean;
  targetSeconds: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onAddRest: () => void;
}) {
  const progress = Math.min(1, seconds / targetSeconds);
  const over = seconds > targetSeconds;
  const mm = pad2(Math.floor(seconds / 60));
  const ss = pad2(seconds % 60);
  const barColor = over ? C.gold : running ? C.success : C.ink3;
  const numColor = over ? C.gold : running ? C.ink0 : C.ink1;

  return (
    <View
      style={{
        backgroundColor: running ? "rgba(47,210,125,.06)" : C.bg2,
        borderWidth: 1,
        borderColor: running ? "rgba(47,210,125,.3)" : LINE,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.3, textTransform: "uppercase", color: running ? C.success : C.ink3 }}>
          {over ? "repos +" : "repos"}
        </Text>
        <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>
          cible {pad2(Math.floor(targetSeconds / 60))}:{pad2(targetSeconds % 60)}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <Text style={[mono, { fontSize: 32, fontWeight: "700", letterSpacing: -0.5, color: numColor, lineHeight: 34 }]}>
          {mm}:{ss}
        </Text>
        {running && !over && (
          <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>
            restants : {pad2(Math.floor((targetSeconds - seconds) / 60))}:{pad2((targetSeconds - seconds) % 60)}
          </Text>
        )}
      </View>

      <View style={{ height: 4, backgroundColor: "rgba(255,255,255,.06)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
        <View style={{ width: `${progress * 100}%`, height: "100%", backgroundColor: barColor, borderRadius: 2 }} />
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        <Pressable
          onPress={running ? onStop : onStart}
          style={({ pressed }) => ({
            flex: 1.4,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: running ? "rgba(255,255,255,.05)" : SUCCESS_WASH,
            borderWidth: 1,
            borderColor: running ? LINE : "rgba(47,210,125,.3)",
            alignItems: "center",
            opacity: pressed ? 0.8 : 1,
            minHeight: 44,
            justifyContent: "center",
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name={running ? "pause" : "play"} size={14} color={running ? C.ink2 : C.success} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: running ? C.ink2 : C.success }}>{running ? "Pause" : "Start"}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onAddRest}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,.05)",
            borderWidth: 1,
            borderColor: LINE,
            alignItems: "center",
            opacity: pressed ? 0.8 : 1,
            minHeight: 44,
            justifyContent: "center",
          })}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.ink1 }}>+30s</Text>
        </Pressable>
        <Pressable
          onPress={onReset}
          disabled={seconds === 0 && !running}
          style={({ pressed }) => ({
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,.05)",
            borderWidth: 1,
            borderColor: LINE,
            alignItems: "center",
            opacity: seconds === 0 && !running ? 0.4 : pressed ? 0.8 : 1,
            minWidth: 44,
            minHeight: 44,
            justifyContent: "center",
          })}
        >
          <Ionicons name="refresh" size={16} color={C.ink2} />
        </Pressable>
      </View>
    </View>
  );
}

/* ==================================================================== */
/* SetRow — série empilée avec steppers, lock, confirm                  */
/* ==================================================================== */
function SetRow({
  set,
  idx,
  confirmed,
  active,
  locked,
  targetWeight,
  onChange,
  onConfirm,
  onUnconfirm,
  onRemove,
}: {
  set: Any;
  idx: number;
  confirmed: boolean;
  active: boolean;
  locked: boolean;
  targetWeight: any;
  onChange: (key: string, val: string) => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onRemove: () => void;
}) {
  // Steppers (port v40) : poids ±2.5, reps/rir ±1, base sensée si vide, clamp ≥ 0
  const clampNonNeg = (n: number) => (n < 0 ? 0 : n);
  const stepWeight = (dir: number) => {
    if (locked) return;
    haptic("light");
    const cur = parseFloat(set.weight);
    const base = isNaN(cur) ? parseFloat(targetWeight) || 0 : cur;
    onChange("weight", String(clampNonNeg(Math.round((base + dir * 2.5) * 10) / 10)));
  };
  const stepReps = (dir: number) => {
    if (locked) return;
    haptic("light");
    const cur = parseInt(set.reps);
    const base = isNaN(cur) ? 10 : cur;
    onChange("reps", String(clampNonNeg(base + dir)));
  };
  const stepRir = (dir: number) => {
    if (locked) return;
    haptic("light");
    const cur = parseInt(set.rir);
    const base = isNaN(cur) ? 1 : cur;
    onChange("rir", String(clampNonNeg(base + dir)));
  };

  const borderColor = confirmed ? "rgba(47,210,125,.2)" : active && !locked ? C.accent : locked ? "rgba(255,255,255,.04)" : LINE;
  const bg = confirmed ? "rgba(47,210,125,.05)" : locked ? C.bg1 : C.bg2;

  const stepper = (onUp: () => void, onDown: () => void) => (
    <View style={{ gap: 1, width: 18 }}>
      <Pressable onPress={onUp} disabled={locked} hitSlop={6} style={{ height: 15, borderRadius: 4, backgroundColor: "rgba(255,255,255,.04)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chevron-up" size={9} color={locked ? INK4 : C.ink2} />
      </Pressable>
      <Pressable onPress={onDown} disabled={locked} hitSlop={6} style={{ height: 15, borderRadius: 4, backgroundColor: "rgba(255,255,255,.04)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chevron-down" size={9} color={locked ? INK4 : C.ink2} />
      </Pressable>
    </View>
  );

  const field = (label: string, key: "weight" | "reps" | "rir", placeholder: string, onUp: () => void, onDown: () => void, suffix?: string) => (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: locked ? INK4 : C.ink3, marginBottom: 1 }}>{label}</Text>
      {confirmed ? (
        <Text style={[mono, { fontSize: 17, fontWeight: "800", color: C.ink0 }]}>
          {key === "rir" ? (set.rir !== "" && set.rir !== null && set.rir !== undefined ? set.rir : "—") : set[key]}
          {suffix ? <Text style={{ fontSize: 11, color: C.ink3 }}> {suffix}</Text> : null}
        </Text>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          {stepper(onUp, onDown)}
          <TextInput
            value={set[key] === null || set[key] === undefined ? "" : String(set[key])}
            onChangeText={(t) => onChange(key, t)}
            editable={!locked}
            keyboardType={key === "weight" ? "decimal-pad" : "number-pad"}
            placeholder={placeholder}
            placeholderTextColor={locked ? INK4 : C.ink3}
            style={[mono, { flex: 1, minWidth: 0, color: locked ? INK4 : C.ink0, fontSize: 17, fontWeight: "800", padding: 0 }]}
          />
        </View>
      )}
    </View>
  );

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: active && !confirmed && !locked ? 2 : 1,
        borderColor,
        opacity: locked ? 0.45 : 1,
      }}
    >
      <Text style={[mono, { fontSize: 11, fontWeight: "700", color: confirmed ? C.success : active ? C.accent : C.ink3, width: 22 }]}>{pad2(idx + 1)}</Text>
      {field("Poids", "weight", targetWeight ? String(targetWeight) : "—", () => stepWeight(1), () => stepWeight(-1), "kg")}
      {field("Reps", "reps", "—", () => stepReps(1), () => stepReps(-1))}
      {field("RIR", "rir", "—", () => stepRir(1), () => stepRir(-1))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {!confirmed ? (
          <Pressable onPress={onRemove} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={15} color={C.ink3} />
          </Pressable>
        ) : (
          <View style={{ width: 23 }} />
        )}
        {confirmed ? (
          <Pressable onPress={onUnconfirm} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.success, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={15} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            onPress={locked ? undefined : onConfirm}
            disabled={locked}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: active && !locked ? C.accent : C.bg3,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark" size={16} color={active && !locked ? "#fff" : C.ink3} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/* ==================================================================== */
/* LWB overlay — célébration PR plein écran                             */
/* ==================================================================== */
function LWBOverlay({ pr, onClose }: { pr: Any | null; onClose: () => void }) {
  return (
    <Modal visible={!!pr} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,.9)", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Text style={{ fontSize: 64 }}>🏆</Text>
        <Text style={{ fontSize: 36, fontWeight: "900", letterSpacing: -1, color: C.gold, textTransform: "uppercase", marginTop: 20, textAlign: "center" }}>
          {pr?.type === "all-time" ? "All-Time PR !" : "Rep PR !"}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "600", color: C.ink2, marginTop: 8, textAlign: "center" }}>{pr?.exName}</Text>
        <Text style={[mono, { fontSize: 22, fontWeight: "800", color: C.ink0, marginTop: 12 }]}>
          {pr?.weight} kg × {pr?.reps}
        </Text>
        <Text style={{ position: "absolute", bottom: 60, color: C.ink3, fontSize: 13, fontWeight: "600" }}>Tape pour continuer</Text>
      </Pressable>
    </Modal>
  );
}

/* ==================================================================== */
/* SessionLive                                                           */
/* ==================================================================== */
export default function SessionLive({
  session,
  onSave,
  onDiscard,
  onUpdate,
}: {
  session: Any;
  onSave: (log: Any) => void;
  onDiscard: () => void;
  onUpdate: (s: Any) => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useData();
  const { exerciseLib, journalLogs, programs, profile } = data;
  const currentProgram = programs.find((p) => p.id === session.programId) || programs.find((p) => p.id === profile?.currentProgramId) || null;

  // Timer v3 — persisté dans session.timer : {accum, startedAt, target}
  const t0 = session.timer || { accum: 0, startedAt: null, target: 120 };
  const timerStartRef = useRef<number | null>(t0.startedAt);
  const timerAccumRef = useRef<number>(t0.accum || 0);
  const [timerRunning, setTimerRunning] = useState(!!t0.startedAt);
  const [timerDisplay, setTimerDisplay] = useState(() => {
    if (t0.startedAt) return (t0.accum || 0) + Math.floor((Date.now() - t0.startedAt) / 1000);
    return t0.accum || 0;
  });
  const [timerTarget, setTimerTarget] = useState(t0.target || 120);

  const [exoSheetOpen, setExoSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lwbPR, setLwbPR] = useState<Any | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [updateTargetOpen, setUpdateTargetOpen] = useState<Any | null>(null);
  // Dépassement de cible détecté PENDANT une célébration PR : on le met en
  // attente et on ne présente la ConfirmSheet qu'après fermeture de la Modal
  // PR (présenter 2 Modals dans le même tick échoue SILENCIEUSEMENT sur iOS
  // et peut geler l'écran — piège documenté dans CLAUDE.md).
  const pendingTargetRef = useRef<Any | null>(null);
  const [switchVariantConfirm, setSwitchVariantConfirm] = useState<Any | null>(null);
  const [finishBlocked, setFinishBlocked] = useState<Any | null>(null);
  const [noteHeaderVisible, setNoteHeaderVisible] = useState(!!session.sessionNote);

  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);
  const persistTimer = (partial: Any) => {
    const cur = sessionRef.current.timer || { accum: 0, startedAt: null, target: 120 };
    onUpdateRef.current({ ...sessionRef.current, timer: { ...cur, ...partial } });
  };

  useEffect(() => {
    if (!timerRunning) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - (timerStartRef.current as number)) / 1000);
      setTimerDisplay(timerAccumRef.current + elapsed);
    };
    tick();
    const int = setInterval(tick, 500);
    return () => clearInterval(int);
  }, [timerRunning]);

  const startTimer = () => {
    haptic("light");
    timerStartRef.current = Date.now();
    setTimerRunning(true);
    persistTimer({ startedAt: timerStartRef.current, accum: timerAccumRef.current, target: timerTarget });
  };
  const stopTimer = () => {
    if (timerStartRef.current) {
      timerAccumRef.current += Math.floor((Date.now() - timerStartRef.current) / 1000);
    }
    timerStartRef.current = null;
    setTimerRunning(false);
    persistTimer({ startedAt: null, accum: timerAccumRef.current, target: timerTarget });
  };
  const resetTimer = () => {
    haptic("light");
    timerStartRef.current = null;
    timerAccumRef.current = 0;
    setTimerDisplay(0);
    setTimerTarget(120);
    setTimerRunning(false);
    persistTimer({ startedAt: null, accum: 0, target: 120 });
  };
  const addRestTime = () => {
    haptic("light");
    setTimerTarget((t: number) => {
      const next = t + 30;
      persistTimer({ target: next });
      return next;
    });
  };

  const updateExo = (idx: number, updater: (ex: Any) => Any) => {
    const newExos = [...session.exercises];
    newExos[idx] = updater({ ...newExos[idx] });
    onUpdate({ ...session, exercises: newExos });
  };
  const updateSet = (exIdx: number, setIdx: number, key: string, value: string) => {
    updateExo(exIdx, (ex) => {
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], [key]: value };
      return { ...ex, sets };
    });
  };
  const addSet = (exIdx: number) => {
    haptic("light");
    updateExo(exIdx, (ex) => {
      const last = ex.sets[ex.sets.length - 1];
      const inherited = last ? { weight: last.weight || "", reps: last.reps || "", rir: "1" } : { weight: "", reps: "", rir: "1" };
      return { ...ex, sets: [...ex.sets, { ...inherited, _confirmed: false }] };
    });
  };
  const removeSet = (exIdx: number, setIdx: number) => {
    haptic("light");
    updateExo(exIdx, (ex) => ({ ...ex, sets: ex.sets.filter((_: Any, i: number) => i !== setIdx) }));
  };
  const unconfirmSet = (exIdx: number, setIdx: number) => {
    haptic("light");
    updateExo(exIdx, (ex) => {
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], _confirmed: false };
      return { ...ex, sets };
    });
  };

  /**
   * PRs d'UNE série au moment de sa validation (port v40 computePRsForSet).
   * All-Time = poids strictement > tout poids jamais soulevé sur cet exo.
   * Rep PR = plus de reps que jamais à ce poids exact (poids déjà touché requis).
   * Historique = séances passées + séries déjà confirmées de CETTE séance.
   * Jamais de PR sur la toute première série ever (pas de baseline).
   */
  const computePRsForSet = (ex: Any, targetSetIdx: number, logs: Any[]): Any[] => {
    const key = exoKey(ex);
    const targetSet = ex.sets[targetSetIdx];
    if (!targetSet || !targetSet._confirmed || !isValidSet(targetSet)) return [];

    const historicalSets: { w: number; r: number }[] = [];
    logs.forEach((log) =>
      (log.exercises || []).forEach((hex: Any) => {
        if (exoKey(hex) !== key) return;
        (hex.sets || []).forEach((s: Any) => {
          if (!isValidSet(s)) return;
          historicalSets.push({ w: parseFloat(s.weight), r: parseInt(s.reps) });
        });
      })
    );
    (ex.sets || []).forEach((s: Any, i: number) => {
      if (i >= targetSetIdx) return;
      if (!s._confirmed || !isValidSet(s)) return;
      historicalSets.push({ w: parseFloat(s.weight), r: parseInt(s.reps) });
    });

    const w = parseFloat(targetSet.weight);
    const r = parseInt(targetSet.reps);
    const EPS = 0.05;
    const histMaxWeight = historicalSets.reduce((m, s) => (s.w > m ? s.w : m), 0);
    const samePoidsSets = historicalSets.filter((s) => Math.abs(s.w - w) <= EPS);
    const histMaxRepsAtW = samePoidsSets.reduce((m, s) => (s.r > m ? s.r : m), 0);

    const prs: Any[] = [];
    const mid = ex.modelId || ex.activeModelId || null;
    if (historicalSets.length > 0 && w > histMaxWeight + EPS) {
      prs.push({ type: "all-time", exName: ex.exName, exId: ex.exId, modelId: mid, weight: w, reps: r });
    }
    if (samePoidsSets.length > 0 && r > histMaxRepsAtW) {
      prs.push({ type: "rep", exName: ex.exName, exId: ex.exId, modelId: mid, weight: w, reps: r });
    }
    return prs;
  };

  /** PRs de tout l'exo à la finalisation (port v40 computePRs) — même sémantique. */
  const computePRs = (ex: Any, logs: Any[]): Any[] => {
    const key = exoKey(ex);
    const confirmedSets = (ex.sets || []).filter((s: Any) => s._confirmed && isValidSet(s));
    if (!confirmedSets.length) return [];
    const EPS = 0.05;
    const seen: { w: number; r: number }[] = [];
    logs.forEach((log) =>
      (log.exercises || []).forEach((hex: Any) => {
        if (exoKey(hex) !== key) return;
        (hex.sets || []).forEach((s: Any) => {
          if (!isValidSet(s)) return;
          seen.push({ w: parseFloat(s.weight), r: parseInt(s.reps) });
        });
      })
    );
    const prs: Any[] = [];
    confirmedSets.forEach((s: Any) => {
      const w = parseFloat(s.weight);
      const r = parseInt(s.reps);
      const seenLenBefore = seen.length;
      const histMaxWeight = seen.reduce((m, x) => (x.w > m ? x.w : m), 0);
      const samePoidsSets = seen.filter((x) => Math.abs(x.w - w) <= EPS);
      const histMaxRepsAtW = samePoidsSets.reduce((m, x) => (x.r > m ? x.r : m), 0);
      const mid = ex.modelId || ex.activeModelId || null;
      if (seenLenBefore > 0 && w > histMaxWeight + EPS) {
        prs.push({ type: "all-time", exName: ex.exName, exId: ex.exId, modelId: mid, weight: w, reps: r });
      }
      if (samePoidsSets.length > 0 && r > histMaxRepsAtW) {
        prs.push({ type: "rep", exName: ex.exName, exId: ex.exId, modelId: mid, weight: w, reps: r });
      }
      seen.push({ w, r });
    });
    return prs;
  };

  const confirmSet = (exIdx: number, setIdx: number) => {
    const ex = session.exercises[exIdx];
    const s = ex.sets[setIdx];
    // Fallback : si poids non saisi mais targetWeight présent, on adopte la cible
    const fallbackWeight =
      (s.weight === "" || s.weight === null || s.weight === undefined) && ex.targetWeight ? String(ex.targetWeight) : s.weight;
    const sNormalized = { ...s, weight: fallbackWeight };
    if (!isValidSet(sNormalized)) {
      haptic("warning");
      return;
    }
    // Garde : si l'exo a des modèles dans la lib, sélection obligatoire
    const liveLibEx = ex.exId ? exerciseLib.find((l) => l.id === ex.exId) : null;
    const liveLibModels = liveLibEx?.models || [];
    if (liveLibModels.length > 0 && !ex.activeModelId) {
      haptic("warning");
      setExoSheetOpen(true);
      return;
    }
    const newExos = [...session.exercises];
    const newSets = [...newExos[exIdx].sets];
    newSets[setIdx] = { ...sNormalized, _confirmed: true };
    newExos[exIdx] = { ...newExos[exIdx], sets: newSets };
    onUpdate({ ...session, exercises: newExos });

    const prs = computePRsForSet(newExos[exIdx], setIdx, journalLogs);
    haptic("success");
    // Le timer ne démarre JAMAIS automatiquement (décision verrouillée v40).

    // Popup dépassement de cible (cible effective = modelTargets si modèle actif)
    const w = parseFloat(fallbackWeight);
    let effectiveTarget = parseFloat(ex.targetWeight);
    let targetModelId: string | null = null;
    if (ex.activeModelId) {
      const mt = (ex.modelTargets || []).find((t: Any) => t.modelId === ex.activeModelId);
      if (mt && mt.weight !== "" && mt.weight !== undefined && mt.weight !== null) {
        effectiveTarget = parseFloat(mt.weight);
        targetModelId = ex.activeModelId;
      }
    }
    const exceed =
      !isNaN(w) && !isNaN(effectiveTarget) && effectiveTarget > 0 && w > effectiveTarget
        ? { exIdx, newWeight: w, oldTarget: effectiveTarget, targetModelId, exId: ex.exId }
        : null;

    if (prs.length) {
      haptic("heavy");
      // PR + dépassement en même temps (cas fréquent) : la cible attend la
      // fermeture de la Modal PR — jamais deux Modals dans le même tick.
      pendingTargetRef.current = exceed;
      setLwbPR(prs[0]);
    } else if (exceed) {
      setUpdateTargetOpen(exceed);
    }
  };

  const finishSession = (force = false) => {
    const pending: Any[] = [];
    session.exercises.forEach((ex: Any) => {
      const sets = ex.sets || [];
      if (sets.length === 0) return; // exo volontairement sauté
      const unconfirmed = sets.filter((s: Any) => !(s._confirmed && isValidSet(s))).length;
      if (unconfirmed > 0) pending.push({ exName: ex.exName || "?", pendingCount: unconfirmed });
    });
    const hasAnyConfirmed = session.exercises.some((ex: Any) => (ex.sets || []).some((s: Any) => s._confirmed && isValidSet(s)));
    // Sans AUCUNE série validée : rien à logger, on bloque toujours.
    // Avec des séries en attente : confirmation "continuer / terminer quand même"
    // (les séries non validées sont ignorées, seules les validées sont loggées).
    if (!hasAnyConfirmed || (pending.length > 0 && !force)) {
      haptic("warning");
      setFinishBlocked({ pending, canForce: hasAnyConfirmed });
      return;
    }

    const ex = session.exercises.filter((e: Any) => (e.sets || []).some((s: Any) => s._confirmed && isValidSet(s)));
    const allPRs: Any[] = [];
    ex.forEach((e: Any) => allPRs.push(...computePRs(e, journalLogs)));
    const log = {
      id: session.id,
      sessionId: session.sessionId,
      programId: session.programId,
      sessionName: session.sessionName,
      programName: session.programName,
      date: session.date,
      durationSec: Math.floor((Date.now() - session.startedAt) / 1000),
      exercises: ex.map((e: Any) => ({
        id: e.id,
        exId: e.exId,
        exName: e.exName,
        muscleGroup: e.muscleGroup,
        modelId: e.activeModelId || null,
        sets: (e.sets || [])
          .filter((s: Any) => s._confirmed && isValidSet(s))
          .map((s: Any) => ({
            weight: parseFloat(s.weight),
            reps: parseInt(s.reps),
            rir: s.rir !== "" && s.rir !== null && s.rir !== undefined ? parseInt(s.rir) : null,
          })),
      })),
      prs: allPRs,
    };
    haptic("success");
    onSave(log);
  };

  // Ré-hydratation depuis la lib live (renommages, modèles) — les PARAMÈTRES de
  // séance (cibles, sets, variantes) restent figés (port v40)
  const liveExercises = useMemo(() => {
    return session.exercises.map((ex: Any) => {
      const libEx = ex.exId ? exerciseLib.find((l) => l.id === ex.exId) : null;
      const libModels = libEx?.models || [];
      const validActiveModelId = libModels.find((m: Any) => m.id === ex.activeModelId) ? ex.activeModelId : null;
      return {
        ...ex,
        exName: libEx?.name || ex.exName,
        muscleGroup: libEx?.muscleGroup || ex.muscleGroup,
        setting: libEx?.setting || "",
        libModels,
        isCompound: libEx?.compound !== undefined ? libEx.compound : ex.isCompound,
        activeModelId: validActiveModelId,
      };
    });
  }, [session.exercises, exerciseLib]);

  const currentExo = liveExercises[session.currentExoIdx];

  // "la dernière fois" — recalculée dynamiquement au changement de variante/modèle
  const liveLastPerformance = useMemo(() => {
    if (!currentExo) return null;
    const k = exoKey({ exId: currentExo.exId, exName: currentExo.exName, modelId: currentExo.activeModelId });
    for (let i = journalLogs.length - 1; i >= 0; i--) {
      const log = journalLogs[i];
      const found = (log.exercises || []).find((ex: Any) => exoKey(ex) === k && (ex.sets || []).some(isValidSet));
      if (found) return { date: log.date, sets: (found.sets || []).filter(isValidSet) };
    }
    return null;
  }, [currentExo?.exId, currentExo?.exName, currentExo?.activeModelId, journalLogs]);

  if (!currentExo) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg0, alignItems: "center", justifyContent: "center", padding: 40 }}>
        <Text style={{ color: C.ink2, fontWeight: "700", marginBottom: 16 }}>Aucun exercice dans cette séance</Text>
        <Btn kind="ghost" onPress={() => router.navigate("/")}>Retour</Btn>
      </View>
    );
  }

  const switchExo = (idx: number) => {
    // Le timer SURVIT au switch d'exo (pas de reset)
    haptic("light");
    onUpdate({ ...session, currentExoIdx: idx });
  };

  // Variantes autres que l'active — "ou X / ou Y" (max 2 + "ou N autres")
  const variants = currentExo.variants || [];
  const otherVariants = variants
    .map((v: Any, vi: number) => {
      const libEx = v.exId ? exerciseLib.find((l) => l.id === v.exId) : null;
      const name = libEx?.name || v.name || "Variante " + (vi + 1);
      const active = currentExo.activeVariant === vi || (currentExo.exId && v.exId === currentExo.exId);
      return { vi, name, active, libEx };
    })
    .filter((x: Any) => !x.active);
  const visibleOther = otherVariants.slice(0, 2);
  const hiddenCount = otherVariants.length - visibleOther.length;

  const hasModels = (currentExo.libModels?.length || 0) > 0;
  const activeModel = currentExo.activeModelId ? (currentExo.libModels || []).find((m: Any) => m.id === currentExo.activeModelId) : null;
  const exoSetting = activeModel?.setting || (!hasModels ? currentExo.setting : null);
  const someConfirmed = (currentExo.sets || []).some((s: Any) => s._confirmed && isValidSet(s));
  const confirmedCount = (currentExo.sets || []).filter((s: Any) => s._confirmed && isValidSet(s)).length;

  const doSwitchVariant = (vi: number, v: Any, libEx: Any | null | undefined) => {
    updateExo(session.currentExoIdx, (ex) => ({
      ...ex,
      activeVariant: vi,
      exId: v.exId || ex.exId,
      exName: libEx?.name || ex.exName,
      muscleGroup: libEx?.muscleGroup || ex.muscleGroup,
      subGroup: libEx?.subGroup || ex.subGroup,
      isCompound: libEx?.compound || false,
      targetWeight: v.weight || ex.targetWeight,
      libModels: libEx?.models || [],
      setting: libEx?.setting || "",
      modelTargets: v.modelTargets || [],
      activeModelId: null,
      sets:
        confirmedCount > 0
          ? ex.sets.map(() => ({ weight: "", reps: "", rir: "1", _confirmed: false }))
          : ex.sets.map((s: Any) => (s._confirmed ? s : { ...s, weight: "" })),
    }));
    haptic("medium");
    setExoSheetOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <LWBOverlay
        pr={lwbPR}
        onClose={() => {
          setLwbPR(null);
          const pending = pendingTargetRef.current;
          pendingTargetRef.current = null;
          // Laisse l'animation de fermeture de la Modal PR se terminer avant
          // de présenter la ConfirmSheet (afterSheetClose = piège iOS)
          if (pending) afterSheetClose(() => setUpdateTargetOpen(pending));
        }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        {/* HEADER COMPACT 1 LIGNE */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Pressable onPress={() => router.navigate("/")} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={20} color={C.ink2} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.success }} />
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0, flexShrink: 1 }}>
              {session.sessionName}
            </Text>
            <SessionElapsed startedAt={session.startedAt} />
          </View>
          <Pressable
            onPress={() => setDiscardOpen(true)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: "rgba(255,59,72,.12)",
              borderWidth: 1,
              borderColor: "rgba(255,59,72,.3)",
              minHeight: 36,
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={15} color={C.danger} />
          </Pressable>
          <Btn sm onPress={() => finishSession()}>✓ Fin</Btn>
        </View>

        {/* Bandeau note de séance */}
        {noteHeaderVisible && !!session.sessionNote && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              padding: 12,
              borderRadius: 10,
              backgroundColor: "rgba(252,76,2,.12)",
              borderWidth: 1,
              borderColor: "rgba(252,76,2,.3)",
            }}
          >
            <Ionicons name="pencil" size={14} color={C.accentHi} />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: C.ink0, lineHeight: 18 }}>{session.sessionNote}</Text>
            <Pressable onPress={() => setNoteHeaderVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={16} color={C.accentHi} />
            </Pressable>
          </View>
        )}

        {/* CARTE EXO COMPACTE — tap ouvre la popup */}
        <Pressable
          onPress={() => setExoSheetOpen(true)}
          style={{
            padding: 12,
            marginBottom: 10,
            backgroundColor: "rgba(252,76,2,.05)",
            borderWidth: 1,
            borderColor: "rgba(252,76,2,.22)",
            borderRadius: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,.05)", paddingVertical: 3, paddingHorizontal: 6, borderRadius: 4 }}>
              <Text style={[mono, { color: C.ink3, fontSize: 10, fontWeight: "700" }]}>
                {session.currentExoIdx + 1}/{session.exercises.length}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: C.ink0, letterSpacing: -0.3 }}>
                {currentExo.exName}
              </Text>
              <Text style={{ fontSize: 11, color: C.ink2, fontWeight: "500", marginTop: 2 }}>
                {currentExo.muscleGroup}
                {currentExo.isCompound ? " · poly" : ""}
                {currentExo.targetWeight ? ` · cible ${currentExo.targetWeight} kg` : ""}
              </Text>
              {hasModels && !activeModel ? (
                <Text style={{ fontSize: 10, fontWeight: "700", color: C.accentHi, marginTop: 4 }}>⚠ Choisis une machine</Text>
              ) : activeModel || exoSetting ? (
                <Text numberOfLines={1} style={{ fontSize: 10, color: C.ink3, marginTop: 3 }}>
                  {activeModel ? <Text style={{ fontWeight: "700", color: C.ink2 }}>{activeModel.name}</Text> : null}
                  {activeModel && exoSetting ? " · " : ""}
                  {exoSetting ? <Text style={{ fontStyle: "italic" }}>{exoSetting}</Text> : null}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-down" size={14} color={C.ink3} />
          </View>
          {/* Variantes "ou ..." — orange sur "ou", max 2 + compteur */}
          {otherVariants.length > 0 && (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.05)" }}>
              {visibleOther.map((o: Any) => (
                <View key={o.vi} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
                  <Text style={{ width: 22, textAlign: "center", fontWeight: "700", color: C.accentHi, fontSize: 11 }}>ou</Text>
                  <Text numberOfLines={1} style={{ flex: 1, color: C.ink2, fontSize: 12 }}>
                    {o.name}
                  </Text>
                </View>
              ))}
              {hiddenCount > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
                  <Text style={{ width: 22, textAlign: "center", fontWeight: "700", color: C.accentHi, fontSize: 11 }}>ou</Text>
                  <Text style={{ color: C.ink3, fontSize: 11 }}>
                    {hiddenCount} autre{hiddenCount > 1 ? "s" : ""} variante{hiddenCount > 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Pressable>

        {/* TIMER DE REPOS */}
        <RestTimer
          seconds={timerDisplay}
          running={timerRunning}
          targetSeconds={timerTarget}
          onStart={startTimer}
          onStop={stopTimer}
          onReset={resetTimer}
          onAddRest={addRestTime}
        />

        {/* LA DERNIÈRE FOIS */}
        {liveLastPerformance && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 10, paddingLeft: 2 }}>
            <Text style={{ fontSize: 10, color: C.ink3, fontWeight: "500" }}>la dernière :</Text>
            {liveLastPerformance.sets.map((s: Any, i: number) => (
              <View key={i} style={{ paddingVertical: 2, paddingHorizontal: 6, backgroundColor: "rgba(255,255,255,.05)", borderRadius: 4 }}>
                <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.ink1 }]}>
                  {s.weight}×{s.reps}
                  {s.rir !== undefined && s.rir !== null && s.rir !== "" ? ` @${s.rir}` : ""}
                </Text>
              </View>
            ))}
            <Text style={{ fontSize: 10, color: INK4 }}>· {formatRelative(liveLastPerformance.date)}</Text>
          </View>
        )}

        {/* SÉRIES */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink0 }}>Séries</Text>
          <Text style={[mono, { fontSize: 11.5, color: C.ink3 }]}>
            {confirmedCount} / {currentExo.sets.length} confirmées
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          {currentExo.sets.map((s: Any, idx: number) => {
            const prevAllConfirmed = currentExo.sets.slice(0, idx).every((x: Any) => x._confirmed && isValidSet(x));
            const modelRequired = hasModels && !currentExo.activeModelId;
            const locked = (idx > 0 && !prevAllConfirmed) || modelRequired;
            const firstUnconfirmed = currentExo.sets.findIndex((x: Any) => !x._confirmed);
            return (
              <SetRow
                key={idx}
                set={s}
                idx={idx}
                confirmed={s._confirmed && isValidSet(s)}
                active={!s._confirmed && idx === firstUnconfirmed}
                locked={locked}
                targetWeight={currentExo.targetWeight}
                onChange={(key, val) => updateSet(session.currentExoIdx, idx, key, val)}
                onConfirm={() => confirmSet(session.currentExoIdx, idx)}
                onUnconfirm={() => unconfirmSet(session.currentExoIdx, idx)}
                onRemove={() => removeSet(session.currentExoIdx, idx)}
              />
            );
          })}
          <Btn kind="ghost" sm onPress={() => addSet(session.currentExoIdx)} style={{ marginTop: 6 }}>
            ＋ Série
          </Btn>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ============ EXO SHEET — popup unifiée ============ */}
      <Sheet open={exoSheetOpen} onClose={() => setExoSheetOpen(false)} title={currentExo.exName}>
        {/* Section MACHINE */}
        {hasModels && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <Label>Machine</Label>
              <Text style={{ fontSize: 10, fontWeight: "600", color: currentExo.activeModelId ? C.ink3 : C.accentHi }}>
                {someConfirmed ? "séries déjà validées" : currentExo.activeModelId ? "modifiable jusqu'à la 1ʳᵉ série" : "⚠ obligatoire avant la 1ʳᵉ série"}
              </Text>
            </View>
            <View style={{ gap: 5, marginBottom: 14 }}>
              {(currentExo.libModels || []).map((m: Any) => {
                const target = (currentExo.modelTargets || []).find((t: Any) => t.modelId === m.id);
                const active = currentExo.activeModelId === m.id;
                const doSwitchModel = () => {
                  updateExo(session.currentExoIdx, (ex) => ({
                    ...ex,
                    activeModelId: m.id,
                    targetWeight: target?.weight ? parseFloat(target.weight) : ex.targetWeight,
                    sets: someConfirmed
                      ? ex.sets.map(() => ({ weight: "", reps: "", rir: "1", _confirmed: false }))
                      : ex.sets.map((s: Any) => (s._confirmed ? s : { ...s, weight: "" })),
                  }));
                  haptic("medium");
                  setExoSheetOpen(false);
                };
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      if (active) {
                        setExoSheetOpen(false);
                        return;
                      }
                      if (someConfirmed) setSwitchVariantConfirm({ count: confirmedCount, name: m.name, doSwitch: doSwitchModel });
                      else doSwitchModel();
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 12,
                      minHeight: 64,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: active ? "rgba(252,76,2,.08)" : "rgba(255,255,255,.03)",
                      borderWidth: 1,
                      borderColor: active ? "rgba(252,76,2,.35)" : "rgba(255,255,255,.06)",
                    }}
                  >
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: active ? C.accent : "transparent",
                        borderWidth: active ? 0 : 1.5,
                        borderColor: "rgba(255,255,255,.25)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active && <Ionicons name="checkmark" size={9} color="#fff" />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13, fontWeight: active ? "700" : "600", color: C.ink0 }}>{m.name}</Text>
                      {!!m.setting && (
                        <Text numberOfLines={1} style={{ fontSize: 10, color: C.ink3, marginTop: 1, fontStyle: "italic" }}>
                          {m.setting}
                        </Text>
                      )}
                      {!!target?.weight && <Text style={{ fontSize: 10, color: C.ink3, marginTop: 1 }}>cible {target.weight} kg</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Section VARIANTES */}
        {variants.length > 0 && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <Label>Variantes</Label>
              <Text style={{ fontSize: 11, color: C.ink3 }}>{currentExo.muscleGroup}</Text>
            </View>
            <View style={{ gap: 5, marginBottom: 8 }}>
              {variants.map((v: Any, vi: number) => {
                const libEx = v.exId ? exerciseLib.find((l) => l.id === v.exId) : null;
                const name = libEx?.name || v.name || "Variante " + (vi + 1);
                const active = currentExo.activeVariant === vi || (currentExo.exId && v.exId === currentExo.exId);
                return (
                  <Pressable
                    key={vi}
                    onPress={() => {
                      if (active) {
                        setExoSheetOpen(false);
                        return;
                      }
                      if (confirmedCount > 0) setSwitchVariantConfirm({ count: confirmedCount, name, doSwitch: () => doSwitchVariant(vi, v, libEx) });
                      else doSwitchVariant(vi, v, libEx);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: active ? "rgba(252,76,2,.08)" : "rgba(255,255,255,.03)",
                      borderWidth: 1,
                      borderColor: active ? "rgba(252,76,2,.35)" : "rgba(255,255,255,.08)",
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: active ? C.accent : "transparent",
                        borderWidth: active ? 0 : 1.5,
                        borderColor: "rgba(255,255,255,.25)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active && <Ionicons name="checkmark" size={10} color="#fff" />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: active ? "700" : "600", color: C.ink0 }}>
                        {name}
                      </Text>
                      {active && <Text style={{ fontSize: 10, color: C.ink3, marginTop: 1 }}>actif</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderRadius: 10,
                marginBottom: 16,
                backgroundColor: "rgba(255,255,255,.03)",
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "rgba(255,255,255,.12)",
              }}
            >
              <Text style={{ fontSize: 14, color: C.ink2 }}>＋</Text>
              <Text style={{ flex: 1, color: C.ink2, fontSize: 12, fontWeight: "500" }}>Ajouter une variante (biblio)</Text>
              <Text style={{ color: C.ink3 }}>›</Text>
            </Pressable>
          </View>
        )}

        {/* Section SÉANCE */}
        <Label style={{ marginBottom: 8 }}>Séance — exercices</Label>
        <View style={{ gap: 4, marginBottom: 16 }}>
          {session.exercises.map((ex: Any, i: number) => {
            const done = (ex.sets || []).filter((s: Any) => s._confirmed && isValidSet(s)).length;
            const total = (ex.sets || []).length;
            const isCurrent = i === session.currentExoIdx;
            const allDone = total > 0 && done === total;
            return (
              <Pressable
                key={ex.id}
                onPress={() => {
                  switchExo(i);
                  setExoSheetOpen(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: isCurrent ? "rgba(252,76,2,.08)" : C.bg2,
                  borderWidth: 1,
                  borderColor: isCurrent ? "rgba(252,76,2,.3)" : LINE,
                }}
              >
                <View style={{ paddingVertical: 3, paddingHorizontal: 6, borderRadius: 4, backgroundColor: isCurrent ? "rgba(252,76,2,.15)" : C.bg3 }}>
                  <Text style={[mono, { fontSize: 10, fontWeight: "700", color: isCurrent ? C.accent : C.ink3 }]}>{pad2(i + 1)}</Text>
                </View>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: isCurrent ? "700" : "600", color: C.ink0 }}>
                  {ex.exName}
                </Text>
                <Text style={[mono, { fontSize: 11, fontWeight: "700", color: allDone ? C.success : isCurrent ? C.accent : C.ink3 }]}>
                  {done}/{total}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* PICKER — ajout de variante libre (filtré par muscle) */}
      <PickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={"Choisir un exo — " + (currentExo.muscleGroup || "")}
        search
        options={exerciseLib
          .filter((l) => l.muscleGroup === currentExo.muscleGroup && l.id !== currentExo.exId)
          .map((l) => ({ value: l.id, label: l.name, sub: (l.subGroup ? l.subGroup + " · " : "") + (l.compound ? "poly" : "iso") }))}
        onPick={(id) => {
          const newLibEx = exerciseLib.find((l) => l.id === id);
          if (!newLibEx) return;
          // Cible pour la variante : modelTargets programmés > choices.weight > dernière perf > vide
          const findTargetForVariant = (): number | "" => {
            if (currentProgram) {
              const progSession = currentProgram.sessions?.find((s: Any) => s.id === session.sessionId);
              const matchEx = progSession?.exercises?.find((pe: Any) => pe.choices?.some((c: Any) => c.exId === id));
              if (matchEx) {
                const mt = (matchEx.modelTargets || []).find((t: Any) => t.weight);
                if (mt?.weight) return parseFloat(mt.weight);
                const ch = (matchEx.choices || []).find((c: Any) => c.exId === id && c.weight);
                if (ch?.weight) return parseFloat(ch.weight);
              }
            }
            const tl = exoTimeline(journalLogs, "lib:" + id, "all");
            if (tl.length > 0) {
              const last = tl[tl.length - 1];
              if (last?.weight) return parseFloat(last.weight);
            }
            return "";
          };
          const variantTarget = findTargetForVariant();
          updateExo(session.currentExoIdx, (ex) => {
            const vs = [...(ex.variants || [])];
            const newIdx = vs.length;
            vs.push({ exId: newLibEx.id, name: newLibEx.name, weight: variantTarget });
            return {
              ...ex,
              variants: vs,
              activeVariant: newIdx,
              exId: newLibEx.id,
              exName: newLibEx.name,
              muscleGroup: newLibEx.muscleGroup,
              subGroup: newLibEx.subGroup || null,
              isCompound: !!newLibEx.compound,
              libModels: newLibEx.models || [],
              setting: newLibEx.setting || "",
              modelTargets: [],
              activeModelId: null,
              targetWeight: variantTarget,
              sets: ex.sets.map((s: Any) => (s._confirmed ? s : { ...s, weight: "" })),
            };
          });
          haptic("medium");
          setPickerOpen(false);
          setExoSheetOpen(false);
        }}
      />

      {/* Annuler la séance */}
      <ConfirmSheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={onDiscard}
        title="Annuler la séance en cours ?"
        message="Les séries saisies seront perdues. Utilise le bouton retour pour juste mettre en pause."
      />

      {/* Switch variante avec séries confirmées */}
      <ConfirmSheet
        open={!!switchVariantConfirm}
        onClose={() => setSwitchVariantConfirm(null)}
        onConfirm={() => {
          switchVariantConfirm?.doSwitch();
          setSwitchVariantConfirm(null);
        }}
        title="Changer de variante ?"
        message={
          switchVariantConfirm
            ? `Tu as ${switchVariantConfirm.count} série${switchVariantConfirm.count > 1 ? "s" : ""} déjà validée${switchVariantConfirm.count > 1 ? "s" : ""}. Switcher vers « ${switchVariantConfirm.name} » va les effacer.`
            : ""
        }
        confirmLabel="Effacer et switcher"
      />

      {/* Dépassement de cible */}
      <ConfirmSheet
        open={!!updateTargetOpen}
        onClose={() => setUpdateTargetOpen(null)}
        onConfirm={async () => {
          if (!updateTargetOpen) return;
          const { exIdx, newWeight, targetModelId, exId } = updateTargetOpen;
          const ex = session.exercises[exIdx];
          updateExo(exIdx, (e) => {
            if (targetModelId) {
              const mt = (e.modelTargets || []).map((t: Any) => (t.modelId === targetModelId ? { ...t, weight: newWeight } : t));
              if (!mt.find((t: Any) => t.modelId === targetModelId)) mt.push({ modelId: targetModelId, weight: newWeight });
              return { ...e, modelTargets: mt, targetWeight: newWeight };
            }
            return { ...e, targetWeight: newWeight };
          });
          // Persiste la cible dans le programme (modelTargets si modèle actif)
          if (session.programId && ex.progId) {
            await data.updateProgramTarget(ex.progId, { targetModelId, exId, newWeight });
          }
          setUpdateTargetOpen(null);
        }}
        title="Tu as dépassé la cible 💪"
        message={updateTargetOpen ? `${updateTargetOpen.newWeight} kg > cible ${updateTargetOpen.oldTarget} kg. Mettre à jour la cible du programme pour la prochaine fois ?` : ""}
        confirmLabel="Mettre à jour"
        danger={false}
      />

      {/* Séance incomplète — confirmation (port v40 + option "terminer quand même") */}
      <Sheet open={!!finishBlocked} onClose={() => setFinishBlocked(null)} title="Séance incomplète">
        {finishBlocked && (
          <View>
            <Text style={{ fontSize: 14, color: C.ink1, lineHeight: 20, marginBottom: 14 }}>
              {finishBlocked.canForce
                ? "Certaines séries ne sont pas validées. Tu peux continuer la séance, ou terminer quand même : seules les séries validées ✓ seront enregistrées."
                : "Aucune série validée. Ajoute au moins une série sur un exercice, ou annule la séance si tu ne veux rien enregistrer."}
            </Text>
            {finishBlocked.pending.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Label style={{ marginBottom: 8 }}>Séries non validées</Label>
                <View style={{ gap: 4 }}>
                  {finishBlocked.pending.map((p: Any, i: number) => (
                    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", padding: 10, backgroundColor: C.bg3, borderRadius: 8 }}>
                      <Text numberOfLines={1} style={{ color: C.ink1, fontWeight: "600", fontSize: 13, flex: 1, marginRight: 10 }}>
                        {p.exName}
                      </Text>
                      <Text style={[mono, { color: C.accent, fontWeight: "800", fontSize: 13 }]}>
                        {p.pendingCount} série{p.pendingCount > 1 ? "s" : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {finishBlocked.canForce ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Btn kind="ghost" onPress={() => setFinishBlocked(null)} style={{ flex: 1 }}>
                  Continuer
                </Btn>
                <Btn
                  onPress={() => {
                    setFinishBlocked(null);
                    finishSession(true);
                  }}
                  style={{ flex: 1 }}
                >
                  Terminer quand même
                </Btn>
              </View>
            ) : (
              <Btn full onPress={() => setFinishBlocked(null)}>
                Compris
              </Btn>
            )}
          </View>
        )}
      </Sheet>
    </View>
  );
}
