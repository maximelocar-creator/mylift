// Recherche d'utilisateurs par username — cartes profil publiques minimales
// (jamais de données d'entraînement) + bouton Ajouter (demande d'ami).
import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, L } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { useData } from "@/lib/store";
import { useSocial } from "@/lib/social";
import * as social from "@/db/social";
import { Btn } from "@/ui/kit";
import { Avatar } from "@/ui/Avatar";
import type { Any } from "@/core/mylift";

export default function Search() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useData();
  const { outgoing, refreshSocial } = useSocial();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Any[]>([]);
  const [searching, setSearching] = useState(false);
  const [followStates, setFollowStates] = useState<Record<string, string>>({}); // id → 'none'|'pending'|'accepted'
  const [suggestions, setSuggestions] = useState<Any[] | null>(null); // null = RPC absente → section masquée
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suggestions par amis en commun (RPC serveur — voir supabase/friend_suggestions.sql)
  useEffect(() => {
    if (!userId) return;
    social.fetchFriendSuggestions(userId).then(setSuggestions).catch(() => setSuggestions(null));
  }, [userId]);

  const runSearch = async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await social.searchProfiles(query.trim(), userId!);
      setResults(rows);
      // état de follow pour chaque résultat
      const states: Record<string, string> = {};
      await Promise.all(
        rows.map(async (r) => {
          states[r.id] = await social.fetchFriendState(userId!, r.id);
        })
      );
      setFollowStates(states);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(q), 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  const toggleFriend = async (otherId: string) => {
    const cur = followStates[otherId] || "none";
    try {
      if (cur === "none" || cur === "pending_received") {
        const next = await social.sendFriendRequest(userId!, otherId);
        setFollowStates({ ...followStates, [otherId]: next });
        haptic("success");
      } else if (cur === "pending_sent") {
        setFollowStates({ ...followStates, [otherId]: "none" });
        await social.cancelFriendRequest(userId!, otherId);
        haptic("light");
      }
      refreshSocial();
    } catch {
      setFollowStates({ ...followStates, [otherId]: cur });
      haptic("error");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, minHeight: 44 }}>
          <Ionicons name="chevron-back" size={16} color={C.ink2} />
          <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Retour</Text>
        </Pressable>
        <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0, marginBottom: 16 }}>Recherche.</Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: L.line,
            borderRadius: 12,
            paddingHorizontal: 14,
            marginBottom: 14,
          }}
        >
          <Ionicons name="search" size={16} color={C.ink3} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Username…"
            placeholderTextColor={C.ink3}
            autoCapitalize="none"
            autoFocus
            style={{ flex: 1, color: C.ink0, paddingVertical: 12, fontSize: 15 }}
          />
          {searching && <ActivityIndicator size="small" color={C.ink3} />}
        </View>

        {q.trim().length < 2 && suggestions !== null && suggestions.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: C.ink2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Suggestions
            </Text>
            <View style={{ gap: 6 }}>
              {suggestions.map((sug) => {
                const st = followStates[sug.id] || "none";
                return (
                  <View
                    key={sug.id}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16 }}
                  >
                    <Pressable onPress={() => router.push(`/user/${sug.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <Avatar profile={sug.profile} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>
                          @{sug.profile.username}
                        </Text>
                        <Text style={{ fontSize: 11, color: C.ink3, marginTop: 1 }}>
                          {sug.mutual} ami{sug.mutual > 1 ? "s" : ""} en commun{sug.profile.ville ? ` · ${sug.profile.ville}` : ""}
                        </Text>
                      </View>
                    </Pressable>
                    <Btn kind={st === "pending_sent" ? "ghost" : "primary"} sm disabled={st === "pending_sent"} onPress={() => toggleFriend(sug.id)}>
                      {st === "pending_sent" ? "Demandé" : "Suivre"}
                    </Btn>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {q.trim().length < 2 && (suggestions === null || suggestions.length === 0) && (
          <View style={{ alignItems: "center", padding: 32, gap: 8 }}>
            <Text style={{ fontSize: 36 }}>👥</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink1 }}>Trouve tes amis</Text>
            <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center", lineHeight: 18 }}>
              Cherche un username, ou fais-toi scanner : ton QR code est sur ton profil.
            </Text>
          </View>
        )}

        {q.trim().length >= 2 && !searching && results.length === 0 && (
          <Text style={{ color: C.ink3, textAlign: "center", padding: 24 }}>Aucun utilisateur pour « {q.trim()} »</Text>
        )}

        <View style={{ gap: 6 }}>
          {results.map((r) => {
            const st = followStates[r.id] || "none";
            return (
              <View
                key={r.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16 }}
              >
                <Pressable onPress={() => router.push(`/user/${r.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <Avatar profile={r} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>
                      @{r.username}
                    </Text>
                    {!!r.ville && <Text style={{ fontSize: 11, color: C.ink3, marginTop: 1 }}>{r.ville}</Text>}
                  </View>
                </Pressable>
                {st === "friends" ? (
                  <View style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: C.success }}>Amis ✓</Text>
                  </View>
                ) : (
                  <Btn kind={st === "pending_sent" ? "ghost" : "primary"} sm onPress={() => toggleFriend(r.id)}>
                    {st === "pending_sent" ? "Demandé" : st === "pending_received" ? "Accepter" : "Ajouter"}
                  </Btn>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
