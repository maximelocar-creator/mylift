// Slider de répartition % par sous-groupe (port SgSliderRow v40) — partagé
// entre le générateur et l'éditeur de cibles de volume.
import { useRef, useState } from "react";
import { View, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { C, L, mono } from "../lib/theme";

/* ------------------------------------------------------------------ */
export function SgSliderRow({ name, pct, series, onChange }: { name: string; pct: number; series: number; onChange: (v: number) => void }) {
  const [active, setActive] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const clampedPct = Math.max(0, Math.min(100, pct));
  const startPct = useRef(clampedPct);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startPct.current = clampedPct;
      setActive(true);
    })
    .onChange((e) => {
      if (!trackW) return;
      const next = Math.max(0, Math.min(100, startPct.current + (e.translationX / trackW) * 100));
      onChange(Math.round(next));
    })
    .onFinalize(() => setActive(false))
    .runOnJS(true);

  return (
    <View
      style={{
        paddingVertical: 11,
        paddingHorizontal: 12,
        backgroundColor: C.bg2,
        borderWidth: 1,
        borderColor: active ? "rgba(252,76,2,.35)" : L.line,
        borderRadius: 12,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: C.ink0, flexShrink: 1 }}>
          {name}
        </Text>
        <Text style={[mono, { fontSize: 12, fontWeight: "700", color: C.ink1 }]}>
          <Text style={{ color: C.accentHi, fontSize: 15, fontWeight: "800" }}>{Math.round(clampedPct)}%</Text>
          <Text style={{ color: C.ink3, fontSize: 11, fontWeight: "500" }}>
            {"  "}
            {series} série{series > 1 ? "s" : ""}
          </Text>
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={{ height: 32, justifyContent: "center" }} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
          <View style={{ height: 10, backgroundColor: C.bg3, borderRadius: 999, overflow: "hidden" }}>
            <View style={{ width: `${clampedPct}%`, height: "100%", backgroundColor: C.accent, borderRadius: 999 }} />
          </View>
          <View
            style={{
              position: "absolute",
              left: `${clampedPct}%`,
              marginLeft: -14,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "#fff",
              borderWidth: 3,
              borderColor: C.accent,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: active ? 1.12 : 1 }],
            }}
          >
            <Text style={[mono, { fontSize: 9, fontWeight: "900", color: C.accent }]}>{Math.round(clampedPct)}</Text>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
