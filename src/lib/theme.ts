// Tokens DA — repris à l'identique du CSS v40 (§5 du brief)
export const C = {
  bg0: "#050509",
  bg1: "#0A0A12",
  bg2: "#10101C",
  bg3: "#181828",
  ink0: "#FFFFFF",
  ink1: "#E9E9F2",
  ink2: "#9CA0B5",
  ink3: "#5D6077",
  accent: "#FC4C02",
  accentHi: "#FF6B2C",
  accentLo: "#D63F00",
  gold: "#FFC233",
  success: "#2FD27D",
  danger: "#FF3B48",
};

export const R = { sm: 12, md: 16, lg: 22 };

// Lignes, washes et états — repris du CSS v40 (:root)
export const L = {
  line: "rgba(255,255,255,.06)",
  lineStrong: "rgba(255,255,255,.12)",
  bgHover: "#1F1F33",
  ink4: "#383B4D",
  accentWash: "rgba(252,76,2,.12)",
  accentGlow: "rgba(252,76,2,.28)",
  goldWash: "rgba(255,194,51,.14)",
  successWash: "rgba(47,210,125,.12)",
  dangerWash: "rgba(255,59,72,.12)",
  // Scrim du sticker story Instagram : voile sombre léger derrière le texte
  // pour rester lisible posé sur n'importe quelle photo (base bg0)
  scrim: "rgba(5,5,9,.55)",
};

// Motion — équivalents natifs des tokens --t-*/--ease-* de la v40.
// Springs physiques pour Reanimated (sheets, press states), durées pour le reste.
export const MOTION = {
  // Sheet iOS : spring ferme, sur-amorti juste ce qu'il faut (pas de rebond visible)
  sheetSpring: { damping: 28, stiffness: 320, mass: 0.9 },
  // Micro-interactions (press, toggles)
  microSpring: { damping: 20, stiffness: 400, mass: 0.6 },
  // Durées (ms) — mêmes valeurs que --t-micro/--t-local/--t-ctn/--t-view
  micro: 140,
  local: 220,
  container: 340,
  view: 280,
  // Seuils du drag-to-dismiss des sheets
  dismissDistance: 90, // px de drag vers le bas avant fermeture
  dismissVelocity: 800, // px/s : un flick rapide ferme même avant le seuil
  rubberBand: 0.55, // résistance quand on drag vers le haut (fin de course)
};

// Chiffres en tabular-nums : signature MyLift
import type { TextStyle } from "react-native";
export const mono: TextStyle = {
  fontVariant: ["tabular-nums"],
};
