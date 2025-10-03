import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const ClientPage = async () => {
    const supabase = await createClient();
    const { data: clients, error } = await supabase.from("clients").select("*");
    console.log(clients, error);
    return (
        <>
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="md:flex md:items-center md:justify-between">
                        <div className="flex-1 min-w-0">
                            <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                                Gestion des clients
                            </h1>
                        </div>
                        <div className="flex mt-4 md:mt-0 md:ml-4">
                            <Button>Créer un client</Button>
                        </div>
                    </div>
                    <section className="mt-8 py-2 sm:py-6 lg:py-8">
                        <table className="min-w-full relative divide-y divide-zinc-200 dark:divide-zinc-800">
                            <thead>
                                <tr>
                                    {/* Table headers */}
                                    {["Nom", "Client depuis"].map(
                                        (header, i) => (
                                            <th
                                                scope="col"
                                                key={i}
                                                className="text-white py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-0"
                                            >
                                                {header}
                                            </th>
                                        )
                                    )}
                                    <th
                                        scope="col"
                                        className="text-white py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pr-0"
                                    >
                                        <span className="sr-only">Edit</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients &&
                                    clients.map((client) => (
                                        <tr key={client.id}>
                                            <td className="text-white py-4 pr-3 pl-4 text-sm sm:pl-0">
                                                {client.name}
                                            </td>
                                            <td className="text-white py-4 pr-3 pl-4 text-sm sm:pl-0">
                                                {new Date(
                                                    client.created_at
                                                ).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                >
                                                    Modifier
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </section>
                </div>
            </div>
        </>
    );
};

export default ClientPage;
