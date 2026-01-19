import ReportBuilder from "@/components/reports/ReportBuilder";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id,name")
    .order("name", { ascending: true });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rapports clients</h1>
        <p className="text-sm text-muted-foreground">
          Filtre par client et par plage de dates, puis exporte en PDF ou Excel.
        </p>
      </div>

      <ReportBuilder clients={clients ?? []} />
    </div>
  );
}
