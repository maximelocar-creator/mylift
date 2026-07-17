// Carte de post — UNIQUE implémentation, partagée par le feed, les profils
// (le sien et celui d'un ami) et le détail. Ordre décidé par Maxime : PHOTO
// D'ABORD, chiffres dessous, puis titre/texte. Sans photo, les chiffres/PR
// prennent la vedette (la carte ne doit pas paraître vide).
// CONFIDENTIALITÉ : lift_ref ne contient jamais de nom de machine
// (exercise_models) — seuls exName/weight/reps/prType sont rendus.
import { View, Text, Pressable, Image, useWindowDimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { C, L, MOTION, mono } from "../lib/theme";
import { formatRelative, formatDur, formatNum } from "../lib/format";
import { Avatar } from "./Avatar";
import { Chip } from "./kit";
import type { Any } from "../core/mylift";

export function PostCard({
  post,
  index = 0,
  onOpenUser,
  onOpen,
  detail = false,
}: {
  post: Any;
  index?: number;
  onOpenUser?: (id: string) => void;
  onOpen?: () => void;
  detail?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isLift = post.type === "lift";
  const lift = post.lift_ref;
  const stats = post.lift_ref?.stats; // pour les posts séance : {durationSec, tonnage, prs}

  const body = (
    <View
      style={{
        backgroundColor: C.bg2,
        borderWidth: 1,
        borderColor: isLift ? "rgba(255,194,51,.25)" : L.line,
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 10,
      }}
    >
      {/* En-tête auteur */}
      <Pressable
        onPress={onOpenUser ? () => onOpenUser(post.owner_id) : undefined}
        disabled={!onOpenUser}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 10 }}
      >
        <Avatar profile={post.profile} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: C.ink0 }}>
            @{post.profile?.username ?? "?"}
          </Text>
          <Text style={{ fontSize: 10.5, color: C.ink3, marginTop: 1 }}>{formatRelative(post.created_at?.slice(0, 10))}</Text>
        </View>
        <Chip tone={isLift ? "gold" : undefined}>{isLift ? "🏆 Lift" : "Séance"}</Chip>
      </Pressable>

      {/* PHOTO D'ABORD (décision Maxime) */}
      {!!post.image_url && (
        <Image
          source={{ uri: post.image_url }}
          style={{ width: "100%", height: detail ? Math.min(width, 480) : 260, backgroundColor: C.bg3 }}
          resizeMode="cover"
        />
      )}

      {/* Chiffres dessous */}
      <View style={{ padding: 14, paddingTop: post.image_url ? 12 : 4 }}>
        {isLift && !!lift && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 8,
              paddingVertical: post.image_url ? 0 : 8,
              marginBottom: 8,
            }}
          >
            <Text style={[mono, { fontSize: post.image_url ? 18 : 26, fontWeight: "900", color: C.gold, letterSpacing: -0.5 }]}>
              {lift.weight} kg × {lift.reps}
            </Text>
            <Text style={{ fontSize: 12, color: C.ink2, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
              {lift.exName}
            </Text>
            {!!lift.prType && (
              <Text style={{ fontSize: 10, fontWeight: "800", color: C.gold, textTransform: "uppercase", letterSpacing: 0.8 }}>
                {lift.prType === "all-time" ? "PR all-time" : "rep PR"}
              </Text>
            )}
          </View>
        )}
        {!isLift && !!stats && (
          <View style={{ flexDirection: "row", gap: 14, marginBottom: 8, paddingVertical: post.image_url ? 0 : 6 }}>
            {!!stats.durationSec && (
              <Text style={[mono, { fontSize: 13, fontWeight: "700", color: C.ink1 }]}>
                ⏱ {formatDur(stats.durationSec)}
              </Text>
            )}
            {!!stats.tonnage && (
              <Text style={[mono, { fontSize: 13, fontWeight: "700", color: C.ink1 }]}>
                {formatNum(stats.tonnage / 1000, 1)} t
              </Text>
            )}
            {!!stats.prs && stats.prs > 0 && (
              <Text style={[mono, { fontSize: 13, fontWeight: "800", color: C.gold }]}>🏆 {stats.prs} PR{stats.prs > 1 ? "s" : ""}</Text>
            )}
          </View>
        )}

        {!isLift && (post.lift_ref?.prList?.length ?? 0) > 0 && (
          <View style={{ marginBottom: 8, gap: 3 }}>
            {post.lift_ref.prList.slice(0, 4).map((pr: Any, i: number) => (
              <Text key={i} style={[mono, { fontSize: 12.5, fontWeight: "800", color: C.gold }]}>
                🏆 {pr.exName} · {pr.weight}×{pr.reps}
                {pr.type === "all-time" ? " · all-time" : pr.type === "rep" ? " · rep PR" : ""}
              </Text>
            ))}
          </View>
        )}

        {/* Titre / texte */}
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink0, lineHeight: 20 }}>{post.title}</Text>
        {!!post.text && (
          <Text numberOfLines={detail ? undefined : 4} style={{ fontSize: 13, color: C.ink1, marginTop: 6, lineHeight: 18 }}>
            {post.text}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 300)).duration(MOTION.view)}>
      {onOpen ? <Pressable onPress={onOpen}>{body}</Pressable> : body}
    </Animated.View>
  );
}
