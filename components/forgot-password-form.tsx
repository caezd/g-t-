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
import Link from "next/link";
import { useState } from "react";

type Step = "request" | "reset" | "done";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [step, setStep] = useState<Step>("request");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

  // Étape 1 : demander l'envoi du code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      // On passe à l'étape 2 : saisie du code
      setStep("reset");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'envoi du code.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Étape 2 : vérifier le code + définir le nouveau mot de passe
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    try {
      // 1) Vérifier le code OTP et créer la session (type = 'recovery')
      const { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "recovery",
        });

      if (verifyError || !verifyData.session) {
        console.error(verifyError);
        setError(
          verifyError?.message ??
            "Code invalide ou expiré. Demande un nouveau courriel de réinitialisation.",
        );
        setIsLoading(false);
        return;
      }

      // 2) Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        console.error(updateError);
        setError(
          updateError.message ?? "Impossible de mettre à jour le mot de passe.",
        );
        setIsLoading(false);
        return;
      }

      setStep("done");
    } catch (err: unknown) {
      console.error(err);
      setError("Une erreur inattendue est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  // Étape 3 : succès
  if (step === "done") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Mot de passe mis à jour</CardTitle>
            <CardDescription>
              Tu peux maintenant te connecter avec ton nouveau mot de passe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-center">
              <Link href="/auth/login" className="underline underline-offset-4">
                Retour à la connexion
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Étape 1 ou 2
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {step === "request"
              ? "Réinitialiser ton mot de passe"
              : "Choisir un nouveau mot de passe"}
          </CardTitle>
          <CardDescription>
            {step === "request"
              ? "Entre ton adresse courriel. Nous t’enverrons un code pour réinitialiser ton mot de passe."
              : "Entre le code reçu par courriel et choisis ton nouveau mot de passe."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "request" ? (
            // FORMULAIRE ÉTAPE 1 : demande d'envoi de code
            <form onSubmit={handleRequestCode}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Courriel</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="moi@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Envoi en cours..." : "Envoyer le code"}
                </Button>

                <div className="mt-4 text-center text-sm">
                  Tu connais ton mot de passe ?{" "}
                  <Link
                    href="/auth/login"
                    className="underline underline-offset-4"
                  >
                    Connexion
                  </Link>
                </div>
              </div>
            </form>
          ) : (
            // FORMULAIRE ÉTAPE 2 : saisie du code + nouveau mot de passe
            <form onSubmit={handleResetPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Courriel</Label>
                  <Input id="email" type="email" value={email} disabled />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="code">Code reçu par courriel</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Nouveau mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="passwordConfirm">
                    Confirmer le mot de passe
                  </Label>
                  <Input
                    id="passwordConfirm"
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? "Enregistrement..."
                    : "Mettre à jour le mot de passe"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
