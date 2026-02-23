export const MANDAT_CODE_LABELS = {
  TDL: "Tenu de livre",
  HORS_MANDAT: "Hors mandat",
  ACC: "Accompagnement",
  SOU: "Soutien administratif",
  GES: "Gestion",
  GEST: "Gestion",
};

export function translateMandatCode(code = null) {
  if (!code) return "";
  return MANDAT_CODE_LABELS[code] ?? code;
}
