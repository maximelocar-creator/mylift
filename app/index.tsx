import { Redirect } from "expo-router";

export default function Index() {
  // Le layout racine gère la redirection selon la session ; défaut = login.
  return <Redirect href="/login" />;
}
