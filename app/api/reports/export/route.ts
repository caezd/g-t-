export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientReportRows } from "@/lib/getClientReportRows";
import { ymdFromDate } from "@/utils/date";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

function safeFilePart(s: string) {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function formatCanadianDateYMD(ymd: string) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return ymd;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function toExcelDate(v: any): Date | null {
  if (!v) return null;

  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v : null;
  }

  if (typeof v === "string") {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(`${v}T00:00:00`);
      return Number.isFinite(d.getTime()) ? d : null;
    }

    // DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(v)) {
      const [dd, mm, yyyy] = v.split("-");
      const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
      return Number.isFinite(d.getTime()) ? d : null;
    }

    // ISO (ou autre parseable)
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // timestamp numérique éventuel
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  return null;
}

function toNum(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const normalized = v.replace(/\s/g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function buildXlsx(
  rows: any[],
  meta: { title: string; from: string; to: string },
  opts: { includeClientName: boolean },
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FocusTDL";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rapport");

  ws.columns = opts.includeClientName
    ? [
        { header: "Date", key: "doc", width: 12 },
        { header: "Client", key: "client_name", width: 28 },
        { header: "Heures facturées", key: "billed_amount", width: 16 },
        { header: "Détails", key: "details", width: 50 },
      ]
    : [
        { header: "Date", key: "doc", width: 12 },
        { header: "Heures facturées", key: "billed_amount", width: 16 },
        { header: "Détails", key: "details", width: 50 },
      ];

  // jj-mm-aaaa (avec tirets)
  ws.getColumn("doc").numFmt = "dd-mm-yyyy";

  ws.addRow([meta.title]);
  ws.addRow([`Période: ${meta.from} au ${meta.to}`]);
  ws.addRow([]);

  const headerRowIndex = ws.lastRow!.number + 1;
  ws.addRow(ws.columns.map((c) => c.header as string));
  ws.getRow(headerRowIndex).font = { bold: true };

  for (const r of rows) {
    ws.addRow(
      opts.includeClientName
        ? {
            doc: toExcelDate(r.doc),
            client_name: r.client_name ?? r.client_id ?? "—",
            billed_amount: toNum(r.billed_amount),
            details: r.details ?? "",
          }
        : {
            doc: toExcelDate(r.doc),
            billed_amount: toNum(r.billed_amount),
            details: r.details ?? "",
          },
    );
  }

  const totalBilled = rows.reduce(
    (s, r) => s + (Number(r.billed_amount) || 0),
    0,
  );

  ws.addRow([]);
  const totalRow = ws.addRow(
    opts.includeClientName
      ? {
          doc: "",
          client_name: "TOTAL",
          billed_amount: totalBilled,
          details: "",
        }
      : { doc: "TOTAL", billed_amount: totalBilled, details: "" },
  );

  totalRow.font = { bold: true };

  ws.views = [{ state: "frozen", ySplit: headerRowIndex }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function buildPdf(
  rows: any[],
  meta: { title: string; from: string; to: string },
) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const stream = new PassThrough();
  doc.pipe(stream);

  doc.fontSize(16).text(meta.title, { align: "left" });
  doc.moveDown(0.25);
  doc.fontSize(10).text(`Période: ${meta.from} au ${meta.to}`);
  doc.moveDown(1);

  // Table layout simple
  const col = {
    date: 70,
    client: 180,
    hours: 60,
    amount: 80,
    details: 0, // reste
  };

  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const detailsWidth =
    pageWidth - (col.date + col.client + col.hours + col.amount);

  const x0 = doc.page.margins.left;
  let y = doc.y;

  function header() {
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Date", x0, y, { width: col.date });
    doc.text("Client", x0 + col.date, y, { width: col.client });
    doc.text("Heures", x0 + col.date + col.client, y, {
      width: col.hours,
      align: "right",
    });
    doc.text("Montant", x0 + col.date + col.client + col.hours, y, {
      width: col.amount,
      align: "right",
    });
    doc.text(
      "Détails",
      x0 + col.date + col.client + col.hours + col.amount,
      y,
      { width: detailsWidth },
    );

    doc
      .moveTo(x0, y + 12)
      .lineTo(x0 + pageWidth, y + 12)
      .stroke();
    doc.font("Helvetica");
    y += 18;
  }

  function ensureSpace(minHeight: number) {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (y + minHeight > bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      header();
    }
  }

  header();

  doc.fontSize(9);

  for (const r of rows) {
    const date = r.doc ?? "";
    const client = r.client_name ?? String(r.client_id ?? "—");
    const hours = (Number(r.hours) || 0).toFixed(2);
    const amount = (Number(r.billed_amount) || 0).toFixed(2);
    const details = r.details ?? "";

    // hauteur estimée via details (naïf mais efficace)
    const hDetails = doc.heightOfString(details, { width: detailsWidth });
    const rowH = Math.max(12, hDetails);

    ensureSpace(rowH + 6);

    doc.text(date, x0, y, { width: col.date });
    doc.text(client, x0 + col.date, y, { width: col.client });
    doc.text(hours, x0 + col.date + col.client, y, {
      width: col.hours,
      align: "right",
    });
    doc.text(amount, x0 + col.date + col.client + col.hours, y, {
      width: col.amount,
      align: "right",
    });
    doc.text(details, x0 + col.date + col.client + col.hours + col.amount, y, {
      width: detailsWidth,
    });

    y += rowH + 6;
  }

  const totalHours = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const totalBilled = rows.reduce(
    (s, r) => s + (Number(r.billed_amount) || 0),
    0,
  );

  ensureSpace(24);
  doc
    .moveTo(x0, y)
    .lineTo(x0 + pageWidth, y)
    .stroke();
  y += 8;
  doc.font("Helvetica-Bold");
  doc.text("TOTAL", x0 + col.date, y, { width: col.client });
  doc.text(totalHours.toFixed(2), x0 + col.date + col.client, y, {
    width: col.hours,
    align: "right",
  });
  doc.text(totalBilled.toFixed(2), x0 + col.date + col.client + col.hours, y, {
    width: col.amount,
    align: "right",
  });
  doc.font("Helvetica");

  doc.end();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId"); // "all" ou id
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const format = url.searchParams.get("format"); // "pdf" | "xlsx"
  const includeClientName = ["1", "true", "on", "yes"].includes(
    (url.searchParams.get("includeClientName") ?? "").toLowerCase(),
  );

  if (!from || !to || !format) {
    return NextResponse.json(
      { error: "Missing from/to/format" },
      { status: 400 },
    );
  }
  if (format !== "pdf" && format !== "xlsx") {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const rows = await getClientReportRows({
      supabase,
      clientId: clientId ?? "all",
      fromYMD: from,
      toYMD: to,
    });

    const title =
      clientId && clientId !== "all" ? "Rapport client" : "Rapport clients";
    const baseName = safeFilePart(`${title}_${from}_${to}`);

    if (format === "xlsx") {
      const buffer = await buildXlsx(
        rows,
        { title, from, to },
        { includeClientName },
      );
      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    const buffer = await buildPdf(rows, { title, from, to });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
