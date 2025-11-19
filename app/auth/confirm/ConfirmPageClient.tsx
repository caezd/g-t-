// app/auth/confirm/ConfirmPageClient.tsx
"use client";

import { useState } from "react";

type ConfirmPageClientProps = {
    confirmationUrl: string | null;
};

export default function ConfirmPageClient({
    confirmationUrl,
}: ConfirmPageClientProps) {
    const [clicked, setClicked] = useState(false);

    const handleConfirm = () => {
        if (!confirmationUrl) return;
        setClicked(true);
        // On laisse Supabase gérer la vérification du token + redirection
        window.location.href = confirmationUrl;
    };

    // Cas où l'URL ne contient pas confirmation_url
    if (!confirmationUrl) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="max-w-md w-full px-6 py-8 rounded-xl border bg-background">
                    <h1 className="text-xl font-semibold mb-2">
                        Lien invalide
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Ce lien de confirmation est incomplet ou ne contient pas
                        l'information attendue.
                        <br />
                        Fermez cette page et demandez une nouvelle invitation.
                    </p>
                </div>
            </main>
        );
    }

    // Cas normal : on a bien confirmationUrl
    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="max-w-md w-full px-6 py-8 rounded-xl border bg-background">
                <h1 className="text-xl font-semibold mb-2">
                    Confirmer votre invitation
                </h1>
                <p className="text-sm text-muted-foreground mb-6">
                    Pour finaliser votre invitation, cliquez sur le bouton
                    ci-dessous. Vous serez redirigé vers la page de
                    configuration de votre compte.
                </p>

                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={clicked}
                    className="w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border"
                >
                    {clicked ? "Redirection en cours..." : "Continuer"}
                </button>

                <p className="mt-4 text-xs text-muted-foreground">
                    Si ce lien ne fonctionne pas, fermez cette page et demandez
                    une nouvelle invitation.
                </p>
            </div>
        </main>
    );
}
