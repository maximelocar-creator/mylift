// Pipeline image partagé (avatar + photos de posts) — pièges déjà payés :
// fetch(file://).arrayBuffer() n'est pas fiable en RN → octets décodés du
// base64 ; si le bucket Storage est absent/refusé → repli data-URI compressé.
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

// base64 → Uint8Array (sans dépendre d'atob)
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i + 3 < clean.length + 1; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    if (o < len) out[o++] = (n >> 16) & 255;
    if (o < len && clean[i + 2] !== undefined) out[o++] = (n >> 8) & 255;
    if (o < len && clean[i + 3] !== undefined) out[o++] = n & 255;
  }
  return out;
}

export type PickedImage = { uri: string; base64: string };

/** Galerie → compression max 1080px JPEG (contrainte de coût CLAUDE.md). */
export async function pickFromLibrary(square = false): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 1,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return compress(res.assets[0].uri);
}

/** Appareil photo → même compression. */
export async function takePhoto(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  return compress(res.assets[0].uri);
}

async function compress(uri: string): Promise<PickedImage | null> {
  const m = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1080 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return m.base64 ? { uri: m.uri, base64: m.base64 } : null;
}

/**
 * Upload vers un bucket Storage public → URL publique. Si le bucket est
 * absent/refusé (RLS), repli en data-URI recompressé (`fallbackWidth`) stocké
 * tel quel dans la colonne texte — la fonctionnalité marche sans action
 * dashboard, migration Storage possible plus tard.
 */
export async function uploadImage(bucket: string, path: string, img: PickedImage, fallbackWidth = 640): Promise<string> {
  const bytes = base64ToBytes(img.base64);
  const { error } = await supabase.storage.from(bucket).upload(path, bytes.buffer as ArrayBuffer, { contentType: "image/jpeg", upsert: true });
  if (!error) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl + "?t=" + Date.now();
  }
  const small = await ImageManipulator.manipulateAsync(img.uri, [{ resize: { width: fallbackWidth } }], {
    compress: 0.6,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!small.base64) throw new Error("Image : " + error.message);
  return "data:image/jpeg;base64," + small.base64;
}
