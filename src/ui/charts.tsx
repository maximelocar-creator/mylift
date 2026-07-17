// Graphiques SVG — équivalents RN des charts v40 (TonnageChart, MuscleDetailChart,
// ExoDetailChart). Courbe brute fine + lissée épaisse + area, baseline 100,
// points PR, scrubber tactile (drag pour lire une valeur).
import { useMemo, useState } from "react";
import { View, Text, LayoutChangeEvent, GestureResponderEvent } from "react-native";
import Svg, { Path, Line, Circle, Rect } from "react-native-svg";
import { C, mono } from "../lib/theme";
import { formatNum, formatDate } from "../lib/format";

type Pt = { date: string; value: number };

const H = 160;
const PADX = 6;
const PADY = 14;

function buildPath(points: { x: number; y: number }[]) {
  return points.map((m, i) => (i === 0 ? "M" : "L") + m.x.toFixed(1) + "," + m.y.toFixed(1)).join(" ");
}

/* ------------------------------------------------------------------ */
/* Courbe indice : brute (fine, transparente) + lissée (épaisse) +      */
/* baseline 100 + scrubber                                             */
/* ------------------------------------------------------------------ */
export function IndexChart({ raw, smooth, baseline = 100, unit = "indice" }: { raw: Pt[]; smooth: Pt[]; baseline?: number | null; unit?: string }) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (!width || smooth.length < 2) return null;
    const all = [...raw.map((p) => p.value), ...smooth.map((p) => p.value), ...(baseline !== null ? [baseline] : [])];
    const vmin = Math.min(...all) - 2;
    const vmax = Math.max(...all) + 2;
    const range = vmax - vmin || 1;
    const xStep = smooth.length > 1 ? (width - 2 * PADX) / (smooth.length - 1) : 0;
    const my = (v: number) => PADY + (H - 2 * PADY) * (1 - (v - vmin) / range);
    const rawM = raw.map((p, i) => ({ x: PADX + i * xStep, y: my(p.value) }));
    const smoothM = smooth.map((p, i) => ({ x: PADX + i * xStep, y: my(p.value) }));
    return { rawM, smoothM, baselineY: baseline !== null ? my(baseline) : null, xStep };
  }, [width, raw, smooth, baseline]);

  const onTouch = (e: GestureResponderEvent) => {
    if (!geom || !smooth.length) return;
    const x = e.nativeEvent.locationX;
    const idx = Math.round((x - PADX) / (geom.xStep || 1));
    setScrub(Math.max(0, Math.min(smooth.length - 1, idx)));
  };

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onTouch}
      onResponderMove={onTouch}
      onResponderRelease={() => setScrub(null)}
      style={{ height: H + 26 }}
    >
      {geom && (
        <>
          <Svg width={width} height={H}>
            {/* Baseline (100 pour les indices) */}
            {geom.baselineY !== null && (
              <Line x1={PADX} y1={geom.baselineY} x2={width - PADX} y2={geom.baselineY} stroke="rgba(255,255,255,.12)" strokeWidth={1} strokeDasharray="3,4" />
            )}
            {/* Area sous la lissée */}
            <Path
              d={buildPath(geom.smoothM) + ` L${geom.smoothM[geom.smoothM.length - 1].x},${H} L${geom.smoothM[0].x},${H} Z`}
              fill="rgba(252,76,2,.08)"
            />
            {/* Brute : fine, orange transparent */}
            <Path d={buildPath(geom.rawM)} stroke="rgba(252,76,2,.35)" strokeWidth={1.2} fill="none" />
            {/* Lissée : épaisse */}
            <Path d={buildPath(geom.smoothM)} stroke={C.accent} strokeWidth={2.5} fill="none" />
            {/* Scrubber */}
            {scrub !== null && geom.smoothM[scrub] && (
              <>
                <Line x1={geom.smoothM[scrub].x} y1={PADY - 6} x2={geom.smoothM[scrub].x} y2={H - 4} stroke="rgba(255,255,255,.35)" strokeWidth={1} />
                <Circle cx={geom.smoothM[scrub].x} cy={geom.smoothM[scrub].y} r={4.5} fill={C.accent} stroke="#fff" strokeWidth={1.5} />
              </>
            )}
          </Svg>
          <View style={{ flexDirection: "row", justifyContent: scrub !== null ? "center" : "space-between", paddingHorizontal: 2, marginTop: 4 }}>
            {scrub !== null && smooth[scrub] ? (
              <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.ink0 }]}>
                {formatDate(smooth[scrub].date)} · {unit} {smooth[scrub].value.toFixed(1)}
              </Text>
            ) : (
              <>
                <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{smooth.length ? formatDate(smooth[0].date) : ""}</Text>
                <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{smooth.length ? formatDate(smooth[smooth.length - 1].date) : ""}</Text>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Courbe e1RM (kg) par séance : points PR or, up orange, flat gris     */
/* ------------------------------------------------------------------ */
export function E1RMChart({ points }: { points: { date: string; value: number; kind: string; isPR: boolean; weight: number; reps: number }[] }) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (!width || points.length < 2) return null;
    const vals = points.map((p) => p.value);
    const SMOOTH_WIN = 5;
    const smoothVals = vals.map((v, i) => {
      const w = Math.min(SMOOTH_WIN, i + 1);
      const slice = vals.slice(Math.max(0, i - w + 1), i + 1);
      return slice.reduce((a, x) => a + x, 0) / slice.length;
    });
    const all = [...vals, ...smoothVals];
    const vmin = Math.min(...all) - 2;
    const vmax = Math.max(...all) + 2;
    const range = vmax - vmin || 1;
    const xStep = points.length > 1 ? (width - 2 * PADX) / (points.length - 1) : 0;
    const my = (v: number) => PADY + (H - 2 * PADY) * (1 - (v - vmin) / range);
    const mapped = points.map((p, i) => ({ x: PADX + i * xStep, y: my(p.value), p }));
    const smoothM = smoothVals.map((sv, i) => ({ x: PADX + i * xStep, y: my(sv) }));
    return { mapped, smoothM, xStep };
  }, [width, points]);

  const onTouch = (e: GestureResponderEvent) => {
    if (!geom) return;
    const x = e.nativeEvent.locationX;
    const idx = Math.round((x - PADX) / (geom.xStep || 1));
    setScrub(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const dotColor = (p: { kind: string; isPR: boolean }) => (p.isPR ? C.gold : p.kind === "up" ? C.accent : p.kind === "down" ? "#696980" : "#9CA0B5");

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onTouch}
      onResponderMove={onTouch}
      onResponderRelease={() => setScrub(null)}
      style={{ height: H + 26 }}
    >
      {geom && (
        <>
          <Svg width={width} height={H}>
            <Path
              d={buildPath(geom.smoothM) + ` L${geom.smoothM[geom.smoothM.length - 1].x},${H} L${geom.smoothM[0].x},${H} Z`}
              fill="rgba(252,76,2,.07)"
            />
            <Path d={buildPath(geom.smoothM)} stroke="rgba(252,76,2,.5)" strokeWidth={2} fill="none" />
            <Path d={buildPath(geom.mapped)} stroke="rgba(255,255,255,.18)" strokeWidth={1} fill="none" />
            {geom.mapped.map((m, i) => (
              <Circle key={i} cx={m.x} cy={m.y} r={m.p.isPR ? 4 : 3} fill={dotColor(m.p)} />
            ))}
            {scrub !== null && geom.mapped[scrub] && (
              <>
                <Line x1={geom.mapped[scrub].x} y1={PADY - 6} x2={geom.mapped[scrub].x} y2={H - 4} stroke="rgba(255,255,255,.35)" strokeWidth={1} />
                <Circle cx={geom.mapped[scrub].x} cy={geom.mapped[scrub].y} r={5} fill={dotColor(geom.mapped[scrub].p)} stroke="#fff" strokeWidth={1.5} />
              </>
            )}
          </Svg>
          <View style={{ flexDirection: "row", justifyContent: scrub !== null ? "center" : "space-between", paddingHorizontal: 2, marginTop: 4 }}>
            {scrub !== null && points[scrub] ? (
              <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.ink0 }]}>
                {formatDate(points[scrub].date)} · {points[scrub].weight}×{points[scrub].reps} · e1RM {points[scrub].value.toFixed(1)} kg
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

/* ------------------------------------------------------------------ */
/* Barres de tonnage par date                                          */
/* ------------------------------------------------------------------ */
export function TonnageBars({ points, height = 120 }: { points: Pt[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  const gap = 2;
  const barW = width && points.length ? Math.max(2, (width - gap * (points.length - 1)) / points.length) : 0;

  const onTouch = (e: GestureResponderEvent) => {
    if (!width || !points.length) return;
    const idx = Math.floor(e.nativeEvent.locationX / (barW + gap));
    setScrub(Math.max(0, Math.min(points.length - 1, idx)));
  };

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onTouch}
      onResponderMove={onTouch}
      onResponderRelease={() => setScrub(null)}
      style={{ height: height + 22 }}
    >
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            {points.map((p, i) => {
              const h = Math.max(3, (p.value / max) * (height - 8));
              return (
                <Rect
                  key={i}
                  x={i * (barW + gap)}
                  y={height - h}
                  width={barW}
                  height={h}
                  rx={Math.min(3, barW / 2)}
                  fill={scrub === i ? C.accentHi : C.accent}
                  opacity={scrub === null || scrub === i ? 1 : 0.45}
                />
              );
            })}
          </Svg>
          <View style={{ flexDirection: "row", justifyContent: scrub !== null ? "center" : "space-between", marginTop: 4 }}>
            {scrub !== null && points[scrub] ? (
              <Text style={[mono, { fontSize: 11, fontWeight: "700", color: C.ink0 }]}>
                {formatDate(points[scrub].date)} · {formatNum(points[scrub].value / 1000, 1)} t
              </Text>
            ) : (
              <>
                <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{points.length ? formatDate(points[0].date) : ""}</Text>
                <Text style={[mono, { fontSize: 10, color: C.ink3 }]}>{points.length ? formatDate(points[points.length - 1].date) : ""}</Text>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}
