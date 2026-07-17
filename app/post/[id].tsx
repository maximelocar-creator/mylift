// Détail d'un post — même rendu que dans le feed (PostCard partagé, mode
// detail) + section commentaires (Phase 4) : liste chronologique, saisie ≤500
// caractères, suppression de son propre commentaire uniquement (la RLS
// n'autorise pas la modération par le owner du post — sondé en prod).
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, L, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import { haptic } from "@/lib/haptics";
import * as social from "@/db/social";
import { PostCard } from "@/ui/PostCard";
import { Skeleton, ConfirmSheet } from "@/ui/kit";
import { Avatar } from "@/ui/Avatar";
import { formatRelative } from "@/lib/format";
import type { Any } from "@/core/mylift";

export default function PostDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useData();
  const [post, setPost] = useState<Any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Any[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Any | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadComments = useCallback(async () => {
    try {
      setComments(await social.fetchComments(String(id)));
    } catch {
      setComments([]);
    }
  }, [id]);

  useEffect(() => {
    social
      .fetchPost(String(id), userId ?? undefined)
      .then((p) => (p ? setPost(p) : setError("Post introuvable ou non visible.")))
      .catch((e) => setError(e?.message ?? String(e)));
    loadComments();
  }, [id]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    try {
      const row = await social.addComment(String(id), userId, text);
      setDraft("");
      haptic("light");
      // Affichage immédiat, puis refresh serveur (profil joint)
      setComments((cur) => [...(cur ?? []), { ...row, created_at: new Date().toISOString(), profile: null }]);
      loadComments();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      haptic("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg0 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
          <Ionicons name="chevron-back" size={16} color={C.ink2} />
          <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Retour</Text>
        </Pressable>
        {error && <Text style={{ color: C.ink3, textAlign: "center", padding: 24 }}>{error}</Text>}
        {!post && !error && <Skeleton height={320} radius={16} />}
        {post && <PostCard post={post} detail onOpenUser={(uid) => router.push(`/user/${uid}`)} />}

        {/* Commentaires */}
        {post && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: C.ink2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Commentaires{comments && comments.length > 0 ? ` · ${comments.length}` : ""}
            </Text>
            {comments === null && <Skeleton height={60} radius={12} />}
            {comments !== null && comments.length === 0 && (
              <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center", padding: 16 }}>Aucun commentaire. Lance la discussion 👇</Text>
            )}
            <View style={{ gap: 8 }}>
              {(comments ?? []).map((c: Any) => {
                const mine = c.user_id === userId;
                return (
                  <View key={c.id} style={{ flexDirection: "row", gap: 10, padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 14 }}>
                    <Pressable onPress={() => !mine && router.push(`/user/${c.user_id}`)} disabled={mine}>
                      <Avatar profile={c.profile} size={30} />
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "800", color: C.ink0, flexShrink: 1 }}>
                          @{c.profile?.username ?? (mine ? "moi" : "?")}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: C.ink3 }}>{formatRelative(String(c.created_at ?? "").slice(0, 10))}</Text>
                      </View>
                      <Text style={{ fontSize: 13.5, color: C.ink1, marginTop: 3, lineHeight: 19 }}>{c.text}</Text>
                    </View>
                    {mine && (
                      <Pressable onPress={() => setDeleteTarget(c)} hitSlop={8} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={15} color={C.ink3} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Saisie — reste au-dessus du clavier (KAV padding) */}
      {post && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            borderTopWidth: 1,
            borderTopColor: L.line,
            backgroundColor: C.bg0,
          }}
        >
          <View style={{ flex: 1 }}>
            <TextInput
              value={draft}
              onChangeText={(t) => setDraft(t.slice(0, 500))}
              placeholder="Ajouter un commentaire…"
              placeholderTextColor={C.ink3}
              multiline
              style={{
                backgroundColor: "rgba(255,255,255,.04)",
                borderWidth: 1,
                borderColor: L.line,
                borderRadius: 14,
                color: C.ink0,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                maxHeight: 110,
              }}
            />
            {draft.length > 400 && (
              <Text style={[mono, { fontSize: 10, color: draft.length >= 500 ? C.danger : C.ink3, textAlign: "right", marginTop: 3 }]}>
                {draft.length}/500
              </Text>
            )}
          </View>
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: draft.trim() ? C.accent : C.bg3,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 1,
            }}
          >
            <Ionicons name="arrow-up" size={19} color={draft.trim() ? "#fff" : C.ink3} />
          </Pressable>
        </View>
      )}

      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const t = deleteTarget;
          setDeleteTarget(null);
          if (!t) return;
          try {
            await social.deleteComment(t.id);
            haptic("light");
            loadComments();
          } catch {}
        }}
        title="Supprimer ce commentaire ?"
        message="Cette action est définitive."
        confirmLabel="Supprimer"
      />
    </KeyboardAvoidingView>
  );
}
