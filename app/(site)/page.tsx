import { TimeEntryForm } from "@/components/forms/TimeEntryForm";
import { ThemeSwitcher } from "@/components/theme-switcher";

import { cn } from "@/lib/utils";

import { getDateWeek, weekRange } from "@/utils/date";

export default async function HomePage() {
    const stats = [
        {
            label: `Du ${weekRange(new Date()).first.getDate()} au`,
            amount: `${weekRange(new Date()).last.getDate()} ${weekRange(
                new Date()
            ).last.toLocaleString("default", { month: "short" })}`,
        },
        {
            label: "Heures facturées",
            amount: 32.5,
            unit: "hrs",
        },
        {
            label: "Banque disponible",
            amount: 40 - 7.5,
            unit: "hrs",
            conditionalStyle: {
                positive: "dark:text-green-400 text-green-500",
                negative: "dark:text-red-400 text-red-500",
            },
        },
    ];
    return (
        <>
            <main className="lg:pr-96">
                <div className="dark:bg-zinc-700/10 bg-zinc-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {stats.map((item, i) => (
                        <div
                            className={cn(
                                "border-zinc-200 dark:border-zinc-800 px-4 py-6 sm:px-6 lg:px-8",
                                i > 0 && "sm:border-l"
                            )}
                            key={i}
                        >
                            <p
                                className={
                                    "text-sm font-medium leading-6 dark:text-zinc-400"
                                }
                            >
                                {item.label}
                            </p>
                            <p className={"mt-2 flex items-baseline gap-x-2"}>
                                <span
                                    className={cn(
                                        "dark:text-white text-4xl font-semibold -tracking-tight whitespace-nowrap",
                                        item.conditionalStyle &&
                                            (item.amount >= 0
                                                ? item.conditionalStyle
                                                      ?.positive
                                                : item.conditionalStyle
                                                      ?.negative)
                                    )}
                                >
                                    {item.amount}
                                </span>
                                {item.unit && (
                                    <span
                                        className={cn(
                                            "text-sm dark:text-zinc-400",
                                            item.conditionalStyle &&
                                                (item.amount >= 0
                                                    ? item.conditionalStyle
                                                          ?.positive
                                                    : item.conditionalStyle
                                                          ?.negative)
                                        )}
                                    >
                                        {item.unit}
                                    </span>
                                )}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="border-t border-zinc-200 dark:border-zinc-800 flex px-4 py-4 sm:px-6 lg:px-8">
                    <TimeEntryForm />
                </div>
            </main>
            <aside className="lg:fixed lg:bottom-0 lg:right-0 lg:top-16 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-zinc-200 dark:lg:border-zinc-800"></aside>
        </>
    );
}
