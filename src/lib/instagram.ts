// Partage DIRECT vers l'éditeur de story Instagram (façon Strava) : sticker
// PNG transparent posé dans l'éditeur via le schéma instagram-stories://share.
//
// PROD/BUILD — deux prérequis hors Expo Go, déjà préparés :
// 1. LSApplicationQueriesSchemes ["instagram", "instagram-stories"] déclaré
//    dans app.json (pris en compte au build EAS, sans effet en Expo Go).
// 2. react-native-share fournit le pont natif (pasteboard avec les clés
//    com.instagram.sharedSticker.*) — son natif est compilé automatiquement
//    au build EAS (autolinking). Dans Expo Go il n'existe PAS : son import
//    jette (TurboModuleRegistry.getEnforcing), d'où le require paresseux
//    sous try/catch → on retombe proprement sur le share sheet iOS.
// 3. META_APP_ID : Instagram exige un App ID Meta (developers.facebook.com)
//    pour attribuer la source. À créer et renseigner avant le build EAS.
import { Platform, Linking } from "react-native";
import Constants from "expo-constants";
import { C } from "./theme";

// App ID Meta de l'app « mylift » (developers.facebook.com). Identifiant
// PUBLIC (il voyage dans le client) — pas un secret.
export const META_APP_ID = "28068119842784335";
// Sans App ID Meta, Instagram accepte en pratique le partage de sticker via le
// pasteboard (l'ID sert surtout à l'attribution). On tente donc TOUJOURS le
// chemin direct avec un identifiant de repli ; en cas de refus, le catch
// ramène au share sheet — aucun chemin perdant.
const EFFECTIVE_APP_ID = META_APP_ID || "com.maxime.mylift";

// Expo Go n'embarque PAS le natif de react-native-share : même sous try/catch,
// l'Invariant Violation du TurboModuleRegistry remonte au gestionnaire global
// et fait un redbox (crash vécu). On ne tente donc JAMAIS le require dans
// Expo Go — en build EAS (appOwnership ≠ "expo"), le module est autolinked.
const IN_EXPO_GO = Constants.appOwnership === "expo";

function loadRNShare(): { default: { shareSingle: (o: object) => Promise<unknown> } } | null {
  if (IN_EXPO_GO) return null;
  try {
    return require("react-native-share");
  } catch {
    return null;
  }
}

/** Instagram installé + pont natif présent (build EAS) ? */
export async function canShareToInstagramStories(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  const share = loadRNShare();
  if (!share?.default?.shareSingle) return false;
  try {
    return await Linking.canOpenURL("instagram-stories://share?source_application=" + EFFECTIVE_APP_ID);
  } catch {
    return false;
  }
}

/** Pose le sticker transparent dans l'éditeur de story Instagram.
 *  Renvoie true si Instagram s'est ouvert, false → l'appelant fait le fallback
 *  share sheet iOS. Ne jette jamais. */
export async function shareStickerToInstagramStories(stickerUri: string): Promise<boolean> {
  if (!(await canShareToInstagramStories())) return false;
  const share = loadRNShare();
  if (!share) return false;
  try {
    await share.default.shareSingle({
      social: "instagramstories",
      appId: EFFECTIVE_APP_ID,
      stickerImage: stickerUri,
      // Fond dégradé DA par défaut derrière le sticker — l'utilisateur peut le
      // remplacer par sa propre photo dans l'éditeur Instagram.
      backgroundTopColor: C.bg1,
      backgroundBottomColor: C.bg0,
    });
    return true;
  } catch {
    return false;
  }
}
