// Graphiques premium (façon Revolut) — react-native-svg + Reanimated.
// - Montage : la courbe SE CONSTRUIT (tracé progressif gauche→droite via
//   strokeDashoffset, easing out cubic, aucun rebond), le gradient apparaît
//   en fondu à la suite.
// - Changement de période : MORPH point-à-point entre les deux jeux de données
//   (rééchantillonnés à N constant, interpolation sur le thread UI), pas de
//   remount. Labels d'axe en fondu.
// - Scrubber : Gesture.Pan natif, curseur/ligne pilotés en animatedProps (zéro
//   re-render par pixel), tooltip valeur+date qui suit le doigt, tick haptique
//   au changement de point.
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
  FadeIn,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { C, L, MOTION, mono } from "../lib/theme";
import { formatNum, formatDate } from "../lib/format";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Pt = { date: string; value: number };

const H = 168;
const PADX = 6;
const PADY = 16;
const N = 60; // points de rééchantillonnage : morph à cardinalité constante

const EASE_OUT = Easing.out(Easing.cubic);
const DRAW_MS = 650;
const MORPH_MS = 260;

/* Rééchantillonne une série de valeurs à N points (interpolation linéaire). */
function resample(values: number[], n: number): number[] {
  if (values.length === 0) return Array(n).fill(0);
  if (values.length === 1) return Array(n).fill(values[0]);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (values.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(values.length - 1, lo + 1);
    out.push(values[lo] + (values[hi] - values[lo]) * (t - lo));
  }
  return out;
}

function toPixelY(values: number[], vmin: number, vmax: number): number[] {
  const range = vmax - vmin || 1;
  return values.map((v) => PADY + (H - 2 * PADY) * (1 - (v - vmin) / range));
}

function polylineLength(xs: number[], ys: number[]): number {
  let len = 0;
  for (let i = 1; i < xs.length; i++) len += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  return len;
}

const selectionTick = () => {
  try {
    Haptics.selectionAsync();
  } catch {}
};

/* ==================================================================== */
/* Cœur commun : courbe lissée morphable + brute + area + scrubber      */
/* ==================================================================== */
function useMorphChart(width: number, smooth: Pt[], raw: Pt[] | null, baseline: number | null) {
  // Domaine (min/max) sur les données réelles
  const domain = useMemo(() => {
    const all = [...smooth.map((p) => p.value), ...(raw || []).map((p) => p.value), ...(baseline !== null ? [baseline] : [])];
    if (!all.length) return { vmin: 0, vmax: 1 };
    return { vmin: Math.min(...all) - 2, vmax: Math.max(...all) + 2 };
  }, [smooth, raw, baseline]);

  const xs = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < N; i++) out.push(PADX + (i * (Math.max(width, 1) - 2 * PADX)) / (N - 1));
    return out;
  }, [width]);

  const smoothPix = useMemo(() => toPixelY(resample(smooth.map((p) => p.value), N), domain.vmin, domain.vmax), [smooth, domain]);
  const rawPix = useMemo(
    () => (raw ? toPixelY(resample(raw.map((p) => p.value), N), domain.vmin, domain.vmax) : null),
    [raw, domain]
  );

  const fromSmooth = useSharedValue<number[]>(smoothPix);
  const toSmooth = useSharedValue<number[]>(smoothPix);
  const fromRaw = useSharedValue<number[]>(rawPix || smoothPix);
  const toRaw = useSharedValue<number[]>(rawPix || smoothPix);
  const progress = useSharedValue(1);
  const dashOffset = useSharedValue(0);
  const areaOpacity = useSharedValue(0);
  const mountedRef = useRef(false);
  const prevSmooth = useRef(smoothPix);
  const prevRaw = useRef(rawPix || smoothPix);
  const sig = smooth.length + ":" + (smooth[0]?.date || "") + ":" + (smooth[smooth.length - 1]?.date || "") + ":" + width;
  const totalLen = useMemo(() => polylineLength(xs, smoothPix), [xs, smoothPix]);

  useEffect(() => {
    if (!width) return;
    if (!mountedRef.current) {
      // Montage : tracé progressif (draw-on), pas de morph
      mountedRef.current = true;
      fromSmooth.value = smoothPix;
      toSmooth.value = smoothPix;
      fromRaw.value = rawPix || smoothPix;
      toRaw.value = rawPix || smoothPix;
      progress.value = 1;
      dashOffset.value = totalLen;
      dashOffset.value = withTiming(0, { duration: DRAW_MS, easing: EASE_OUT });
      areaOpacity.value = withDelay(DRAW_MS * 0.45, withTiming(1, { duration: 420, easing: EASE_OUT }));
    } else {
      // Changement de données : morph point-à-point, aucun rebond
      fromSmooth.value = prevSmooth.current;
      toSmooth.value = smoothPix;
      fromRaw.value = prevRaw.current;
      toRaw.value = rawPix || smoothPix;
      progress.value = 0;
      progress.value = withTiming(1, { duration: MORPH_MS, easing: EASE_OUT });
      dashOffset.value = 0;
      areaOpacity.value = 1;
    }
    prevSmooth.current = smoothPix;
    prevRaw.current = rawPix || smoothPix;
  }, [sig]);

  const smoothProps = useAnimatedProps(() => {
    const f = fromSmooth.value,
      t = toSmooth.value,
      p = progress.value;
    let d = "";
    for (let i = 0; i < N; i++) {
      const y = f[i] + (t[i] - f[i]) * p;
      d += (i === 0 ? "M" : "L") + xs[i].toFixed(1) + "," + y.toFixed(1);
    }
    return { d, strokeDashoffset: dashOffset.value };
  });

  const areaProps = useAnimatedProps(() => {
    const f = fromSmooth.value,
      t = toSmooth.value,
      p = progress.value;
    let d = "";
    for (let i = 0; i < N; i++) {
      const y = f[i] + (t[i] - f[i]) * p;
      d += (i === 0 ? "M" : "L") + xs[i].toFixed(1) + "," + y.toFixed(1);
    }
    d += `L${xs[N - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;
    return { d, opacity: areaOpacity.value };
  });

  const rawProps = useAnimatedProps(() => {
    if (!rawPix) return { d: "M0,0", opacity: 0 };
    const f = fromRaw.value,
      t = toRaw.value,
      p = progress.value;
    let d = "";
    for (let i = 0; i < N; i++) {
      const y = f[i] + (t[i] - f[i]) * p;
      d += (i === 0 ? "M" : "L") + xs[i].toFixed(1) + "," + y.toFixed(1);
    }
    return { d, opacity: areaOpacity.value ? 0.35 * areaOpacity.value : 0 };
  });

  return { domain, xs, smoothPix, totalLen, smoothProps, areaProps, rawProps, toSmooth, progress, fromSmooth, sig };
}

/* Scrubber : x partagé + index → tooltip (état mis à jour uniquement au
   changement d'index, jamais par pixel). */
function useScrubber(width: number, dataLen: number, chart: ReturnType<typeof useMorphChart>, onIndexChange: (i: number | null) => void) {
  const scrubX = useSharedValue(-1);
  const active = useSharedValue(0);
  const lastIdx = useSharedValue(-1);

  useAnimatedReaction(
    () => {
      if (active.value === 0 || dataLen === 0) return -1;
      const clamped = Math.min(Math.max(scrubX.value, PADX), Math.max(width - PADX, PADX));
      return Math.round(((clamped - PADX) / Math.max(width - 2 * PADX, 1)) * (dataLen - 1));
    },
    (idx) => {
      if (idx !== lastIdx.value) {
        lastIdx.value = idx;
        runOnJS(onIndexChange)(idx < 0 ? null : idx);
        if (idx >= 0) runOnJS(selectionTick)();
      }
    },
    [width, dataLen]
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      active.value = 1;
      scrubX.value = e.x;
    })
    .onChange((e) => {
      scrubX.value = e.x;
    })
    .onFinalize(() => {
      active.value = 0;
      lastIdx.value = -1;
      runOnJS(onIndexChange)(null);
    });

  // Position curseur : y interpolé sur la courbe COURANTE (UI thread)
  const cursorProps = useAnimatedProps(() => {
    const cx = Math.min(Math.max(scrubX.value, PADX), Math.max(width - PADX, PADX));
    const f = chart.fromSmooth.value,
      t = chart.toSmooth.value,
      p = chart.progress.value;
    const fx = ((cx - PADX) / Math.max(width - 2 * PADX, 1)) * (N - 1);
    const lo = Math.floor(fx);
    const hi = Math.min(N - 1, lo + 1);
    const yLo = f[lo] + (t[lo] - f[lo]) * p;
    const yHi = f[hi] + (t[hi] - f[hi]) * p;
    const cy = yLo + (yHi - yLo) * (fx - lo);
    return { cx, cy, opacity: active.value };
  });

  const lineProps = useAnimatedProps(() => {
    const cx = Math.min(Math.max(scrubX.value, PADX), Math.max(width - PADX, PADX));
    return { x1: cx, x2: cx, opacity: active.value * 0.5 };
  });

  const tooltipStyle = useAnimatedStyle(() => {
    const cx = Math.min(Math.max(scrubX.value, PADX), Math.max(width - PADX, PADX));
    const TW = 132;
    const tx = Math.min(Math.max(cx - TW / 2, 0), Math.max(width - TW, 0));
    return { transform: [{ translateX: tx }], opacity: withTiming(active.value, { duration: 80 }) };
  });

  return { pan, cursorProps, lineProps, tooltipStyle };
}

/* ==================================================================== */
/* Courbe indice / poids : brute + lissée + baseline + scrubber          */
/* ==================================================================== */
export function IndexChart({
  raw,
  smooth,
  baseline = 100,
  unit = "indice",
}: {
  raw: Pt[];
  smooth: Pt[];
  baseline?: number | null;
  unit?: string;
}) {
  const [width, setWidth] = useState(0);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const chart = useMorphChart(width, smooth, raw, baseline);
  const scrub = useScrubber(width, smooth.length, chart, setScrubIdx);

  const baselineY =
    baseline !== null ? PADY + (H - 2 * PADY) * (1 - (baseline - chart.domain.vmin) / (chart.domain.vmax - chart.domain.vmin || 1)) : null;
  const pt = scrubIdx !== null ? smooth[scrubIdx] : null;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: H + 26 }}>
      {width > 0 && smooth.length >= 2 && (
        <>
          {/* Tooltip flottant */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: -6,
                width: 132,
                zIndex: 2,
                backgroundColor: C.bg3,
                borderWidth: 1,
                borderColor: L.lineStrong,
                borderRadius: 8,
                paddingVertical: 4,
                paddingHorizontal: 8,
                alignItems: "center",
              },
              scrub.tooltipStyle,
            ]}
          >
            <Text style={[mono, { fontSize: 12, fontWeight: "800", color: C.ink0 }]}>
              {pt ? (unit ? `${unit} ${pt.value.toFixed(1)}` : pt.value.toFixed(1)) : ""}
            </Text>
            <Text style={[mono, { fontSize: 9.5, color: C.ink3, marginTop: 1 }]}>{pt ? formatDate(pt.date) + " " + pt.date.slice(0, 4) : ""}</Text>
          </Animated.View>

          <GestureDetector gesture={scrub.pan}>
            <Svg width={width} height={H}>
              <Defs>
                <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={C.accent} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={C.accent} stopOpacity={0.01} />
                </LinearGradient>
              </Defs>
              {baselineY !== null && (
                <Line x1={PADX} y1={baselineY} x2={width - PADX} y2={baselineY} stroke={L.lineStrong} strokeWidth={1} strokeDasharray="3,4" />
              )}
              <AnimatedPath animatedProps={chart.areaProps} fill="url(#areaGrad)" />
              <AnimatedPath animatedProps={chart.rawProps} stroke={C.accent} strokeWidth={1.2} fill="none" />
              <AnimatedPath
                animatedProps={chart.smoothProps}
                stroke={C.accent}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={[chart.totalLen, chart.totalLen] as any}
              />
              <AnimatedLine animatedProps={scrub.lineProps} y1={PADY - 8} y2={H - 4} stroke={C.ink1} strokeWidth={1} />
              <AnimatedCircle animatedProps={scrub.cursorProps} r={5} fill={C.accent} stroke="#fff" strokeWidth={1.5} />
            </Svg>
          </GestureDetector>

          {/* Labels d'axe — fondu au changement de période */}
          <Animated.View key={chart.sig} entering={FadeIn.duration(MOTION.local)} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2, marginTop: 4 }}>
            <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{formatDate(smooth[0].date)}</Text>
            <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{formatDate(smooth[smooth.length - 1].date)}</Text>
          </Animated.View>
        </>
      )}
    </View>
  );
}

/* ==================================================================== */
/* Courbe e1RM : lissée morphable + points colorés (PR or, up orange)    */
/* ==================================================================== */
export function E1RMChart({ points }: { points: { date: string; value: number; kind: string; isPR: boolean; weight: number; reps: number }[] }) {
  const [width, setWidth] = useState(0);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);

  const smoothSeries = useMemo(() => {
    const vals = points.map((p) => p.value);
    const SMOOTH_WIN = 5;
    return points.map((p, i) => {
      const w = Math.min(SMOOTH_WIN, i + 1);
      const slice = vals.slice(Math.max(0, i - w + 1), i + 1);
      return { date: p.date, value: slice.reduce((a, x) => a + x, 0) / slice.length };
    });
  }, [points]);

  const rawSeries = useMemo(() => points.map((p) => ({ date: p.date, value: p.value })), [points]);
  const chart = useMorphChart(width, smoothSeries, rawSeries, null);
  const scrub = useScrubber(width, points.length, chart, setScrubIdx);

  const dotColor = (p: { kind: string; isPR: boolean }) => (p.isPR ? C.gold : p.kind === "up" ? C.accent : p.kind === "down" ? "#696980" : "#9CA0B5");
  const dots = useMemo(() => {
    if (!width || points.length < 2) return [];
    const range = chart.domain.vmax - chart.domain.vmin || 1;
    return points.map((p, i) => ({
      x: PADX + (i * (width - 2 * PADX)) / (points.length - 1),
      y: PADY + (H - 2 * PADY) * (1 - (p.value - chart.domain.vmin) / range),
      color: dotColor(p),
      isPR: p.isPR,
    }));
  }, [width, points, chart.domain]);

  const pt = scrubIdx !== null ? points[scrubIdx] : null;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: H + 26 }}>
      {width > 0 && points.length >= 2 && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: -6,
                width: 132,
                zIndex: 2,
                backgroundColor: C.bg3,
                borderWidth: 1,
                borderColor: L.lineStrong,
                borderRadius: 8,
                paddingVertical: 4,
                paddingHorizontal: 8,
                alignItems: "center",
              },
              scrub.tooltipStyle,
            ]}
          >
            <Text style={[mono, { fontSize: 12, fontWeight: "800", color: pt?.isPR ? C.gold : C.ink0 }]}>
              {pt ? `${pt.weight}×${pt.reps} · ${pt.value.toFixed(1)} kg` : ""}
            </Text>
            <Text style={[mono, { fontSize: 9.5, color: C.ink3, marginTop: 1 }]}>{pt ? formatDate(pt.date) + " " + pt.date.slice(0, 4) : ""}</Text>
          </Animated.View>

          <GestureDetector gesture={scrub.pan}>
            <Svg width={width} height={H}>
              <Defs>
                <LinearGradient id="e1rmGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={C.accent} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={C.accent} stopOpacity={0.01} />
                </LinearGradient>
              </Defs>
              <AnimatedPath animatedProps={chart.areaProps} fill="url(#e1rmGrad)" />
              <AnimatedPath animatedProps={chart.rawProps} stroke={C.ink2} strokeWidth={1} fill="none" />
              <AnimatedPath
                animatedProps={chart.smoothProps}
                stroke={C.accent}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={[chart.totalLen, chart.totalLen] as any}
              />
              <AnimatedLine animatedProps={scrub.lineProps} y1={PADY - 8} y2={H - 4} stroke={C.ink1} strokeWidth={1} />
              <AnimatedCircle animatedProps={scrub.cursorProps} r={5} fill={C.accent} stroke="#fff" strokeWidth={1.5} />
            </Svg>
          </GestureDetector>

          {/* Points par séance — fondu après le tracé */}
          <Animated.View key={"dots" + chart.sig} entering={FadeIn.delay(DRAW_MS * 0.6).duration(300)} pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}>
            <Svg width={width} height={H}>
              {dots.map((d, i) => (
                <Circle key={i} cx={d.x} cy={d.y} r={d.isPR ? 4 : 3} fill={d.color} />
              ))}
            </Svg>
          </Animated.View>

          <Animated.View key={chart.sig} entering={FadeIn.duration(MOTION.local)} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2, marginTop: 4 }}>
            <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{formatDate(points[0].date)}</Text>
            <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{formatDate(points[points.length - 1].date)}</Text>
          </Animated.View>
        </>
      )}
    </View>
  );
}

/* ==================================================================== */
/* Barres de tonnage — hauteurs animées, stagger au montage, scrubber    */
/* ==================================================================== */
function TonnageBar({ value, max, height, delay, highlighted, dimmed }: { value: number; max: number; height: number; delay: number; highlighted: boolean; dimmed: boolean }) {
  const h = useSharedValue(3);
  const target = Math.max(3, (value / max) * (height - 8));
  useEffect(() => {
    h.value = withDelay(delay, withTiming(target, { duration: 480, easing: EASE_OUT }));
  }, [target]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[
        {
          flex: 1,
          borderRadius: 3,
          backgroundColor: highlighted ? C.accentHi : C.accent,
          opacity: dimmed ? 0.4 : 1,
        },
        style,
      ]}
    />
  );
}

export function TonnageBars({ points, height = 120 }: { points: Pt[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  const scrubIdxRef = useRef<number | null>(null);

  const setIdx = (i: number | null) => {
    if (i !== scrubIdxRef.current) {
      scrubIdxRef.current = i;
      setScrubIdx(i);
      if (i !== null) selectionTick();
    }
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const i = Math.floor((e.x / Math.max(width, 1)) * points.length);
      runOnJS(setIdx)(Math.max(0, Math.min(points.length - 1, i)));
    })
    .onChange((e) => {
      const i = Math.floor((e.x / Math.max(width, 1)) * points.length);
      runOnJS(setIdx)(Math.max(0, Math.min(points.length - 1, i)));
    })
    .onFinalize(() => {
      runOnJS(setIdx)(null);
    });

  const pt = scrubIdx !== null ? points[scrubIdx] : null;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: height + 22 }}>
      {width > 0 && points.length > 0 && (
        <>
          <GestureDetector gesture={pan}>
            <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
              {points.map((p, i) => (
                <TonnageBar
                  key={p.date}
                  value={p.value}
                  max={max}
                  height={height}
                  delay={Math.min(i * 12, 360)}
                  highlighted={scrubIdx === i}
                  dimmed={scrubIdx !== null && scrubIdx !== i}
                />
              ))}
            </View>
          </GestureDetector>
          <View style={{ flexDirection: "row", justifyContent: scrubIdx !== null ? "center" : "space-between", marginTop: 4 }}>
            {pt ? (
              <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.ink0 }]}>
                {formatDate(pt.date)} · {formatNum(pt.value / 1000, 1)} t
              </Text>
            ) : (
              <>
                <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{formatDate(points[0].date)}</Text>
                <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{formatDate(points[points.length - 1].date)}</Text>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}
