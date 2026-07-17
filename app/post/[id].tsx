// Détail d'un post — même rendu que dans le feed (PostCard partagé, mode detail).
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import * as social from "@/db/social";
import { PostCard } from "@/ui/PostCard";
import { Skeleton } from "@/ui/kit";
import type { Any } from "@/core/mylift";

export default function PostDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    social
      .fetchPost(String(id))
      .then((p) => (p ? setPost(p) : setError("Post introuvable ou non visible.")))
      .catch((e) => setError(e?.message ?? String(e)));
  }, [id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
        <Ionicons name="chevron-back" size={16} color={C.ink2} />
        <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Retour</Text>
      </Pressable>
      {error && <Text style={{ color: C.ink3, textAlign: "center", padding: 24 }}>{error}</Text>}
      {!post && !error && <Skeleton height={320} radius={16} />}
      {post && <PostCard post={post} detail onOpenUser={(uid) => router.push(`/user/${uid}`)} />}
    </ScrollView>
  );
}
