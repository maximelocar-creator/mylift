// Journal — port v40 : prochaine séance recommandée, autres séances, notes de
// séance future, historique groupé par mois, détail + suppression.
// Quand une séance est active, l'écran devient la séance live (comme v40).
import { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, R, mono, MOTION } from "@/lib/theme";
import { useData } from "@/lib/store";
import { useActiveSession, buildLiveSession } from "@/lib/activeSession";
import { recommendedSession, tonnageSession, type Any } from "@/core/mylift";
import { ShareSessionSheet } from "@/screens/ComposePost";
import { MONTHS_FR, DOW_FR, DOW_FR_S, formatRelative, formatNum, formatDur } from "@/lib/format";
import { Sheet, ConfirmSheet, Btn, Chip, SectionLabel, afterSheetClose, LINE, ACCENT_WASH, SyncDot } from "@/ui/kit";
import SessionLive from "@/screens/SessionLive";
import SessionRecap from "@/screens/SessionRecap";
import { haptic } from "@/lib/haptics";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { ScreenSkeleton } from "@/ui/kit";

const noteKey = (programId: string | null | undefined, sessionId: string) => (programId || "") + "::" + sessionId;

/* ------------------------------------------------------------------ */
function SessionCard({
  session,
  program,
  journalLogs,
  lib,
  recommended,
  note,
  onStart,
  onEditNote,
}: {
  session: Any;
  program: Any;
  journalLogs: Any[];
  lib: Any[];
  recommended?: boolean;
  note: string | null;
  onStart: () => void;
  onEditNote: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lastLog = journalLogs.filter((l) => l.sessionId === session.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  const exos = session.exercises || [];
  const topExos = exos.slice(0, 3).map((ex: Any) => {
    const c = ex.choices?.[0];
    const libEx = c?.exId ? lib.find((l) => l.id === c.exId) : null;
    return libEx?.name || ex.exName || "?";
  });
  const more = Math.max(0, exos.length - 3);

  return (
    <Animated.View layout={LinearTransition.springify().damping(26).stiffness(300)}>
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={{
        backgroundColor: recommended ? C.bg1 : C.bg2,
        borderWidth: 1,
        borderColor: recommended ? "rgba(252,76,2,.4)" : LINE,
        borderRadius: recommended ? R.lg : R.md,
        padding: recommended ? 20 : 18,
        marginBottom: 10,
        overflow: "hidden",
        // Halo accent discret — même langage que la bannière séance en cours
        ...(recommended
          ? { shadowColor: C.accent, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 }
          : null),
      }}
    >
      {recommended && (
        <>
          {/* Voile chaud en tête de carte, fondu vers le fond */}
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: 64, backgroundColor: ACCENT_WASH }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Ionicons name="sparkles" size={11} color={C.accentHi} />
            <Text style={[mono, { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase", color: C.accentHi }]}>
              Recommandée aujourd'hui
            </Text>
          </View>
        </>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: recommended ? 22 : 18, fontWeight: "800", letterSpacing: recommended ? -0.7 : -0.3, color: C.ink0, marginBottom: 2 }}>
            {session.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: C.ink2, fontWeight: "500" }}>
            {exos.length} exo{exos.length > 1 ? "s" : ""}
            {lastLog ? " · " + formatRelative(lastLog.date) : " · jamais fait"}
          </Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={C.ink3} />
      </View>

      {!expanded && topExos.length > 0 && recommended && (
        <View style={{ marginBottom: 14, borderRadius: 12, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: LINE, overflow: "hidden" }}>
          {topExos.map((n: string, i: number) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 9,
                paddingHorizontal: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: LINE,
              }}
            >
              <Text style={[mono, { fontSize: 10, fontWeight: "800", color: C.accentHi, width: 16 }]}>{i + 1}</Text>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: "600", color: C.ink1 }}>
                {n}
              </Text>
            </View>
          ))}
          {more > 0 && (
            <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: LINE }}>
              <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.ink3 }]}>+ {more} autre{more > 1 ? "s" : ""} exo{more > 1 ? "s" : ""}</Text>
            </View>
          )}
        </View>
      )}
      {!expanded && topExos.length > 0 && !recommended && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 12 }}>
          {topExos.map((n: string, i: number) => (
            <Chip key={i}>{n}</Chip>
          ))}
          {more > 0 && <Chip>+ {more}</Chip>}
        </View>
      )}

      {expanded && (
        <Animated.View
          entering={FadeInDown.duration(MOTION.local)}
          style={{ marginBottom: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE }}
        >
          {exos.map((ex: Any, i: number) => {
            const c = ex.choices?.[0];
            const libEx = c?.exId ? lib.find((l) => l.id === c.exId) : null;
            const name = libEx?.name || ex.exName || "?";
            const muscle = libEx?.muscleGroup || ex.muscleGroup;
            const sets = parseInt(ex.sets) || 0;
            const target = ex.targetWeight || c?.weight;
            return (
              <View key={ex.id || i} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 6 }}>
                <Text style={[mono, { color: C.ink3, fontSize: 10, fontWeight: "700", width: 24 }]}>{i + 1}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontWeight: "700", color: C.ink0, fontSize: 13 }}>
                    {name}
                  </Text>
                  {!!muscle && <Text style={{ fontSize: 11, color: C.ink3, marginTop: 1 }}>{muscle}</Text>}
                </View>
                <Text style={[mono, { fontSize: 12, color: C.ink2 }]}>
                  {sets} × {target ? target + " kg" : "—"}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      )}

      {note ? (
        <Pressable
          onPress={onEditNote}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
            backgroundColor: ACCENT_WASH,
            borderWidth: 1,
            borderColor: "rgba(252,76,2,.25)",
          }}
        >
          <Ionicons name="pencil" size={14} color={C.accentHi} />
          <Text style={{ fontSize: 12.5, fontWeight: "500", color: C.ink1, lineHeight: 17, flex: 1 }}>{note}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onEditNote} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 10 }}>
          <Ionicons name="pencil" size={12} color={C.ink3} />
          <Text style={{ color: C.ink3, fontSize: 12, fontWeight: "600" }}>Ajouter une note pour cette séance</Text>
        </Pressable>
      )}

      <Btn kind={recommended ? "primary" : "ghost"} full onPress={onStart}>
        Commencer
      </Btn>
    </Pressable>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
function HistoryRow({ log, onPress }: { log: Any; onPress: () => void }) {
  const ton = tonnageSession(log) / 1000;
  const prs = log.prs?.length || 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        padding: 12,
        backgroundColor: pressed ? "#1F1F33" : C.bg2,
        borderWidth: 1,
        borderColor: LINE,
        borderRadius: R.md,
        marginBottom: 6,
      })}
    >
      <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" }}>
        <Text style={[mono, { fontSize: 10, color: C.ink3, fontWeight: "700" }]}>{DOW_FR_S[(new Date(log.date).getDay() + 6) % 7].toUpperCase()}</Text>
        <Text style={[mono, { fontSize: 18, fontWeight: "800", color: C.ink0 }]}>{parseInt(log.date.split("-")[2])}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>{log.sessionName || "Séance"}</Text>
        <Text style={[mono, { fontSize: 12, color: C.ink2, marginTop: 2 }]}>
          {(log.exercises || []).length} exos · {formatNum(ton, 1)} t · {formatDur(log.durationSec || 0)}
        </Text>
      </View>
      {prs > 0 && <Chip tone="gold">{prs} PR</Chip>}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Détail d'une séance passée — port v40 HistoryDetail : lecture + mode
   « Modifier les séries » (draft profond, Annuler/Enregistrer) + partage.
   La persistance passe par updateLog (delete + réinsertion : l'immuabilité
   serveur — UPDATE bloqué par trigger — n'est jamais contournée). */
function HistoryDetail({ log, onDelete, onUpdate, onShare }: { log: Any; onDelete: () => void; onUpdate: (l: Any) => Promise<void>; onShare: () => void }) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Any | null>(null);
  useEffect(() => {
    setEditMode(false);
    setDraft(null);
  }, [log.id]);

  const view = editMode && draft ? draft : log;
  const ton = tonnageSession(view) / 1000;

  const enterEdit = () => {
    setDraft({ ...log, exercises: (log.exercises || []).map((ex: Any) => ({ ...ex, sets: (ex.sets || []).map((s: Any) => ({ ...s })) })) });
    setEditMode(true);
    haptic("light");
  };
  const cancelEdit = () => {
    setDraft(null);
    setEditMode(false);
    haptic("light");
  };
  const saveEdit = async () => {
    if (!draft) return;
    await onUpdate(draft);
    setEditMode(false);
    setDraft(null);
    haptic("success");
  };
  const updateDraftSet = (exIdx: number, setIdx: number, key: string, value: string) => {
    setDraft((d: Any) => {
      if (!d) return d;
      const exos = [...d.exercises];
      const sets = [...exos[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], [key]: value };
      exos[exIdx] = { ...exos[exIdx], sets };
      return { ...d, exercises: exos };
    });
  };

  const editInput = {
    backgroundColor: "rgba(255,255,255,.05)",
    borderRadius: 8,
    color: C.ink0,
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 12.5,
    textAlign: "center" as const,
    flex: 1,
  };

  return (
    <View>
      <Text style={[mono, { color: C.ink2, fontSize: 13, marginBottom: 14 }]}>
        {view.date} · {formatNum(ton, 1)} t · {formatDur(view.durationSec || 0)}
        {view.programName ? " · " + view.programName : ""}
      </Text>

      {!editMode ? (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <Btn kind="ghost" sm onPress={enterEdit} style={{ flex: 1 }}>
            ✎ Modifier les séries
          </Btn>
          <Btn sm onPress={onShare} style={{ flex: 1 }}>
            Partager
          </Btn>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <Btn kind="ghost" sm onPress={cancelEdit} style={{ flex: 1 }}>
            Annuler
          </Btn>
          <Btn sm onPress={() => saveEdit()} style={{ flex: 1 }}>
            ✓ Enregistrer
          </Btn>
        </View>
      )}

      {(view.exercises || []).map((ex: Any, exIdx: number) => (
        <View key={ex.id || exIdx} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink0, flex: 1 }} numberOfLines={1}>
              {ex.exName}
            </Text>
            {!!ex.muscleGroup && <Text style={{ fontSize: 11, color: C.ink3 }}>{ex.muscleGroup}</Text>}
          </View>
          {editMode ? (
            <View style={{ gap: 3 }}>
              {(ex.sets || []).map((s: Any, si: number) => (
                <View key={si} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 6, backgroundColor: C.bg3, borderRadius: 8 }}>
                  <Text style={[mono, { color: C.ink3, fontSize: 10, fontWeight: "700", width: 18, textAlign: "center" }]}>{si + 1}</Text>
                  <TextInput value={String(s.weight ?? "")} onChangeText={(t) => updateDraftSet(exIdx, si, "weight", t)} keyboardType="decimal-pad" placeholder="kg" placeholderTextColor={C.ink3} style={editInput} />
                  <TextInput value={String(s.reps ?? "")} onChangeText={(t) => updateDraftSet(exIdx, si, "reps", t)} keyboardType="number-pad" placeholder="reps" placeholderTextColor={C.ink3} style={editInput} />
                  <TextInput value={String(s.rir ?? "")} onChangeText={(t) => updateDraftSet(exIdx, si, "rir", t)} keyboardType="number-pad" placeholder="RIR" placeholderTextColor={C.ink3} style={[editInput, { flex: 0.7 }]} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              {(ex.sets || []).map((s: Any, si: number) => (
                <View key={si} style={{ paddingVertical: 3, paddingHorizontal: 8, backgroundColor: C.bg3, borderRadius: 6 }}>
                  <Text style={[mono, { fontSize: 12, fontWeight: "700", color: C.ink1 }]}>
                    {s.weight}×{s.reps}
                    {s.rir !== null && s.rir !== undefined && s.rir !== "" ? ` @${s.rir}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
      {!editMode && (view.prs || []).length > 0 && (
        <View style={{ marginBottom: 14, padding: 12, backgroundColor: "rgba(255,194,51,.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,194,51,.25)" }}>
          {(view.prs || []).map((pr: Any, i: number) => (
            <Text key={i} style={[mono, { fontSize: 12, color: C.gold, fontWeight: "700", paddingVertical: 2 }]}>
              🏆 {pr.type === "all-time" || pr.type === "allTime" ? "All-time" : "Rep PR"} · {pr.exName} · {pr.weight} kg × {pr.reps}
            </Text>
          ))}
        </View>
      )}
      {!editMode && (
        <Btn kind="danger" full onPress={onDelete}>
          Supprimer la séance
        </Btn>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
export default function Journal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useData();
  const { journalLogs, programs, profile, exerciseLib, sessionNotes, ready } = data;
  const { activeSession, setActiveSession } = useActiveSession();

  const [detailLog, setDetailLog] = useState<Any | null>(null);
  const [shareLog, setShareLog] = useState<Any | null>(null);
  const [deleteLogConfirm, setDeleteLogConfirm] = useState<Any | null>(null);
  const [otherPickerOpen, setOtherPickerOpen] = useState(false);
  const [confirmStartSession, setConfirmStartSession] = useState<Any | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ session: Any; draft: string } | null>(null);
  const [recapLog, setRecapLog] = useState<Any | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    const now = new Date();
    return new Set([`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`]);
  });

  const currentProgram = useMemo(() => {
    const byId = programs.find((p) => p.id === profile?.currentProgramId);
    return byId || programs[0] || null;
  }, [programs, profile]);

  const startSession = (progSession: Any) => {
    haptic("medium");
    const note = sessionNotes[noteKey(currentProgram?.id, progSession.id)] || null;
    setActiveSession(buildLiveSession(progSession, currentProgram, exerciseLib, journalLogs, note));
  };

  if (!ready) return <ScreenSkeleton paddingTop={insets.top + 12} />;

  // Séance live active → l'écran EST la séance (comme v40)
  if (activeSession) {
    return (
      <SessionLive
        session={activeSession}
        onSave={async (log: Any) => {
          await data.saveLog(log);
          // Consomme la note de séance future (persiste jusqu'à validation)
          if (activeSession.sessionNote) {
            await data.setSessionNote(noteKey(activeSession.programId, activeSession.sessionId), null);
          }
          setActiveSession(null);
          setRecapLog(log);
        }}
        onDiscard={() => setActiveSession(null)}
        onUpdate={(updated: Any) => setActiveSession(updated)}
      />
    );
  }

  const recommended = currentProgram ? recommendedSession(currentProgram, journalLogs) : null;
  const otherSessions = (currentProgram?.sessions || []).filter((s: Any) => s.id !== recommended?.id);

  // Historique groupé par mois
  const sortedLogs = [...journalLogs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const monthsMap = new Map<string, Any[]>();
  sortedLogs.forEach((log) => {
    const key = (log.date || "").slice(0, 7);
    if (!monthsMap.has(key)) monthsMap.set(key, []);
    monthsMap.get(key)!.push(log);
  });
  const months = [...monthsMap.entries()];
  const monthLabel = (ym: string) => {
    if (!ym) return "";
    const [y, m] = ym.split("-");
    return MONTHS_FR[parseInt(m) - 1] + " " + y;
  };
  const toggleMonth = (ym: string) => {
    const next = new Set(expandedMonths);
    if (next.has(ym)) next.delete(ym);
    else next.add(ym);
    setExpandedMonths(next);
  };

  const today = new Date();
  const kicker = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()} · ${DOW_FR[(today.getDay() + 6) % 7]}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 24 }}>
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
          <Text style={[mono, { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", color: C.ink3 }]}>{kicker}</Text>
          {programs.length > 1 && currentProgram && (
            <Pressable
              onPress={() => {
                const idx = programs.findIndex((p) => p.id === currentProgram.id);
                data.setCurrentProgram(programs[(idx + 1) % programs.length].id);
              }}
              style={{ marginLeft: "auto" }}
            >
              <Chip tone="primary">{currentProgram.name}</Chip>
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>Prochaine séance.</Text>
          <SyncDot />
        </View>
      </View>

      {!currentProgram && (
        <View style={{ alignItems: "center", padding: 32, gap: 8 }}>
          <Text style={{ fontSize: 32 }}>🏋️</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink1 }}>Pas encore de programme</Text>
          <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center", marginBottom: 12 }}>
            Crée ton premier programme : le générateur construit tes séances selon ton niveau et tes muscles prioritaires.
          </Text>
          <Btn full onPress={() => router.push("/generator")}>
            🧠 Générer mon programme
          </Btn>
          <Btn kind="ghost" full onPress={() => router.push("/settings")}>
            Créer un programme vide
          </Btn>
        </View>
      )}

      {recommended && currentProgram && (
        <SessionCard
          session={recommended}
          program={currentProgram}
          journalLogs={journalLogs}
          lib={exerciseLib}
          recommended
          note={sessionNotes[noteKey(currentProgram.id, recommended.id)] || null}
          onStart={() => startSession(recommended)}
          onEditNote={() => setNoteEdit({ session: recommended, draft: sessionNotes[noteKey(currentProgram.id, recommended.id)] || "" })}
        />
      )}

      {otherSessions.length > 0 && (
        <Btn kind="ghost" full onPress={() => setOtherPickerOpen(true)} style={{ marginTop: 2 }}>
          ＋ Autre séance du programme
        </Btn>
      )}

      {/* Historique */}
      {months.length > 0 && (
        <SectionLabel right={`${sortedLogs.length} séance${sortedLogs.length > 1 ? "s" : ""}`}>Historique</SectionLabel>
      )}
      {months.map(([ym, logs]) => {
        const expanded = expandedMonths.has(ym);
        const totalTon = logs.reduce((a, l) => a + tonnageSession(l), 0) / 1000;
        return (
          <View key={ym} style={{ marginBottom: 6 }}>
            <Pressable
              onPress={() => toggleMonth(ym)}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: C.bg2,
                borderWidth: 1,
                borderColor: LINE,
                marginBottom: expanded ? 4 : 0,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={14} color={C.ink3} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink0, textTransform: "capitalize" }}>{monthLabel(ym)}</Text>
              </View>
              <Text style={[mono, { fontSize: 11.5, color: C.ink3 }]}>
                {logs.length} séance{logs.length > 1 ? "s" : ""} · {formatNum(totalTon, 1)} t
              </Text>
            </Pressable>
            {expanded && (
              <Animated.View entering={FadeIn.duration(200)} style={{ paddingTop: 4 }}>
                {logs.map((log) => (
                  <HistoryRow key={log.id} log={log} onPress={() => setDetailLog(log)} />
                ))}
              </Animated.View>
            )}
          </View>
        );
      })}

      {/* Sheet autres séances */}
      <Sheet open={otherPickerOpen} onClose={() => setOtherPickerOpen(false)} title="Choisir une séance">
        <View style={{ gap: 6 }}>
          {otherSessions.map((s: Any) => {
            const lastLog = journalLogs.filter((l) => l.sessionId === s.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
            const dAgo = lastLog ? Math.floor((Date.now() - new Date(lastLog.date).getTime()) / 86400000) : null;
            const sNote = sessionNotes[noteKey(currentProgram?.id, s.id)];
            return (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: C.bg3 }}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    setOtherPickerOpen(false);
                    afterSheetClose(() => setConfirmStartSession(s));
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>{s.name}</Text>
                  <Text style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>
                    {(s.exercises || []).length} exos{dAgo !== null ? ` · il y a ${dAgo}j` : " · jamais faite"}
                    {sNote ? " · note ✎" : ""}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setOtherPickerOpen(false);
                    afterSheetClose(() => setNoteEdit({ session: s, draft: sNote || "" }));
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: sNote ? ACCENT_WASH : C.bg2,
                  }}
                >
                  <Ionicons name="pencil" size={14} color={sNote ? C.accentHi : C.ink3} />
                </Pressable>
              </View>
            );
          })}
        </View>
      </Sheet>

      {/* Partage d'une séance passée : même composeur que le récap (feed + export Insta).
          Payload machine-free : stats + PRs, jamais de modelId. */}
      <ShareSessionSheet log={shareLog} open={!!shareLog} onClose={() => setShareLog(null)} />

      {/* Sheet note de séance future */}
      <Sheet open={!!noteEdit} onClose={() => setNoteEdit(null)} title={noteEdit ? "Note · " + noteEdit.session.name : "Note"}>
        {noteEdit && (
          <View>
            <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 12 }}>
              Cette note s'affichera au lancement de la séance. Elle reste jusqu'à ce que tu la supprimes.
            </Text>
            <TextInput
              value={noteEdit.draft}
              onChangeText={(t) => setNoteEdit({ ...noteEdit, draft: t })}
              placeholder="Écris ta note ici…"
              placeholderTextColor={C.ink3}
              multiline
              style={{
                backgroundColor: "rgba(255,255,255,.04)",
                borderWidth: 1,
                borderColor: LINE,
                borderRadius: 12,
                color: C.ink0,
                padding: 14,
                fontSize: 15,
                minHeight: 100,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              {!!sessionNotes[noteKey(currentProgram?.id, noteEdit.session.id)] && (
                <Btn
                  kind="ghost"
                  onPress={async () => {
                    await data.setSessionNote(noteKey(currentProgram?.id, noteEdit.session.id), null);
                    setNoteEdit(null);
                  }}
                >
                  🗑
                </Btn>
              )}
              <Btn
                full
                style={{ flex: 1 }}
                onPress={async () => {
                  await data.setSessionNote(noteKey(currentProgram?.id, noteEdit.session.id), noteEdit.draft);
                  setNoteEdit(null);
                }}
              >
                Enregistrer
              </Btn>
            </View>
          </View>
        )}
      </Sheet>

      {/* Confirmation lancer séance */}
      <ConfirmSheet
        open={!!confirmStartSession}
        onClose={() => setConfirmStartSession(null)}
        onConfirm={() => {
          if (confirmStartSession) startSession(confirmStartSession);
          setConfirmStartSession(null);
        }}
        title="Lancer cette séance ?"
        message={confirmStartSession ? `"${confirmStartSession.name}" · ${(confirmStartSession.exercises || []).length} exercices` : ""}
        confirmLabel="Lancer"
        danger={false}
      />

      {/* Détail séance historique */}
      <Sheet open={!!detailLog} onClose={() => setDetailLog(null)} title={detailLog?.sessionName || "Détail"}>
        {detailLog && (
          <HistoryDetail
            log={detailLog}
            onDelete={() => setDeleteLogConfirm(detailLog)}
            onUpdate={async (updated) => {
              await data.updateLog(updated);
              setDetailLog(updated);
            }}
            onShare={() => {
              // Piège Modal iOS (CLAUDE.md) : on ferme le détail d'abord,
              // puis on présente le sélecteur après l'animation de sortie
              const log = detailLog;
              setDetailLog(null);
              afterSheetClose(() => setShareLog(log));
            }}
          />
        )}
      </Sheet>
      <ConfirmSheet
        open={!!deleteLogConfirm}
        onClose={() => setDeleteLogConfirm(null)}
        onConfirm={async () => {
          await data.deleteLog(deleteLogConfirm!.id);
          setDetailLog(null);
          setDeleteLogConfirm(null);
        }}
        title="Supprimer la séance ?"
        message="Cette séance sera définitivement supprimée de l'historique."
      />

      {/* Récap post-séance */}
      {recapLog && <SessionRecap log={recapLog} onClose={() => setRecapLog(null)} />}
    </ScrollView>
  );
}
