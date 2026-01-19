export type ClientReportRow = {
  id: number | string;
  work_date: string; // YYYY-MM-DD
  client_id: number | string | null;
  client_name?: string | null;

  hours: number; // ex: 1.5
  billed_amount: number | null;

  details?: string | null;
};
