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

import { pluralize } from "@/lib/pluralize";

export default async function ClientPage({ params }) {
    const supabase = await createClient();
    const { id } = params;
    const clientId = parseInt(id, 10);

    const { data: client } = await supabase
        .from("clients")
        .select("*, clients_mandats(*), clients_team(*)")
        .eq("id", clientId)
        .single();

    return (
        <>
            <section className="p-8 flex flex-col gap-4">
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
                                    count: client?.clients_mandats.length,
                                    inclusive: true,
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 flex lg:mt-0 lg:ml-4">
                        <span className="hidden sm:block">
                            <Button>
                                <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    data-slot="icon"
                                    aria-hidden="true"
                                    className="mr-1.5 -ml-0.5 size-5 text-white"
                                >
                                    <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
                                </svg>
                                Edit
                            </Button>
                        </span>

                        <span className="ml-3 hidden sm:block">
                            <Button>View</Button>
                        </span>

                        <span className="sm:ml-3">
                            <Button
                                type="button"
                                className="inline-flex items-center rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                            >
                                Publish
                            </Button>
                        </span>
                    </div>
                </header>
                <section className="grid grid-cols-3">
                    <Card className="col-span-1 lg:col-start-3 ">
                        <CardHeader>
                            <CardTitle>Équipe</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ClientTeamList clientId={clientId} />
                        </CardContent>
                    </Card>
                </section>
            </section>
        </>
    );
}
