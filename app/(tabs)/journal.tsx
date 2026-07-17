// Journal — port v40 : prochaine séance recommandée, autres séances, notes de
// séance future, historique groupé par mois, détail + suppression.
// Quand une séance est active, l'écran devient la séance live (comme v40).
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C, R, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import { useActiveSession, buildLiveSession } from "@/lib/activeSession";
import { recommendedSession, tonnageSession, type Any } from "@/core/mylift";
import { MONTHS_FR, DOW_FR, DOW_FR_S, formatRelative, formatNum, formatDur } from "@/lib/format";
import { Sheet, ConfirmSheet, Btn, Chip, SectionLabel, LINE, ACCENT_WASH } from "@/ui/kit";
import SessionLive from "@/screens/SessionLive";
import SessionRecap from "@/screens/SessionRecap";
import { haptic } from "@/lib/haptics";
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
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={{
        backgroundColor: C.bg2,
        borderWidth: 1,
        borderColor: recommended ? "rgba(252,76,2,.3)" : LINE,
        borderRadius: R.md,
        padding: 18,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      {recommended && (
        <View style={{ position: "absolute", left: 0, top: 18, bottom: 18, width: 3, backgroundColor: C.accent, borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "800", letterSpacing: -0.3, color: C.ink0, flexShrink: 1 }}>
              {session.name}
            </Text>
            {recommended && (
              <View style={{ backgroundColor: "rgba(255,194,51,.14)", paddingVertical: 3, paddingHorizontal: 7, borderRadius: 999 }}>
                <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: C.gold }}>Reco</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={1} style={{ fontSize: 12, color: C.ink2, fontWeight: "500" }}>
            {exos.length} exo{exos.length > 1 ? "s" : ""}
            {lastLog ? " · " + formatRelative(lastLog.date) : " · jamais fait"}
          </Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={C.ink3} />
      </View>

      {!expanded && topExos.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
          {topExos.map((n: string, i: number) => (
            <Chip key={i} tone={i === 0 && recommended ? "primary" : undefined}>
              {n}
            </Chip>
          ))}
          {more > 0 && <Chip>+ {more}</Chip>}
        </View>
      )}

      {expanded && (
        <View style={{ marginBottom: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE }}>
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
        </View>
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
        ▶ Commencer
      </Btn>
    </Pressable>
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
function HistoryDetail({ log, onDelete }: { log: Any; onDelete: () => void }) {
  const ton = tonnageSession(log) / 1000;
  return (
    <View>
      <Text style={[mono, { color: C.ink2, fontSize: 13, marginBottom: 14 }]}>
        {log.date} · {formatNum(ton, 1)} t · {formatDur(log.durationSec || 0)}
        {log.programName ? " · " + log.programName : ""}
      </Text>
      {(log.exercises || []).map((ex: Any, i: number) => (
        <View key={ex.id || i} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink0, flex: 1 }} numberOfLines={1}>
              {ex.exName}
            </Text>
            {!!ex.muscleGroup && <Text style={{ fontSize: 11, color: C.ink3 }}>{ex.muscleGroup}</Text>}
          </View>
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
        </View>
      ))}
      {(log.prs || []).length > 0 && (
        <View style={{ marginBottom: 14, padding: 12, backgroundColor: "rgba(255,194,51,.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,194,51,.25)" }}>
          {(log.prs || []).map((pr: Any, i: number) => (
            <Text key={i} style={[mono, { fontSize: 12, color: C.gold, fontWeight: "700", paddingVertical: 2 }]}>
              🏆 {pr.type === "all-time" || pr.type === "allTime" ? "All-time" : "Rep PR"} · {pr.exName} · {pr.weight} kg × {pr.reps}
            </Text>
          ))}
        </View>
      )}
      <Btn kind="danger" full onPress={onDelete}>
        Supprimer la séance
      </Btn>
    </View>
  );
}

/* ------------------------------------------------------------------ */
export default function Journal() {
  const insets = useSafeAreaInsets();
  const data = useData();
  const { journalLogs, programs, profile, exerciseLib, sessionNotes, ready } = data;
  const { activeSession, setActiveSession } = useActiveSession();

  const [detailLog, setDetailLog] = useState<Any | null>(null);
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
        <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>Prochaine séance.</Text>
      </View>

      {!currentProgram && (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink2, marginBottom: 4 }}>Pas de programme actif</Text>
          <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center" }}>
            Va dans Réglages pour créer un programme, ou importe ton backup v40.
          </Text>
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
              <View style={{ paddingTop: 4 }}>
                {logs.map((log) => (
                  <HistoryRow key={log.id} log={log} onPress={() => setDetailLog(log)} />
                ))}
              </View>
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
                    setConfirmStartSession(s);
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
                    setNoteEdit({ session: s, draft: sNote || "" });
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
        {detailLog && <HistoryDetail log={detailLog} onDelete={() => setDeleteLogConfirm(detailLog)} />}
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
