// app/components/hint.tsx (ou src/components/hint.tsx)
"use client";

import * as React from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from "@/components/ui/tooltip";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
    Info,
    HelpCircle,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "destructive" | "neutral";
type Variant = "icon" | "pill";

export interface HintProps {
    /** Contenu du hint (texte simple ou contenu riche si `rich` est true) */
    content: React.ReactNode;
    /** Titre optionnel (affiché en mode `rich`) */
    title?: React.ReactNode;
    /** Icône déclencheur si `variant="icon"` ou affichée dans la pastille */
    icon?: LucideIcon;
    /** Apparence du déclencheur */
    variant?: Variant;
    /** Texte visible dans la pastille lorsqu'en `variant="pill"` */
    label?: React.ReactNode;
    /** Couleur/sémantique */
    tone?: Tone;
    /** Affiche un panneau riche (HoverCard) au lieu d’un simple Tooltip */
    rich?: boolean;
    /** Positionnement */
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    /** Déclencheur personnalisé. Par défaut, on rend une icône/pastille. */
    children?: React.ReactNode;
    /** Lien “En savoir plus…” en pied de carte */
    href?: string;
    /** Affiche un raccourci clavier (kbd) dans le tooltip */
    hotkey?: string;
    /** Contrôle externe de l’ouverture (optionnel) */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Classes supplémentaires sur le déclencheur */
    className?: string;
    /** id pour aria-describedby (sinon généré) */
    id?: string;
    /** Taille du déclencheur */
    size?: "sm" | "md";
}

/* Palette utilitaire par “tone” */
const toneStyles: Record<
    Tone,
    { bg: string; text: string; ring: string; kbd: string }
> = {
    info: {
        bg: "",
        text: "",
        ring: "",
        kbd: "",
    },
    success: {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-700 dark:text-emerald-300",
        ring: "ring-emerald-200 dark:ring-emerald-800",
        kbd: "bg-emerald-100 dark:bg-emerald-900/50",
    },
    warning: {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-900 dark:text-amber-200",
        ring: "ring-amber-200 dark:ring-amber-800",
        kbd: "bg-amber-100 dark:bg-amber-900/50",
    },
    destructive: {
        bg: "bg-rose-100 dark:bg-rose-900/30",
        text: "text-rose-700 dark:text-rose-300",
        ring: "ring-rose-200 dark:ring-rose-800",
        kbd: "bg-rose-100 dark:bg-rose-900/50",
    },
    neutral: {
        bg: "bg-zinc-100 dark:bg-zinc-800/50",
        text: "text-zinc-700 dark:text-zinc-300",
        ring: "ring-zinc-200 dark:ring-zinc-800",
        kbd: "bg-zinc-100 dark:bg-zinc-800",
    },
};

const toneIcon: Record<Tone, LucideIcon> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    destructive: XCircle,
    neutral: HelpCircle,
};

export function Hint({
    content,
    title,
    icon,
    variant = "icon",
    label = "Info",
    tone = "info",
    rich = false,
    side = "top",
    align = "center",
    children,
    href,
    hotkey,
    open,
    onOpenChange,
    className,
    id,
    size = "sm",
}: HintProps) {
    const uid = React.useId();
    const descId = id || `hint-${uid}`;
    const Icon = icon ?? toneIcon[tone];
    const styles = toneStyles[tone];

    const trigger =
        children ??
        (variant === "pill" ? (
            <span
                className={cn(
                    "inline-flex select-none items-center gap-1 rounded-full ring-1",
                    styles.bg,
                    styles.text,
                    styles.ring,
                    size === "sm"
                        ? "px-2 py-0.5 text-xs"
                        : "px-2.5 py-1 text-sm",
                    "font-medium shadow-sm",
                    "transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    className
                )}
                role="button"
                tabIndex={0}
                aria-describedby={descId}
            >
                <Icon
                    className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
                />
                <span className="truncate">{label}</span>
            </span>
        ) : (
            <button
                type="button"
                aria-label={
                    typeof title === "string"
                        ? `Info: ${title}`
                        : typeof content === "string"
                        ? `Info: ${content}`
                        : "Information"
                }
                aria-describedby={descId}
                className={cn(
                    "inline-flex items-center justify-center rounded-full",
                    styles.bg,
                    styles.text,
                    styles.ring,
                    size === "sm" ? "h-5 w-5" : "h-6 w-6",
                    "transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    className
                )}
            >
                <Icon
                    className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
                />
            </button>
        ));

    const Body = (
        <div id={descId} className="space-y-2">
            {title ? (
                <div className="text-sm font-medium leading-none">{title}</div>
            ) : null}
            <div className={cn("text-sm", title && "text-muted-foreground")}>
                {content}
            </div>

            {(hotkey || href) && (
                <div className="flex items-center justify-between gap-3 pt-1">
                    {href ? (
                        <a
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                            En savoir plus →
                        </a>
                    ) : (
                        <span />
                    )}
                    {hotkey ? (
                        <kbd
                            className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold",
                                "border border-border",
                                styles.kbd
                            )}
                        >
                            {hotkey}
                        </kbd>
                    ) : null}
                </div>
            )}
        </div>
    );

    if (rich) {
        return (
            <HoverCard open={open} onOpenChange={onOpenChange}>
                <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
                <HoverCardContent side={side} align={align} className="w-80">
                    {Body}
                </HoverCardContent>
            </HoverCard>
        );
    }

    return (
        <TooltipProvider delayDuration={120}>
            <Tooltip open={open} onOpenChange={onOpenChange}>
                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                <TooltipContent side={side} align={align}>
                    {Body}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/* // 1) Icône discrète + tooltip court
<Hint content="Ce champ sera visible par le client." />

// 2) Icône avec autre “tone”
<Hint content="Opération réussie." tone="success" icon={CheckCircle2} />

// 3) Pastille (pill) enrichie avec titre + lien + hotkey
<Hint
  variant="pill"
  label="Aide"
  tone="info"
  rich
  title="Comment ça marche ?"
  content={
    <ul className="list-disc pl-4 space-y-1">
      <li>Les heures sont arrondies au quart d’heure.</li>
      <li>Le quota max est vérifié par mandat.</li>
      <li>Les hors-forfait sont exclus des totaux.</li>
    </ul>
  }
  href="https://exemple.com/docs/feuilles-de-temps"
  hotkey="Shift + ?"
/>

// 4) Envelopper un trigger custom (texte souligné)
<Hint content="Cliquez ici pour en savoir plus.">
  <span className="cursor-help underline decoration-dotted underline-offset-4">
    Qu’est-ce que c’est ?
  </span>
</Hint> */

export default Hint;
