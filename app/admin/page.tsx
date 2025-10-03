import { cn } from "@/lib/utils";
import { getSession } from "@/lib/supabase/server";

export default async function Home() {
    const session = await getSession();

    const stats = [
        {
            label: "test",
            amount: 500,
        },
        {
            label: "test",
            amount: 32,
            unit: "mins",
        },
    ];
    return (
        <>
            <header>
                <div className="border-b grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {stats.map((item, i) => (
                        <div
                            className={cn(
                                " px-4 py-6 sm:px-6 lg:px-8",
                                i > 0 && "sm:border-l"
                            )}
                            key={i}
                        >
                            <p
                                className={
                                    "text-sm font-medium leading-6 text-zinc-600"
                                }
                            >
                                {item.label}
                            </p>
                            <p className="mt-2 flex items-baseline gap-x-2">
                                <span className="text-4xl font-semibold -tracking-tight">
                                    {item.amount}
                                </span>
                                {item.unit && (
                                    <span className="text-sm text-zinc-600">
                                        {item.unit}
                                    </span>
                                )}
                            </p>
                        </div>
                    ))}
                </div>
            </header>
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-10">
                <h2 className="px-4 text-base font-semibold leading-7 text-white sm:px-6 lg:px-8">
                    Dernière activité
                </h2>
                <table className="mt-6 w-full whitespace-nowrap text-left"></table>
            </div>
        </>
    );
}
