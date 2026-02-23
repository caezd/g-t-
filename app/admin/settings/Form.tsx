"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveSettings } from "./actions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const Schema = z.object({
  base_allowance_hours: z.coerce.number().min(0).max(999),
  social_charge: z.coerce.number().min(0).max(999),
  notes: z.string().max(1000).optional().nullable(),
});

type FormValues = z.infer<typeof Schema>;

export default function SettingsForm({
  initialValues,
}: {
  initialValues: FormValues;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<"idle" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: initialValues,
  });

  function onSubmit(values: FormValues) {
    const fd = new FormData();
    fd.set("base_allowance_hours", String(values.base_allowance_hours ?? 0));
    fd.set("social_charge", String(values.social_charge ?? 0));
    fd.set("notes", values.notes ?? "");

    startTransition(async () => {
      const res = await saveSettings(fd);
      if (res?.ok) {
        setStatus("success");
        setMessage("Paramètres enregistrés.");
      } else {
        setStatus("error");
        setMessage(res?.message ?? "Erreur inconnue.");
      }
    });
  }

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle>Réglages</CardTitle>
        <CardDescription>
          Ces paramètres s’appliquent à toute l’application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="base_allowance_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Heures couvertes par l’entreprise (déduites)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.25"
                      min={0}
                      placeholder="0"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Appliqué dans le calcul des disponibilités des employés.
                    Ex.: 2.00 retirera 2h de chaque <em>quota_max</em> lors du
                    calcul.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="social_charge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Charge sociale</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Appliqué dans la bible sur le calcul des taux horaire des
                    employés. Nombre décimal. Ex.: 0.15 = 15%.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes internes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Commentaire (optionnel)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
              {status !== "idle" && (
                <span
                  className={
                    status === "success"
                      ? "text-emerald-600 dark:text-emerald-400 text-sm"
                      : "text-rose-600 dark:text-rose-400 text-sm"
                  }
                >
                  {message}
                </span>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
