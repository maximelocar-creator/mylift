// Courbe de progression compacte (orange) pour les stickers Instagram.
// SVG statique — pas d'animation : l'image est capturée, pas regardée à l'écran.
import { View } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { C } from "../lib/theme";
import type { CurvePoint } from "../lib/stickerData";

export function Sparkline({
  points,
  width,
  height = 46,
  strokeWidth = 3,
}: {
  points: CurvePoint[];
  width: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (!points || points.length < 2) return null;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  // Marge identique à gauche ET à droite, assez large pour que le point
  // terminal (halo compris) ne déborde jamais → courbe visuellement centrée
  const pad = strokeWidth + 6;
  const px = (i: number) => (i / (points.length - 1)) * (width - pad * 2) + pad;
  const py = (y: number) => height - pad - ((y - min) / span) * (height - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${py(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L ${px(points.length - 1).toFixed(1)} ${height} L ${px(0).toFixed(1)} ${height} Z`;
  const lastX = px(points.length - 1);
  const lastY = py(points[points.length - 1].y);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.accent} stopOpacity="0.35" />
            <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#sparkFill)" />
        <Path d={line} stroke={C.accent} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Circle cx={lastX} cy={lastY} r={strokeWidth + 1.5} fill={C.accent} />
        <Circle cx={lastX} cy={lastY} r={strokeWidth + 4} fill={C.accent} fillOpacity={0.25} />
      </Svg>
    </View>
  );
}
