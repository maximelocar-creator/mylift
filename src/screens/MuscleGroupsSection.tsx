// Groupes musculaires — port de ParamsMuscleGroups (v40) en LISTE (lignes
// empilées 44px+, pas de bulles) : expand par groupe → sous-groupes éditables,
// ajout/rename/suppression aux deux niveaux.
// Contrainte v2 : rename/delete refusés si le groupe contient des exos seed
// (globaux, non modifiables par RLS) — message explicite au lieu d'une
// divergence silencieuse.
import { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, L, mono } from "../lib/theme";
import { haptic } from "../lib/haptics";
import { useData } from "../lib/store";
import { Sheet, ConfirmSheet, Btn, Label } from "../ui/kit";

const inputStyle = {
  backgroundColor: "rgba(255,255,255,.04)",
  borderWidth: 1,
  borderColor: L.line,
  borderRadius: 12,
  color: C.ink0,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
} as const;

export default function MuscleGroupsSection() {
  const data = useData();
  const { muscleGroups, subGroups, exerciseLib } = data;

  const [expanded, setExpanded] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [newSubFor, setNewSubFor] = useState<string | null>(null);
  const [newSubVal, setNewSubVal] = useState("");
  const [renameSub, setRenameSub] = useState<{ group: string; sub: string } | null>(null);
  const [renameSubVal, setRenameSubVal] = useState("");
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const exoCountByGroup = useMemo(() => {
    const m: Record<string, number> = {};
    exerciseLib.forEach((l) => {
      m[l.muscleGroup] = (m[l.muscleGroup] || 0) + 1;
    });
    return m;
  }, [exerciseLib]);

  const subsFor = (g: string) => subGroups[g] || [];

  const add = async () => {
    const n = newName.trim();
    if (!n || muscleGroups.includes(n)) {
      haptic("warning");
      return;
    }
    await data.addMuscleGroup(n);
    setNewName("");
    setAddOpen(false);
    haptic("success");
  };

  const guardSeeds = async (group: string, action: string): Promise<boolean> => {
    const n = await data.seedCountInGroup(group);
    if (n > 0) {
      setBlockedMsg(`"${group}" contient ${n} exercice${n > 1 ? "s" : ""} de base (catalogue global) — ${action} impossible. Seuls les groupes sans exos de base sont modifiables.`);
      haptic("warning");
      return false;
    }
    return true;
  };

  const rename = async () => {
    const n = renameVal.trim();
    if (!n || !renameOpen || muscleGroups.includes(n)) {
      haptic("warning");
      return;
    }
    await data.renameMuscleGroup(renameOpen, n);
    setRenameOpen(null);
    setRenameVal("");
    haptic("success");
  };

  const del = async () => {
    if (!deleteOpen) return;
    await data.deleteMuscleGroup(deleteOpen);
    setDeleteOpen(null);
    haptic("success");
  };

  const addSub = async () => {
    const n = newSubVal.trim();
    if (!newSubFor || !n || subsFor(newSubFor).includes(n)) {
      haptic("warning");
      return;
    }
    await data.addSubGroup(newSubFor, n);
    setNewSubFor(null);
    setNewSubVal("");
    haptic("success");
  };

  const doRenameSub = async () => {
    const n = renameSubVal.trim();
    if (!renameSub || !n || (subsFor(renameSub.group).includes(n) && n !== renameSub.sub)) {
      haptic("warning");
      return;
    }
    await data.renameSubGroup(renameSub.group, renameSub.sub, n);
    setRenameSub(null);
    setRenameSubVal("");
    haptic("success");
  };

  return (
    <View>
      <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 10 }}>
        Groupes musculaires et leurs sous-groupes. Tape une ligne pour voir et éditer les sous-groupes.
      </Text>
      <View style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: R.md, overflow: "hidden", marginBottom: 10 }}>
        {muscleGroups.map((g, i) => {
          const isExpanded = expanded === g;
          const subs = subsFor(g);
          return (
            <View key={g} style={{ borderBottomWidth: i === muscleGroups.length - 1 ? 0 : 1, borderBottomColor: L.line }}>
              <Pressable
                onPress={() => setExpanded(isExpanded ? null : g)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 }}
              >
                <View style={{ backgroundColor: L.accentWash, borderRadius: 6, padding: 4, borderWidth: 1, borderColor: "rgba(252,76,2,.35)" }}>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={12} color={C.accentHi} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.ink0 }}>{g}</Text>
                  <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                    {exoCountByGroup[g] || 0} exo{(exoCountByGroup[g] || 0) > 1 ? "s" : ""}
                    {subs.length ? ` · ${subs.length} sous-groupe${subs.length > 1 ? "s" : ""}` : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    if (await guardSeeds(g, "renommage")) {
                      setRenameOpen(g);
                      setRenameVal(g);
                    }
                  }}
                  hitSlop={6}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="pencil" size={14} color={C.ink2} />
                </Pressable>
                <Pressable
                  onPress={async () => {
                    if (await guardSeeds(g, "suppression")) setDeleteOpen(g);
                  }}
                  hitSlop={6}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="trash-outline" size={14} color={C.danger} />
                </Pressable>
              </Pressable>

              {isExpanded && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 12, backgroundColor: C.bg3, borderTopWidth: 1, borderTopColor: L.line }}>
                  <Label style={{ paddingTop: 10, paddingBottom: 6 }}>Sous-groupes</Label>
                  {subs.length === 0 && (
                    <Text style={{ fontSize: 11, color: C.ink3, fontStyle: "italic", paddingVertical: 4 }}>Aucun sous-groupe pour ce muscle.</Text>
                  )}
                  {subs.map((sub) => (
                    <View
                      key={sub}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        backgroundColor: C.bg2,
                        borderRadius: 8,
                        marginBottom: 4,
                        minHeight: 44,
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: C.ink1 }}>{sub}</Text>
                      <Pressable
                        onPress={() => {
                          setRenameSub({ group: g, sub });
                          setRenameSubVal(sub);
                        }}
                        hitSlop={6}
                        style={{ padding: 6 }}
                      >
                        <Ionicons name="pencil" size={13} color={C.ink3} />
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          await data.deleteSubGroup(g, sub);
                          haptic("light");
                        }}
                        hitSlop={6}
                        style={{ padding: 6 }}
                      >
                        <Ionicons name="trash-outline" size={13} color={C.danger} />
                      </Pressable>
                    </View>
                  ))}
                  <Btn
                    kind="ghost"
                    sm
                    full
                    onPress={() => {
                      setNewSubFor(g);
                      setNewSubVal("");
                    }}
                    style={{ marginTop: 6 }}
                  >
                    ＋ Ajouter un sous-groupe
                  </Btn>
                </View>
              )}
            </View>
          );
        })}
      </View>
      <Btn full onPress={() => setAddOpen(true)}>
        ＋ Nouveau groupe
      </Btn>

      {/* Nouveau groupe */}
      <Sheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setNewName("");
        }}
        title="Nouveau groupe musculaire"
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={newName} onChangeText={setNewName} placeholder="Ex: Avant-bras" placeholderTextColor={C.ink3} autoFocus style={[inputStyle, { flex: 1 }]} />
          <Btn onPress={add}>Ajouter</Btn>
        </View>
      </Sheet>

      {/* Renommer le groupe */}
      <Sheet
        open={!!renameOpen}
        onClose={() => {
          setRenameOpen(null);
          setRenameVal("");
        }}
        title="Renommer le groupe"
      >
        <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 10 }}>
          {renameOpen ? `Renomme "${renameOpen}". Tous les exercices et cibles seront mis à jour.` : ""}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={renameVal} onChangeText={setRenameVal} autoFocus style={[inputStyle, { flex: 1 }]} />
          <Btn onPress={rename}>OK</Btn>
        </View>
      </Sheet>

      {/* Nouveau sous-groupe */}
      <Sheet
        open={!!newSubFor}
        onClose={() => {
          setNewSubFor(null);
          setNewSubVal("");
        }}
        title={newSubFor ? `Sous-groupe de ${newSubFor}` : "Sous-groupe"}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={newSubVal}
            onChangeText={setNewSubVal}
            placeholder="Ex: Trapèze supérieur"
            placeholderTextColor={C.ink3}
            autoFocus
            style={[inputStyle, { flex: 1 }]}
          />
          <Btn onPress={addSub}>Ajouter</Btn>
        </View>
      </Sheet>

      {/* Renommer le sous-groupe */}
      <Sheet
        open={!!renameSub}
        onClose={() => {
          setRenameSub(null);
          setRenameSubVal("");
        }}
        title="Renommer le sous-groupe"
      >
        <Text style={{ fontSize: 13, color: C.ink2, marginBottom: 10 }}>
          {renameSub ? `Renomme "${renameSub.sub}". Les exercices seront mis à jour.` : ""}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={renameSubVal} onChangeText={setRenameSubVal} autoFocus style={[inputStyle, { flex: 1 }]} />
          <Btn onPress={doRenameSub}>OK</Btn>
        </View>
      </Sheet>

      {/* Suppression du groupe */}
      <ConfirmSheet
        open={!!deleteOpen}
        onClose={() => setDeleteOpen(null)}
        onConfirm={del}
        title="Supprimer ce groupe ?"
        message={
          deleteOpen
            ? `"${deleteOpen}" sera supprimé. Les ${exoCountByGroup[deleteOpen] || 0} exercices de ce groupe seront déplacés vers "Autre", et ses sous-groupes supprimés.`
            : ""
        }
      />

      {/* Groupe verrouillé (exos seed) */}
      <Sheet open={!!blockedMsg} onClose={() => setBlockedMsg(null)} title="Groupe verrouillé">
        <Text style={{ fontSize: 14, color: C.ink1, lineHeight: 20, marginBottom: 16 }}>{blockedMsg}</Text>
        <Btn full onPress={() => setBlockedMsg(null)}>
          Compris
        </Btn>
      </Sheet>
    </View>
  );
}
