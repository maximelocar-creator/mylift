// Célébration PR plein écran — port fidèle de l'esprit LWBOverlay v40 :
// mise en scène en 4 temps (80/380/700/1100 ms, haptics), burst unique de
// 40 confettis (chute + dérive + rotation, jamais en boucle), mascotte
// Ronnie (asset extrait de la PWA) qui flotte, signature LIGHT WEIGHT BABY,
// héro poids géant. Tap n'importe où pour continuer.
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Modal, Image, useWindowDimensions, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { C, mono } from "../lib/theme";
import { haptic } from "../lib/haptics";
import type { Any } from "../core/mylift";

const CONFETTI_COLORS = ["#FC4C02", "#FF6B2C", "#FFC233", "#2FD27D", "#5CC8FF", "#FFDB66"];

/* Un confetto : chute unique avec dérive horizontale et rotation */
function Confetto({ piece, released, screenH }: { piece: Any; released: boolean; screenH: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (released) {
      p.value = withDelay(piece.delay * 1000, withTiming(1, { duration: piece.duration * 1000, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94) }));
    }
  }, [released]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.05, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [-40, screenH + 60]) },
      { translateX: interpolate(p.value, [0, 1], [0, piece.drift]) },
      { rotate: `${piece.rot + p.value * 540}deg` },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: 0,
          left: `${piece.left}%` as unknown as number,
          width: piece.size,
          height: piece.shape === 2 ? piece.size * 0.4 : piece.size,
          backgroundColor: piece.color,
          borderRadius: piece.shape === 0 ? piece.size / 2 : piece.shape === 1 ? 2 : 1,
        },
        style,
      ]}
    />
  );
}

/* Révélation étagée : fondu + remontée 14px (courbe iOS standard v40) */
function Reveal({ visible, delay = 0, style, children }: { visible: boolean; delay?: number; style?: ViewStyle; children: React.ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (visible) v.value = withDelay(delay, withTiming(1, { duration: 500, easing: Easing.bezier(0.32, 0.72, 0, 1) }));
  }, [visible]);
  const a = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: interpolate(v.value, [0, 1], [14, 0]) }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/* Mascotte flottante (float-up 3s alterné, port v40) */
function FloatingMascot({ glow }: { glow: string }) {
  const f = useSharedValue(0);
  useEffect(() => {
    f.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
        withTiming(0, { duration: 3000, easing: Easing.bezier(0.22, 1, 0.36, 1) })
      ),
      -1
    );
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(f.value, [0, 1], [0, -10]) }] }));
  return (
    <View style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
      {/* halo derrière la mascotte */}
      <View style={{ position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: glow, opacity: 0.3 }} />
      <Animated.View style={a}>
        <Image source={require("../../assets/mascot.png")} style={{ width: 124, height: 124 }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

export default function LWBOverlay({ pr, onClose }: { pr: Any | null; onClose: () => void }) {
  const { height: screenH } = useWindowDimensions();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!pr) return;
    setStep(0);
    haptic("success");
    const timers = [
      setTimeout(() => setStep(1), 80),
      setTimeout(() => setStep(2), 380),
      setTimeout(() => {
        setStep(3);
        haptic("medium");
      }, 700),
      setTimeout(() => setStep(4), 1100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [pr]);

  // Burst unique de 40 confettis (mêmes paramètres que la v40)
  const confetti = useMemo(() => {
    if (!pr) return [];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.35,
      duration: 2.2 + Math.random() * 1.4,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      drift: (Math.random() - 0.5) * 140,
      size: 5 + Math.random() * 6,
      rot: Math.random() * 360,
      shape: i % 3,
    }));
  }, [pr?.exName, pr?.weight, pr?.reps]);

  if (!pr) return null;

  const isAllTime = pr.type === "all-time";
  const typeLabel = isAllTime ? "NOUVEAU RECORD" : "RECORD DE REPS";
  const kickerColor = isAllTime ? C.gold : C.accentHi;
  const glow = isAllTime ? "rgba(255,194,51,.5)" : "rgba(252,76,2,.5)";

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: C.bg0, overflow: "hidden" }}>
        {/* Glow supérieur (couleur selon type de PR) */}
        <Reveal visible={step >= 1} style={{ position: "absolute", top: -220, alignSelf: "center" }}>
          <View style={{ width: 560, height: 420, borderRadius: 280, backgroundColor: isAllTime ? "rgba(255,194,51,.14)" : "rgba(252,76,2,.14)" }} />
        </Reveal>

        {/* Confettis */}
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 }}>
          {confetti.map((c) => (
            <Confetto key={c.id} piece={c} released={step >= 1} screenH={screenH} />
          ))}
        </View>

        {/* Contenu central */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, zIndex: 3 }}>
          <Reveal visible={step >= 1} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: kickerColor }} />
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 3, color: kickerColor }}>{typeLabel}</Text>
          </Reveal>

          <Reveal visible={step >= 1} delay={60}>
            <FloatingMascot glow={glow} />
          </Reveal>

          {/* Signature — sans guillemets, uppercase, gold → coral (ombre) */}
          <Reveal visible={step >= 2}>
            <Text
              style={{
                fontSize: 30,
                fontWeight: "900",
                letterSpacing: -0.9,
                textTransform: "uppercase",
                textAlign: "center",
                color: C.gold,
                textShadowColor: "rgba(252,76,2,.65)",
                textShadowOffset: { width: 0, height: 3 },
                textShadowRadius: 10,
                marginBottom: 26,
              }}
            >
              Light weight baby
            </Text>
          </Reveal>

          {/* Héro poids */}
          <Reveal visible={step >= 2} delay={80} style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 6 }}>
            <Text style={[mono, { fontSize: 88, fontWeight: "900", letterSpacing: -5, lineHeight: 90, color: C.ink0 }]}>{pr.weight}</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: C.ink2, marginLeft: 8 }}>kg</Text>
          </Reveal>
          <Reveal visible={step >= 2} delay={140}>
            <Text style={{ fontSize: 15, color: C.ink2, fontWeight: "500", marginBottom: 26 }}>
              {pr.reps} rep{pr.reps > 1 ? "s" : ""}
            </Text>
          </Reveal>

          {/* Badge exo */}
          <Reveal visible={step >= 3}>
            <View
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,.12)",
              }}
            >
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink1 }}>
                {pr.exName}
              </Text>
            </View>
          </Reveal>
        </View>

        <Reveal visible={step >= 4} style={{ position: "absolute", bottom: 56, alignSelf: "center" }}>
          <Text style={{ color: C.ink3, fontSize: 13, fontWeight: "600" }}>Tape pour continuer</Text>
        </Reveal>
      </Pressable>
    </Modal>
  );
}
