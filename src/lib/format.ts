// Formatters — port fidèle des helpers d'affichage de v40-reference/app.jsx
export const pad2 = (n: number) => (n < 10 ? "0" + n : "" + n);

export const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
export const MONTHS_FR_S = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
export const DOW_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const DOW_FR_S = ["L", "M", "M", "J", "V", "S", "D"];

export function formatDate(isoStr: string) {
  const [, m, d] = isoStr.split("-").map(Number);
  return `${d} ${MONTHS_FR_S[m - 1]}`;
}

export function formatRelative(isoStr: string | null | undefined) {
  if (!isoStr) return "—";
  const diff = (Date.now() - new Date(isoStr).getTime()) / 86400000;
  if (diff < 1) return "aujourd'hui";
  if (diff < 2) return "hier";
  if (diff < 7) return "il y a " + Math.floor(diff) + " j";
  if (diff < 30) return "il y a " + Math.floor(diff / 7) + " sem.";
  return "il y a " + Math.floor(diff / 30) + " mois";
}

export function formatDur(sec: number | null | undefined) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60),
    s = sec % 60;
  if (m < 60) return `${m}m${pad2(s)}`;
  const h = Math.floor(m / 60),
    mm = m % 60;
  return `${h}h${pad2(mm)}`;
}

export function formatNum(n: number | null | undefined, dec = 0) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 10000) return (n / 1000).toFixed(1) + "k";
  if (abs >= 1000) return (n / 1000).toFixed(2) + "k";
  return Number(n)
    .toFixed(dec)
    .replace(/\.0+$/, "");
}
