"use client";

import { useMemo, useState } from "react";

type ConfirmPageClientProps = {
  confirmationUrl: string | null;
};

export default function ConfirmPageClient({
  confirmationUrl,
}: ConfirmPageClientProps) {
  const [clicked, setClicked] = useState(false);

  const { title, description, buttonLabel } = useMemo(() => {
    if (!confirmationUrl) {
      return {
        title: "Lien invalide",
        description:
          "Ce lien de confirmation est incomplet ou ne contient pas l’information attendue.",
        buttonLabel: "",
      };
    }

    let type: string | null = null;
    try {
      const url = new URL(confirmationUrl);
      type = url.searchParams.get("type");
    } catch {
      // on ignore, on reste générique
    }

    if (type === "invite") {
      return {
        title: "Confirmer votre invitation",
        description:
          "Pour finaliser votre invitation, cliquez sur le bouton ci-dessous. Vous serez redirigé vers la page de configuration de votre compte.",
        buttonLabel: "Continuer",
      };
    }

    if (type === "recovery") {
      return {
        title: "Réinitialiser votre mot de passe",
        description:
          "Pour réinitialiser votre mot de passe, cliquez sur le bouton ci-dessous. Vous serez redirigé vers la page pour choisir un nouveau mot de passe.",
        buttonLabel: "Réinitialiser mon mot de passe",
      };
    }

    return {
      title: "Confirmer votre action",
      description:
        "Cliquez sur le bouton ci-dessous pour continuer. Vous serez redirigé vers la page appropriée.",
      buttonLabel: "Continuer",
    };
  }, [confirmationUrl]);

  const handleConfirm = () => {
    if (!confirmationUrl) return;
    setClicked(true);
    // C’est ici qu’on “consomme” réellement le lien Supabase
    window.location.href = confirmationUrl;
  };

  if (!confirmationUrl) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full px-6 py-8 rounded-xl border bg-background">
          <h1 className="text-xl font-semibold mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {description}
            <br />
            Fermez cette page et demandez une nouvelle invitation ou un nouveau
            lien de réinitialisation.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-6 py-8 rounded-xl border bg-background">
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={clicked}
          className="w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border"
        >
          {clicked ? "Redirection en cours..." : buttonLabel}
        </button>

        <p className="mt-4 text-xs text-muted-foreground">
          Si ce lien ne fonctionne pas, fermez cette page et demandez une
          nouvelle invitation ou une nouvelle réinitialisation de mot de passe.
        </p>
      </div>
    </main>
  );
}
