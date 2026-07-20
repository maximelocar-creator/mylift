// Carte de post — UNIQUE implémentation, partagée par le feed, les profils
// (le sien et celui d'un ami) et le détail. Ordre décidé par Maxime : PHOTO
// D'ABORD, chiffres dessous, puis titre/texte. Sans photo, les chiffres/PR
// prennent la vedette (la carte ne doit pas paraître vide).
// CONFIDENTIALITÉ : lift_ref ne contient jamais de nom de machine
// (exercise_models) — seuls exName/weight/reps/prType sont rendus.
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Image, useWindowDimensions } from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, withDelay, interpolate, Easing } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { C, L, MOTION, mono } from "../lib/theme";
import { formatRelative, formatDur, formatNum } from "../lib/format";
import { haptic } from "../lib/haptics";
import { useData } from "../lib/store";
import * as social from "../db/social";
import { Avatar } from "./Avatar";
import { Chip } from "./kit";
import type { Any } from "../core/mylift";

/** État de like partagé entre la rangée sociale et le double-tap photo.
 *  Optimistic + rollback ; un like n'est visible que si le post l'est
 *  (RLS directionnelle intouchée). */
function useLikeState(post: Any) {
  const { userId } = useData();
  const [liked, setLiked] = useState<boolean>(!!post.liked_by_me);
  const [count, setCount] = useState<number>(post.like_count || 0);
  const busy = useRef(false);
  useEffect(() => {
    setLiked(!!post.liked_by_me);
    setCount(post.like_count || 0);
  }, [post.id, post.liked_by_me, post.like_count]);

  const toggle = async (onlyLike = false) => {
    if (!userId || busy.current) return;
    if (onlyLike && liked) return; // double-tap : ne délike jamais
    busy.current = true;
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    haptic("light");
    try {
      await social.setLiked(post.id, userId, next);
    } catch {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      haptic("error");
    } finally {
      busy.current = false;
    }
  };
  return { liked, count, toggle };
}

function SocialRow({ post, like, onOpen }: { post: Any; like: ReturnType<typeof useLikeState>; onOpen?: () => void }) {
  const { liked, count, toggle } = like;
  // Pop du cœur à chaque like (spring signature press-btn)
  const pop = useSharedValue(1);
  const prevLiked = useRef(liked);
  useEffect(() => {
    if (liked && !prevLiked.current) {
      pop.value = withSequence(withSpring(1.35, MOTION.microSpring), withSpring(1, MOTION.microSpring));
    }
    prevLiked.current = liked;
  }, [liked]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 10 }}>
      <Pressable onPress={() => toggle()} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32 }}>
        <Animated.View style={popStyle}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? C.accent : C.ink2} />
        </Animated.View>
        {count > 0 && <Text style={[mono, { fontSize: 12.5, fontWeight: "700", color: liked ? C.accent : C.ink2 }]}>{count}</Text>}
      </Pressable>
      <Pressable onPress={onOpen} disabled={!onOpen} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32 }}>
        <Ionicons name="chatbubble-outline" size={18} color={C.ink2} />
        {(post.comment_count || 0) > 0 && <Text style={[mono, { fontSize: 12.5, fontWeight: "700", color: C.ink2 }]}>{post.comment_count}</Text>}
      </Pressable>
    </View>
  );
}

/** Cœur qui éclate au centre de la carte (double-tap, façon Instagram) :
 *  apparition rapide avec léger dépassement, brève tenue, disparition nette. */
function HeartBurst({ trigger }: { trigger: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (trigger > 0) {
      v.value = 0;
      v.value = withSequence(
        withTiming(1, { duration: 130, easing: Easing.out(Easing.back(2)) }),
        withDelay(110, withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) }))
      );
    }
  }, [trigger]);
  const a = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.25, 1], [0, 1, 1]),
    transform: [{ scale: interpolate(v.value, [0, 1], [0.3, 1]) }],
  }));
  if (trigger === 0) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 5 }, a]}>
      <Ionicons name="heart" size={92} color="#fff" style={{ textShadowColor: "rgba(0,0,0,.45)", textShadowRadius: 16, textShadowOffset: { width: 0, height: 2 } }} />
    </Animated.View>
  );
}

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
  const like = useLikeState(post);
  const [burst, setBurst] = useState(0);
  // UN SEUL point de tap au niveau carte (avec ou sans photo) : simple tap
  // ouvre le post (différé pour laisser sa chance au double), double-tap like
  // (jamais délike) + cœur qui éclate. Fini le double-open (plus de Pressable
  // parent qui ouvrait en plus du tap photo).
  const lastTap = useRef(0);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCardTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 260) {
      lastTap.current = 0;
      if (openTimer.current) {
        clearTimeout(openTimer.current);
        openTimer.current = null;
      }
      like.toggle(true);
      setBurst((b) => b + 1);
      haptic("medium");
    } else {
      lastTap.current = now;
      if (onOpen) {
        if (openTimer.current) clearTimeout(openTimer.current);
        openTimer.current = setTimeout(() => {
          openTimer.current = null;
          onOpen();
        }, 260);
      }
    }
  };

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
        <Chip tone={isLift ? "gold" : undefined}>{isLift ? "Lift" : "Séance"}</Chip>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 8, paddingVertical: post.image_url ? 0 : 6 }}>
            {!!stats.durationSec && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="time-outline" size={13} color={C.ink2} />
                <Text style={[mono, { fontSize: 13, fontWeight: "700", color: C.ink1 }]}>{formatDur(stats.durationSec)}</Text>
              </View>
            )}
            {!!stats.tonnage && (
              <Text style={[mono, { fontSize: 13, fontWeight: "700", color: C.ink1 }]}>{formatNum(stats.tonnage / 1000, 1)} t</Text>
            )}
            {!!stats.prs && stats.prs > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="trophy" size={13} color={C.gold} />
                <Text style={[mono, { fontSize: 13, fontWeight: "800", color: C.gold }]}>
                  {stats.prs} PR{stats.prs > 1 ? "s" : ""}
                </Text>
              </View>
            )}
          </View>
        )}

        {!isLift && (post.lift_ref?.prList?.length ?? 0) > 0 && (
          <View style={{ marginBottom: 8, gap: 4 }}>
            {post.lift_ref.prList.slice(0, 4).map((pr: Any, i: number) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="trophy" size={12} color={C.gold} />
                <Text style={[mono, { fontSize: 12.5, fontWeight: "800", color: C.gold }]}>
                  {pr.exName} · {pr.weight}×{pr.reps}
                  {pr.type === "all-time" ? " · all-time" : pr.type === "rep" ? " · rep PR" : ""}
                </Text>
              </View>
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

        <SocialRow post={post} like={like} onOpen={onOpen} />
      </View>

      {/* Cœur de double-tap — couvre toute la carte (posts avec ou sans photo) */}
      <HeartBurst trigger={burst} />
    </View>
  );

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 300)).duration(MOTION.view)}>
      {onOpen ? <Pressable onPress={handleCardTap}>{body}</Pressable> : body}
    </Animated.View>
  );
}
