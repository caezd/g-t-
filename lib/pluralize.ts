// pluralize.ts
type Locale = "en" | "fr";
type PluralOpts = {
    count?: number; // 0,1,2… si fourni, choisit auto singulier/pluriel
    inclusive?: boolean; // si true et count fourni => "1 item" / "2 items"
    irregulars?: Record<string, string>; // surcharge personnalisée singulier->pluriel
};

const irregularEn: Record<string, string> = {
    person: "people",
    man: "men",
    woman: "women",
    child: "children",
    mouse: "mice",
    goose: "geese",
    tooth: "teeth",
    foot: "feet",
    cactus: "cacti",
    nucleus: "nuclei",
    radius: "radii",
    analysis: "analyses",
    axis: "axes",
};

const rulesEn: Array<[RegExp, string]> = [
    [/([^aeiou])y$/i, "$1ies"], // city -> cities
    [/(s|sh|ch|x|z)$/i, "$1es"], // bus -> buses, box -> boxes
    [/(?:f|fe)$/i, "ves"], // knife -> knives, leaf -> leaves
    [/([aeiou]o)$/i, "$1s"], // studio -> studios
    [/o$/i, "oes"], // hero -> heroes
    [/us$/i, "i"], // cactus -> cacti (also in irregulars)
    [/is$/i, "es"], // analysis -> analyses
    [/$/i, "s"], // défaut
];

const irregularFr: Record<string, string> = {
    // -al -> -aux (exceptions gérées plus bas)
    travail: "travaux",
    vitrail: "vitraux",
    bail: "baux",
    corail: "coraux",
    émail: "émaux",
    fermail: "fermeaux",
    soupirail: "soupiraux",
    // exceptions -eu/-eau/-au qui prennent -s
    bleu: "bleus",
    pneu: "pneus",
    landau: "landaus",
    sarrau: "sarraus",
};

const exceptionsAlToS = new Set([
    "bal",
    "carnaval",
    "chacal",
    "festival",
    "récital",
    "régal",
    "cal",
    "caracal",
]);

const rulesFr: Array<(w: string) => string | null> = [
    // mots terminant par s, x, z : invariable
    (w) => (/[sxz]$/i.test(w) ? w : null),

    // -al -> -aux (sauf exceptions) : cheval -> chevaux
    (w) =>
        /al$/i.test(w) && !exceptionsAlToS.has(w.toLowerCase())
            ? w.replace(/al$/i, "aux")
            : null,

    // -eau -> -eaux (sauf exceptions déjà dans irregularFr)
    (w) => (/eau$/i.test(w) ? w.replace(/eau$/i, "eaux") : null),

    // -eu -> -eux (sauf exceptions déjà dans irregularFr)
    (w) => (/eu$/i.test(w) ? w.replace(/eu$/i, "eux") : null),

    // -au -> -aux (sauf exceptions déjà dans irregularFr)
    (w) => (/au$/i.test(w) ? w.replace(/au$/i, "aux") : null),

    // -ail -> en général -s (mais quelques irréguliers sont dans irregularFr)
    (w) => (/ail$/i.test(w) ? w + "s" : null),

    // défaut : +s
    (w) => w + "s",
];

function pluralEn(word: string, irregulars?: Record<string, string>): string {
    const low = word.toLowerCase();
    const irr = { ...irregularEn, ...(irregulars || {}) };
    if (irr[low]) {
        // conserve la casse de départ (simple heuristique)
        return matchCase(word, irr[low]);
    }
    for (const [re, rep] of rulesEn) {
        if (re.test(word)) {
            return word.replace(re, rep);
        }
    }
    return word + "s";
}

function pluralFr(word: string, irregulars?: Record<string, string>): string {
    const low = word.toLowerCase();
    const irr = { ...irregularFr, ...(irregulars || {}) };
    if (irr[low]) return matchCase(word, irr[low]);
    for (const rule of rulesFr) {
        const out = rule(word);
        if (out) return out;
    }
    return word + "s";
}

// Heuristique simple pour garder la casse (City -> Cities / CITY -> CITIES)
function matchCase(src: string, dst: string): string {
    if (src === src.toUpperCase()) return dst.toUpperCase();
    if (src[0] === src[0].toUpperCase())
        return dst[0].toUpperCase() + dst.slice(1);
    return dst;
}

/**
 * pluralize("item", {count:1})      -> "item"
 * pluralize("item", {count:2})      -> "items"
 * pluralize("cheval","fr")          -> "chevaux"
 * pluralize("bleu","fr")            -> "bleus" (exception)
 * pluralize("studio","en")          -> "studios"
 * pluralize("knife","en")           -> "knives"
 * pluralize("travail","fr")         -> "travaux"
 * pluralize("analysis","en")        -> "analyses"
 */
export function pluralize(
    word: string,
    localeOrOpts: Locale | PluralOpts = "en",
    maybeOpts: PluralOpts = {}
): string {
    const locale: Locale =
        typeof localeOrOpts === "string" ? localeOrOpts : "en";
    const opts: PluralOpts =
        typeof localeOrOpts === "string" ? maybeOpts : localeOrOpts;

    const toPlural =
        locale === "fr"
            ? pluralFr(word, opts.irregulars)
            : pluralEn(word, opts.irregulars);

    if (typeof opts.count === "number") {
        const chosen = opts.count === 1 ? word : toPlural;
        return opts.inclusive ? `${opts.count} ${chosen}` : chosen;
    }
    return toPlural;
}
