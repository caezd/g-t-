import { createClient } from "@/lib/supabase/server";

import { CalendarRange, ChevronRight } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientTeamList } from "@/components/admin/clients/TeamDialog";
import { MandateTimeEntriesCard } from "@/components/admin/clients/MandateTimeEntriesCard";

import { pluralize } from "@/lib/pluralize";

export default async function ClientPage({ params }) {
    const supabase = await createClient();
    const { id } = await params;
    const clientId = parseInt(id, 10);

    const { data: client } = await supabase
        .from("clients")
        .select("*, clients_mandats(*), clients_team(*)")
        .eq("id", clientId)
        .single();

    return (
        <>
            <section className="p-8 flex w-full flex-col gap-4">
                <header className="lg:flex lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                        <nav className="flex">
                            <ol className="flex items-center space-x-4">
                                <li className="flex items-center">
                                    <Link
                                        href="/admin/clients"
                                        className="font-medium text-zinc-600 dark:text-zinc-400 text-sm hover:text-zinc-900"
                                    >
                                        Clients
                                    </Link>
                                </li>
                                <li className="flex items-center">
                                    <ChevronRight className="w-4" />
                                    <span className="ml-4 font-medium text-zinc-600 dark:text-zinc-400 text-sm ">
                                        {client?.name}
                                    </span>
                                </li>
                            </ol>
                        </nav>
                        <h2 className="text-2xl/7 font-bold sm:truncate sm:text-3xl sm:tracking-tight mt-2">
                            {client?.name}
                        </h2>
                        <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
                            <div className="mt-2 flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                                <CalendarRange className="mr-2" />
                                {pluralize("Mandat", {
                                    count: client?.clients_mandats.length - 1,
                                    inclusive: true,
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 flex lg:mt-0 lg:ml-4">
                        <span className="hidden sm:block">
                            <Button>Modifier</Button>
                        </span>
                    </div>
                </header>
                <section className="w-full grid lg:grid-cols-3 gap-8 mt-12">
                    <div className="col-span-2">
                        {client?.clients_mandats.map((mandat) => (
                            <MandateTimeEntriesCard
                                key={mandat.id}
                                mandat={mandat}
                                clientId={clientId}
                            />
                        ))}
                    </div>
                    <div className="col-span-1 lg:col-start-3">
                        <h2 className="text-lg font-medium mb-4">Équipe</h2>
                        <ClientTeamList clientId={clientId} />
                    </div>
                </section>
            </section>
        </>
    );
}
