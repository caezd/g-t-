// lib/commandFilter.ts (par ex.)
export function prefixThenFuzzyFilter(value: string, search: string) {
  const v = value
    .toLocaleLowerCase("fr-CA")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const s = search
    .trim()
    .toLocaleLowerCase("fr-CA")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!s) return 1; // tout passe si pas de recherche

  // 1 ou 2 lettres → on exige que ça commence par…
  if (s.length <= 2) {
    return v.startsWith(s) ? 1 : 0;
  }

  // 3+ lettres → "fuzzy" simple : n'importe où dans le label
  return v.includes(s) ? 1 : 0;
}
