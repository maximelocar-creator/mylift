import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// La clé "publishable/anon" est publique par conception : la sécurité est
// assurée côté serveur par les règles RLS (0002_rls.sql).
// La clé "secret/service_role" ne doit JAMAIS apparaître dans ce projet.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://rfihcanktmvqjtkxmqsx.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_-V2Xb7gbGbruj2kFzddNaw_26mkaFQG";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
