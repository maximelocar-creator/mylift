// Auth sociale — Sign in with Apple + Google via Supabase.
// ⚠ Les deux providers exigent un build EAS natif (config Apple/Google côté
// Supabase + entitlements) : câblés ici, à VALIDER au premier build custom.
// En Expo Go : Apple indisponible (module natif), Google peut échouer selon la
// config de redirection — l'email/mdp reste le chemin de test.
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export async function appleAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<{ error: string | null }> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) return { error: "Pas de jeton Apple reçu." };
    const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken });
    return { error: error?.message ?? null };
  } catch (e: any) {
    if (e?.code === "ERR_REQUEST_CANCELED") return { error: null }; // annulé par l'utilisateur
    return { error: e?.message ?? String(e) };
  }
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  try {
    const redirectTo = Linking.createURL("auth-callback"); // mylift://auth-callback
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: "URL d'authentification manquante." };
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success" || !result.url) return { error: null }; // annulé
    // Échange du code PKCE contre une session
    const url = new URL(result.url);
    const code = url.searchParams.get("code");
    if (code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      return { error: exErr?.message ?? null };
    }
    // Fallback implicit flow : tokens dans le fragment
    const params = new URLSearchParams(result.url.split("#")[1] || "");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
      return { error: sErr?.message ?? null };
    }
    return { error: "Session Google non établie." };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}
