// Kit UI — composants de base mappés sur les tokens DA v40 (src/lib/theme.ts).
// Sheets iOS natives (spring physique + drag-to-dismiss rubber-band via
// Reanimated/Gesture Handler), boutons, chips, labels, skeletons, statut sync.
import { ReactNode, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, ViewStyle, TextStyle, useWindowDimensions, KeyboardAvoidingView, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { C, R, L, MOTION, mono } from "../lib/theme";
import { haptic } from "../lib/haptics";
import { useData } from "../lib/store";

/**
 * Enchaîner deux sheets : sur iOS, présenter une Modal pendant qu'une autre
 * joue son animation de fermeture échoue silencieusement. Ferme d'abord,
 * puis ouvre après la fin de l'animation de sortie.
 */
export function afterSheetClose(fn: () => void) {
  setTimeout(fn, MOTION.local + 120);
}

// Ré-exports de compat (les écrans importent ces noms depuis le kit)
export const LINE = L.line;
export const LINE_STRONG = L.lineStrong;
export const ACCENT_WASH = L.accentWash;
export const GOLD_WASH = L.goldWash;
export const SUCCESS_WASH = L.successWash;
export const BG_HOVER = L.bgHover;
export const INK4 = L.ink4;

/* ------------------------------------------------------------------ */
export function Card({ children, style, feat }: { children: ReactNode; style?: ViewStyle; feat?: boolean }) {
  return (
    <View
      style={[
        {
          backgroundColor: feat ? "#141020" : C.bg2,
          borderWidth: 1,
          borderColor: feat ? L.accentGlow : L.line,
          borderRadius: R.md,
          padding: 16,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return (
    <Text style={[{ fontSize: 10.5, fontWeight: "700", letterSpacing: 1.3, textTransform: "uppercase", color: C.ink3 }, style]}>{children}</Text>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 18, paddingBottom: 10, paddingHorizontal: 4 }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
      <Label>{children}</Label>
      {right != null && <Text style={{ marginLeft: "auto", fontSize: 11, fontWeight: "600", color: C.ink3 }}>{right}</Text>}
    </View>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: "primary" | "gold" | "success" }) {
  const bg = tone === "primary" ? L.accentWash : tone === "gold" ? L.goldWash : tone === "success" ? L.successWash : C.bg3;
  const color = tone === "primary" ? C.accentHi : tone === "gold" ? C.gold : tone === "success" ? C.success : C.ink2;
  return (
    <View
      style={{
        minHeight: 24,
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: bg,
        alignSelf: "flex-start",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "600", color, lineHeight: 14, textAlign: "center" }}>{children}</Text>
    </View>
  );
}

/* Bouton avec press state animé (scale léger, signature press-btn v40) */
export function Btn({
  children,
  onPress,
  kind = "primary",
  sm,
  full,
  disabled,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  kind?: "primary" | "ghost" | "gold" | "danger";
  sm?: boolean;
  full?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const bg = kind === "primary" ? C.accent : kind === "gold" ? C.gold : kind === "danger" ? C.danger : "rgba(255,255,255,.07)";
  const color = kind === "gold" ? "#2A1800" : kind === "ghost" ? C.ink1 : "#fff";
  // Styles de LAYOUT → wrapper animé (sinon flex:1 sur le Pressable interne ne
  // s'applique pas et les boutons des sheets s'alignent à gauche)
  const st = (style || {}) as Record<string, any>;
  const layoutKeys = ["flex", "alignSelf", "minWidth", "maxWidth", "width", "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical"];
  const wrapperStyle: Record<string, any> = {};
  const innerStyle: Record<string, any> = {};
  Object.entries(st).forEach(([k, v]) => {
    if (layoutKeys.includes(k)) wrapperStyle[k] = v;
    else innerStyle[k] = v;
  });
  return (
    <Animated.View style={[aStyle, full ? { alignSelf: "stretch" } : undefined, wrapperStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.975, MOTION.microSpring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, MOTION.microSpring);
        }}
        style={[
          {
            backgroundColor: bg,
            borderRadius: sm ? 10 : R.sm,
            paddingVertical: sm ? 8 : 12,
            paddingHorizontal: sm ? 12 : 16,
            minHeight: sm ? 36 : 44,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 6,
            opacity: disabled ? 0.45 : 1,
          },
          innerStyle,
        ]}
      >
        <Text style={{ color, fontSize: sm ? 12.5 : 14, fontWeight: "700", letterSpacing: -0.1 }}>{children}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet — bottom sheet iOS : entrée/sortie en spring physique,        */
/* drag-to-dismiss avec rubber-band vers le haut (port du CSS v40).    */
/* ------------------------------------------------------------------ */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string | null; children: ReactNode }) {
  const { height: winH } = useWindowDimensions();
  const translateY = useSharedValue(winH);
  const backdrop = useSharedValue(0);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      translateY.value = winH * 0.6;
      translateY.value = withSpring(0, MOTION.sheetSpring);
      backdrop.value = withTiming(1, { duration: MOTION.local });
    } else if (visible) {
      backdrop.value = withTiming(0, { duration: MOTION.local, easing: Easing.in(Easing.quad) });
      translateY.value = withTiming(winH * 0.6, { duration: MOTION.local, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }
  }, [open]);

  const requestClose = () => onClose();

  const pan = Gesture.Pan()
    .onChange((e) => {
      const dy = translateY.value + e.changeY;
      // Vers le bas : suit le doigt. Vers le haut : rubber-band (résistance).
      translateY.value = dy >= 0 ? dy : dy * MOTION.rubberBand;
    })
    .onEnd((e) => {
      if (translateY.value > MOTION.dismissDistance || e.velocityY > MOTION.dismissVelocity) {
        translateY.value = withTiming(winH * 0.6, { duration: MOTION.local, easing: Easing.in(Easing.quad) });
        backdrop.value = withTiming(0, { duration: MOTION.local });
        runOnJS(requestClose)();
      } else {
        translateY.value = withSpring(0, MOTION.sheetSpring);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!visible && !open) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
      <Animated.View style={[{ flex: 1, backgroundColor: "rgba(0,0,0,.55)" }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: C.bg2,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: L.line,
            maxHeight: "88%",
            paddingBottom: 28,
          },
          sheetStyle,
        ]}
      >
        {/* Zone de drag : grip + titre */}
        <GestureDetector gesture={pan}>
          <View>
            <View style={{ width: 36, height: 4, backgroundColor: L.lineStrong, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 6 }} />
            {title != null && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 8 }}>
                <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: C.ink0, flex: 1 }}>{title}</Text>
                <Pressable onPress={onClose} hitSlop={10} style={{ padding: 6 }}>
                  <Text style={{ color: C.ink3, fontSize: 16 }}>✕</Text>
                </Pressable>
              </View>
            )}
          </View>
        </GestureDetector>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: title != null ? 4 : 8 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Supprimer",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {!!message && <Text style={{ color: C.ink2, fontSize: 14, lineHeight: 20, marginBottom: 18 }}>{message}</Text>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn kind="ghost" onPress={onClose} style={{ flex: 1 }}>
          Annuler
        </Btn>
        <Btn
          kind={danger ? "danger" : "primary"}
          onPress={() => {
            haptic(danger ? "warning" : "success");
            onConfirm();
          }}
          style={{ flex: 1 }}
        >
          {confirmLabel}
        </Btn>
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
export function Segment<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 12, padding: 3, marginBottom: 16 }}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => {
            if (o.value !== value) haptic("light");
            onChange(o.value);
          }}
          style={{
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: o.value === value ? L.bgHover : "transparent",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: o.value === value ? C.ink0 : C.ink2 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
export function PickerSheet({
  open,
  onClose,
  title,
  options,
  onPick,
  search,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: { value: string; label: string; sub?: string }[];
  onPick: (value: string) => void;
  search?: boolean;
}) {
  const [q, setQ] = useState("");
  const norm = (t: string) => t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = q ? options.filter((o) => norm(o.label).includes(norm(q))) : options;
  return (
    <Sheet
      open={open}
      onClose={() => {
        setQ("");
        onClose();
      }}
      title={title}
    >
      {search && (
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher…"
          placeholderTextColor={C.ink3}
          style={{
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: L.line,
            borderRadius: 12,
            color: C.ink0,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 15,
            marginBottom: 12,
          }}
        />
      )}
      <View style={{ gap: 5 }}>
        {filtered.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic("light");
              setQ("");
              onPick(o.value);
            }}
            style={({ pressed }) => ({
              padding: 12,
              borderRadius: 10,
              backgroundColor: pressed ? L.bgHover : "rgba(255,255,255,.03)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,.06)",
            })}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.ink0 }}>{o.label}</Text>
            {!!o.sub && <Text style={{ fontSize: 10, color: C.ink3, marginTop: 1 }}>{o.sub}</Text>}
          </Pressable>
        ))}
        {filtered.length === 0 && <Text style={{ color: C.ink3, textAlign: "center", padding: 20 }}>Aucun résultat</Text>}
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton — shimmer doux pendant le chargement (jamais d'écran nu)   */
/* ------------------------------------------------------------------ */
export function Skeleton({ width, height = 16, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1);
  }, []);
  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: width ?? "100%", height, borderRadius: radius, backgroundColor: C.bg3 }, aStyle, style]} />;
}

/** Squelette générique d'écran (header + cartes) pendant le premier chargement. */
export function ScreenSkeleton({ paddingTop = 60 }: { paddingTop?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0, padding: 16, paddingTop }}>
      <Skeleton width={160} height={30} radius={8} style={{ marginBottom: 20 }} />
      <Skeleton height={140} radius={R.md} style={{ marginBottom: 10 }} />
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <Skeleton height={110} radius={R.md} style={{ flex: 1 }} />
        <Skeleton height={110} radius={R.md} style={{ flex: 1 }} />
      </View>
      <Skeleton height={90} radius={R.md} style={{ marginBottom: 10 }} />
      <Skeleton height={90} radius={R.md} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SyncDot — statut de sync discret : point vert (ok), orange pulsant   */
/* (en cours), doré + compteur (écritures en attente / hors ligne).     */
/* ------------------------------------------------------------------ */
export function SyncDot() {
  const { syncing, pendingSync } = useData();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (syncing) {
      pulse.value = withRepeat(withSequence(withTiming(0.35, { duration: 500 }), withTiming(1, { duration: 500 })), -1);
    } else {
      pulse.value = withTiming(1, { duration: MOTION.local });
    }
  }, [syncing]);
  const aStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const color = syncing ? C.accent : pendingSync > 0 ? C.gold : C.success;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: syncing ? 1 : 0.7 }, aStyle]} />
      {pendingSync > 0 && !syncing && <Text style={[mono, { fontSize: 9, fontWeight: "700", color: C.gold }]}>{pendingSync}</Text>}
    </View>
  );
}

/* ------------------------------------------------------------------ */
export function Num({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[mono, style]}>{children}</Text>;
}

/* ------------------------------------------------------------------ */
/* CountUp — valeur qui compte vers sa cible (ease-out, sans rebond)   */
/* ------------------------------------------------------------------ */
export function CountUp({
  value,
  decimals = 0,
  duration = 620,
  style,
  suffix,
  format,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  style?: TextStyle | TextStyle[];
  suffix?: string;
  format?: (v: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = { current: 0 } as { current: number };
  const prevRef = usePrevValue(value);

  useEffect(() => {
    const from = prevRef ?? 0;
    const start = Date.now();
    const tick = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (value - from) * eased);
      if (t >= 1) clearInterval(tick);
    }, 1000 / 30);
    return () => clearInterval(tick);
  }, [value]);

  const text = format ? format(display) : display.toFixed(decimals);
  return (
    <Text style={[mono as TextStyle, ...(Array.isArray(style) ? style : style ? [style] : [])]}>
      {text}
      {suffix ?? ""}
    </Text>
  );
}

// Mémorise la valeur précédente entre renders (pour compter depuis l'ancienne)
const prevStore = new WeakMap<object, number>();
function usePrevValue(value: number): number | undefined {
  const keyRef = useState(() => ({}))[0];
  const prev = prevStore.get(keyRef);
  useEffect(() => {
    prevStore.set(keyRef, value);
  }, [value]);
  return prev;
}
