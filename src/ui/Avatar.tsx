// Avatar — photo si avatar_url, sinon initiale sur fond accent.
import { View, Text, Image } from "react-native";
import { C } from "../lib/theme";
import type { Any } from "../core/mylift";

export function Avatar({ profile, size = 48 }: { profile: Any | null; size?: number }) {
  const url = profile?.avatar_url;
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.bg3 }} />;
  }
  const letter = (profile?.username || "?").charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(252,76,2,.18)",
        borderWidth: 1,
        borderColor: "rgba(252,76,2,.35)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.accentHi, fontSize: size * 0.42, fontWeight: "800" }}>{letter}</Text>
    </View>
  );
}
