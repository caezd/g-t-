"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SessionStatus = "checking" | "ready" | "error";

export function UpdatePasswordForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<"div">) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [sessionStatus, setSessionStatus] =
        useState<SessionStatus>("checking");
    const [sessionError, setSessionError] = useState<string | null>(null);

    const router = useRouter();
    const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

    // 1) À l’arrivée sur la page, on recrée la session à partir du hash
    useEffect(() => {
        const supabase = createClient();
        supabaseRef.current = supabase;

        // Si une session existe déjà (user déjà loggué), on ne fait rien
        supabase.auth.getSession().then(async ({ data }) => {
            if (data.session) {
                setSessionStatus("ready");
                return;
            }

            // Sinon, on tente de récupérer la session depuis l’URL (#access_token=...)
            const hash = window.location.hash.startsWith("#")
                ? window.location.hash.slice(1)
                : window.location.hash;

            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");

            if (!accessToken || !refreshToken) {
                setSessionStatus("error");
                setSessionError(
                    "Lien invalide ou expiré. Veuillez demander une nouvelle invitation."
                );
                return;
            }

            const { data: setSessionData, error: setSessionErrorObj } =
                await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

            if (setSessionErrorObj || !setSessionData.session) {
                console.error(setSessionErrorObj);
                setSessionStatus("error");
                setSessionError(
                    "Impossible d'initialiser votre session. Le lien est peut-être expiré. Veuillez demander une nouvelle invitation."
                );
                return;
            }

            // Session OK, on peut afficher le formulaire
            setSessionStatus("ready");
        });
    }, []);

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (sessionStatus !== "ready" || !supabaseRef.current) {
            setError(
                "La session n'est pas prête. Fermez cette page et réessayez via le lien d'invitation."
            );
            return;
        }

        const supabase = supabaseRef.current;

        setIsLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            toast.success("Mot de passe mis à jour !");
            router.push("/"); // ou une route plus logique, ex: "/app"
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Une erreur est survenue"
            );
        } finally {
            setIsLoading(false);
        }
    };

    // État intermédiaire : on prépare la session
    if (sessionStatus === "checking") {
        return (
            <div className={cn("flex flex-col gap-6", className)} {...props}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">
                            Initialisation…
                        </CardTitle>
                        <CardDescription>
                            Nous préparons votre session pour vous permettre de
                            définir votre mot de passe.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Merci de patienter quelques instants.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Erreur de session (lien invalide / expiré)
    if (sessionStatus === "error") {
        return (
            <div className={cn("flex flex-col gap-6", className)} {...props}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">
                            Lien invalide
                        </CardTitle>
                        <CardDescription>
                            Nous n&apos;avons pas pu valider votre session.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-red-500 mb-2">
                            {sessionError ??
                                "Le lien est invalide ou a expiré."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Fermez cette page et demandez une nouvelle
                            invitation à l&apos;administrateur.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Session OK → on affiche ton formulaire normal
    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">
                        Modifier votre mot de passe
                    </CardTitle>
                    <CardDescription>
                        Veuillez entrer votre nouveau mot de passe ci-dessous.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleForgotPassword}>
                        <div className="flex flex-col gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="password">
                                    Nouveau mot de passe
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Nouveau mot de passe"
                                    required
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                />
                            </div>
                            {error && (
                                <p className="text-sm text-red-500">{error}</p>
                            )}
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isLoading}
                            >
                                {isLoading
                                    ? "Enregistrement..."
                                    : "Enregistrer le nouveau mot de passe"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
