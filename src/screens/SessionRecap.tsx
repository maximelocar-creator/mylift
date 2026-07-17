// Récap post-séance plein écran (version RN du SessionRecapFull v40) :
// kicker ✓, hero tonnage, KPIs secondaires, célébration PR, volume par muscle.
import { View, Text, Pressable, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, mono } from "../lib/theme";
import { tonnageSession, setsCountSession, exoMuscleGroup, isValidSet, type Any } from "../core/mylift";
import { formatNum, formatDur } from "../lib/format";
import { useData } from "../lib/store";
import { Btn, LINE } from "../ui/kit";

export default function SessionRecap({ log, onClose }: { log: Any; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { exerciseLib } = useData();
  const ton = tonnageSession(log);
  const sets = setsCountSession(log);
  const prs = log.prs || [];

  // Volume (séries validées) par muscle
  const byMuscle: Record<string, number> = {};
  (log.exercises || []).forEach((ex: Any) => {
    const n = (ex.sets || []).filter(isValidSet).length;
    if (!n) return;
    const g = exoMuscleGroup(ex, exerciseLib);
    byMuscle[g] = (byMuscle[g] || 0) + n;
  });
  const muscles = Object.entries(byMuscle).sort((a, b) => b[1] - a[1]);
  const maxSets = muscles.length ? muscles[0][1] : 1;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg0 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 50, paddingBottom: 140, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.success, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#062", fontSize: 11, fontWeight: "900" }}>✓</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", color: C.success }}>Séance terminée</Text>
          </View>
          <Text style={{ fontSize: 34, fontWeight: "900", letterSpacing: -1, color: C.ink0, textAlign: "center" }}>{log.sessionName || "Séance"}</Text>
          <Text style={{ fontSize: 14, color: C.ink2, marginBottom: 32 }}>{log.programName || ""}</Text>

          {/* Hero : tonnage */}
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase", color: C.ink3, marginBottom: 10 }}>
            Tonnage total
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 36 }}>
            <Text style={[mono, { fontSize: 80, fontWeight: "900", letterSpacing: -3, color: C.ink0, lineHeight: 82 }]}>
              {formatNum(ton / 1000, 1)}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: C.ink2, marginLeft: 8 }}>t</Text>
          </View>

          {/* KPIs secondaires */}
          <View style={{ flexDirection: "row", gap: 8, width: "100%", marginBottom: 24 }}>
            {[
              { label: "Durée", val: formatDur(log.durationSec || 0) },
              { label: "Séries", val: String(sets) },
              { label: "Exos", val: String((log.exercises || []).length) },
            ].map((k) => (
              <View key={k.label} style={{ flex: 1, padding: 16, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16, alignItems: "center" }}>
                <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.ink3, marginBottom: 6 }}>{k.label}</Text>
                <Text style={[mono, { fontSize: 22, fontWeight: "800", color: C.ink0 }]}>{k.val}</Text>
              </View>
            ))}
          </View>

          {/* PRs */}
          {prs.length > 0 && (
            <View
              style={{
                width: "100%",
                padding: 18,
                borderRadius: 22,
                backgroundColor: "rgba(255,194,51,.1)",
                borderWidth: 1,
                borderColor: "rgba(255,194,51,.4)",
                marginBottom: 24,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 18 }}>🏆</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase", color: C.gold }}>
                    {prs.length} record{prs.length > 1 ? "s" : ""} personnel{prs.length > 1 ? "s" : ""}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: C.ink0, marginTop: 2 }}>Nouvelle référence.</Text>
                </View>
              </View>
              {prs.map((pr: Any, i: number) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,194,51,.15)" }}>
                  <Text numberOfLines={1} style={{ fontWeight: "600", color: C.ink1, fontSize: 13, flex: 1, marginRight: 10 }}>
                    {pr.type === "all-time" ? "🥇 " : "🔁 "}
                    {pr.exName}
                  </Text>
                  <Text style={[mono, { fontWeight: "800", color: C.gold, fontSize: 14 }]}>
                    {pr.weight} kg × {pr.reps}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Volume par muscle */}
          {muscles.length > 0 && (
            <View style={{ width: "100%", marginBottom: 28 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase", color: C.ink3 }}>Volume par muscle</Text>
                <Text style={[mono, { fontSize: 11, color: C.ink2 }]}>{sets} séries</Text>
              </View>
              {muscles.map(([g, n]) => (
                <View key={g} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
                  <Text numberOfLines={1} style={{ width: 90, fontSize: 12, fontWeight: "600", color: C.ink1 }}>
                    {g}
                  </Text>
                  <View style={{ flex: 1, height: 8, backgroundColor: C.bg3, borderRadius: 4, overflow: "hidden" }}>
                    <View style={{ width: `${(n / maxSets) * 100}%`, height: "100%", backgroundColor: C.accent, borderRadius: 4 }} />
                  </View>
                  <Text style={[mono, { width: 36, textAlign: "right", fontSize: 12, fontWeight: "700", color: C.ink0 }]}>{n}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: insets.bottom + 20, backgroundColor: C.bg0 }}>
          <Btn full onPress={onClose}>
            Continuer
          </Btn>
        </View>
      </View>
    </Modal>
  );
}
