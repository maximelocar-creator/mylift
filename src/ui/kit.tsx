// Kit UI — composants de base mappés sur les tokens DA v40 (src/lib/theme.ts).
// Sheets iOS-like (Modal bottom sheet), boutons, chips, labels.
import { ReactNode, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, ViewStyle, TextStyle } from "react-native";
import { C, R, mono } from "../lib/theme";

// Tokens complémentaires (repris du CSS v40)
export const LINE = "rgba(255,255,255,.06)";
export const LINE_STRONG = "rgba(255,255,255,.12)";
export const ACCENT_WASH = "rgba(252,76,2,.12)";
export const GOLD_WASH = "rgba(255,194,51,.14)";
export const SUCCESS_WASH = "rgba(47,210,125,.12)";
export const BG_HOVER = "#1F1F33";
export const INK4 = "#383B4D";

/* ------------------------------------------------------------------ */
export function Card({ children, style, feat }: { children: ReactNode; style?: ViewStyle; feat?: boolean }) {
  return (
    <View
      style={[
        {
          backgroundColor: feat ? "#141020" : C.bg2,
          borderWidth: 1,
          borderColor: feat ? "rgba(252,76,2,.22)" : LINE,
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
  const bg = tone === "primary" ? ACCENT_WASH : tone === "gold" ? GOLD_WASH : tone === "success" ? SUCCESS_WASH : C.bg3;
  const color = tone === "primary" ? C.accentHi : tone === "gold" ? C.gold : tone === "success" ? C.success : C.ink2;
  return (
    <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: bg, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color }}>{children}</Text>
    </View>
  );
}

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
  const bg = kind === "primary" ? C.accent : kind === "gold" ? C.gold : kind === "danger" ? C.danger : "rgba(255,255,255,.07)";
  const color = kind === "gold" ? "#2A1800" : kind === "ghost" ? C.ink1 : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
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
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          alignSelf: full ? "stretch" : undefined,
        },
        style,
      ]}
    >
      <Text style={{ color, fontSize: sm ? 12.5 : 14, fontWeight: "700", letterSpacing: -0.1 }}>{children}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet — bottom sheet iOS-like sur Modal RN                          */
/* ------------------------------------------------------------------ */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string | null; children: ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: C.bg2,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: LINE,
          maxHeight: "88%",
          paddingBottom: 28,
        }}
      >
        <View style={{ width: 36, height: 4, backgroundColor: "rgba(255,255,255,.18)", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 6 }} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
          {title != null && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: C.ink0, flex: 1 }}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={10} style={{ padding: 6 }}>
                <Text style={{ color: C.ink3, fontSize: 16 }}>✕</Text>
              </Pressable>
            </View>
          )}
          {children}
        </ScrollView>
      </View>
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
        <Btn kind={danger ? "danger" : "primary"} onPress={onConfirm} style={{ flex: 1 }}>
          {confirmLabel}
        </Btn>
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Segment — switch à onglets (Muscles/Exos, 7j/28j, etc.)             */
/* ------------------------------------------------------------------ */
export function Segment<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 12, padding: 3, marginBottom: 16 }}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={{
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: o.value === value ? BG_HOVER : "transparent",
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
/* PickerSheet — liste d'options avec recherche (port du v40)          */
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
    <Sheet open={open} onClose={() => { setQ(""); onClose(); }} title={title}>
      {search && (
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher…"
          placeholderTextColor={C.ink3}
          style={{
            backgroundColor: "rgba(255,255,255,.04)",
            borderWidth: 1,
            borderColor: LINE,
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
            onPress={() => { setQ(""); onPick(o.value); }}
            style={({ pressed }) => ({
              padding: 12,
              borderRadius: 10,
              backgroundColor: pressed ? BG_HOVER : "rgba(255,255,255,.03)",
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
export function Num({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[mono, style]}>{children}</Text>;
}
