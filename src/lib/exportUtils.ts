import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BRAND } from "./brandConfig";

export interface ExportSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string; // sem extensão
  orientation?: "portrait" | "landscape";
  generatedBy?: string;
  extraSections?: ExportSection[];
}

// ---------- Logo cache ----------
let logoDataUrlCache: string | null = null;
let logoDimsCache: { w: number; h: number } | null = null;

async function getLogoDataUrl(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (logoDataUrlCache && logoDimsCache) {
    return { dataUrl: logoDataUrlCache, ...logoDimsCache };
  }
  try {
    const res = await fetch(BRAND.logo);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    logoDataUrlCache = dataUrl;
    logoDimsCache = dims;
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

function toTitleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("-");
}

function sanitizeFilename(name: string): string {
  const dateStr = format(new Date(), "yyyy-MM-dd");
  // Strip any existing trailing date (yyyy-MM-dd or dd-MM-yyyy)
  let base = name.replace(/[_-]?\d{4}-\d{2}-\d{2}$/, "").replace(/[_-]?\d{2}-\d{2}-\d{4}$/, "");
  // Strip leading "Engemase" if user already included it
  base = base.replace(/^engemase[_-]?/i, "");
  const pretty = toTitleCase(base) || "Relatorio";
  const finalName = `Engemase_${pretty}_${dateStr}`;
  return finalName.replace(/[\\/:*?"<>|]/g, "-");
}

// ---------- PDF ----------
export async function exportToPDF(opts: ExportOptions): Promise<void> {
  const orientation = opts.orientation ?? "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const logo = await getLogoDataUrl();
  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  doc.setProperties({
    title: opts.title,
    author: "Engemase",
    creator: "Sistema de Gestão Integrada Engemase",
    subject: opts.subtitle ?? opts.title,
  });

  const drawHeader = () => {
    // Logo
    if (logo) {
      const targetW = 25;
      const targetH = (logo.h / logo.w) * targetW;
      try {
        doc.addImage(logo.dataUrl, "PNG", 14, 8, targetW, Math.min(targetH, 18));
      } catch {
        /* ignore */
      }
    }
    // Company name + report title
    doc.setTextColor(BRAND.primary[0], BRAND.primary[1], BRAND.primary[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(BRAND.fullName, 44, 14);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(15);
    doc.text(opts.title, 44, 22);
    if (opts.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(opts.subtitle, 44, 28);
    }
    // Separator line
    doc.setDrawColor(BRAND.primary[0], BRAND.primary[1], BRAND.primary[2]);
    doc.setLineWidth(0.6);
    doc.line(14, 31, pageWidth - 14, 31);
    doc.setTextColor(0, 0, 0);
  };

  const drawWatermark = () => {
    const anyDoc = doc as any;
    try {
      anyDoc.saveGraphicsState?.();
      if (anyDoc.GState) {
        anyDoc.setGState(new anyDoc.GState({ opacity: 0.06 }));
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(46);
      doc.setTextColor(BRAND.primary[0], BRAND.primary[1], BRAND.primary[2]);
      // Watermarks aligned along the top-left → bottom-right diagonal,
      // text rotated 45° (reads bottom-to-top), tighter spacing
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const x = pageWidth * t;
        const y = pageHeight * t;
        doc.text(BRAND.watermarkText, x, y, {
          align: "center",
          angle: 45,
        });
      }
      anyDoc.restoreGraphicsState?.();
      doc.setTextColor(0, 0, 0);
    } catch {
      /* ignore */
    }
  };

  autoTable(doc, {
    head: [opts.headers],
    body: opts.rows.map((r) => r.map((c) => (c == null ? "-" : String(c)))),
    startY: 35,
    margin: { top: 35, bottom: 18, left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didDrawPage: () => {
      drawWatermark();
      drawHeader();
    },
  });

  // Extra sections (rendered after main table)
  if (opts.extraSections && opts.extraSections.length > 0) {
    for (const section of opts.extraSections) {
      doc.addPage();
      const startY = 40;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(BRAND.primary[0], BRAND.primary[1], BRAND.primary[2]);
      doc.text(section.title, 14, startY);
      doc.setTextColor(0, 0, 0);
      autoTable(doc, {
        head: [section.headers],
        body: section.rows.map((r) => r.map((c) => (c == null ? "-" : String(c)))),
        startY: startY + 3,
        margin: { top: 35, bottom: 18, left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didDrawPage: () => {
          drawWatermark();
          drawHeader();
        },
      });
    }
  }

  // Footer (second pass for page X of Y)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(BRAND.footerText, 14, pageHeight - 7);
    const center = `Gerado em ${generatedAt}${opts.generatedBy ? ` por ${opts.generatedBy}` : ""}`;
    doc.text(center, pageWidth / 2, pageHeight - 7, { align: "center" });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`${sanitizeFilename(opts.filename)}.pdf`);
}

// ---------- Excel ----------
export function exportToExcel(opts: ExportOptions): void {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const colCount = opts.headers.length;
  const lastColLetter = XLSX.utils.encode_col(colCount - 1);

  const primaryFill = { patternType: "solid", fgColor: { rgb: BRAND.primaryHex } };
  const whiteBoldCenter = {
    font: { bold: true, color: { rgb: BRAND.textOnPrimary }, sz: 14, name: "Arial" },
    alignment: { horizontal: "center", vertical: "center" },
    fill: primaryFill,
  };
  const titleStyle = {
    font: { bold: true, sz: 12, name: "Arial", color: { rgb: "1E40AF" } },
    alignment: { horizontal: "center" },
  };
  const subtitleStyle = {
    font: { italic: true, sz: 10, color: { rgb: "666666" }, name: "Arial" },
    alignment: { horizontal: "center" },
  };
  const headerCellStyle = {
    font: { bold: true, color: { rgb: BRAND.textOnPrimary }, name: "Arial" },
    fill: primaryFill,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left: { style: "thin", color: { rgb: "CCCCCC" } },
      right: { style: "thin", color: { rgb: "CCCCCC" } },
    },
  };
  const bodyBorder = {
    top: { style: "thin", color: { rgb: "E5E7EB" } },
    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
    left: { style: "thin", color: { rgb: "E5E7EB" } },
    right: { style: "thin", color: { rgb: "E5E7EB" } },
  };

  // Row 1: company banner
  XLSX.utils.sheet_add_aoa(ws, [[BRAND.fullName]], { origin: "A1" });
  // Row 2: report title
  XLSX.utils.sheet_add_aoa(ws, [[opts.title]], { origin: "A2" });
  // Row 3: subtitle or generated date
  const subtitleText =
    opts.subtitle ||
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}${
      opts.generatedBy ? ` por ${opts.generatedBy}` : ""
    }`;
  XLSX.utils.sheet_add_aoa(ws, [[subtitleText]], { origin: "A3" });
  // Row 4: empty
  // Row 5: headers
  XLSX.utils.sheet_add_aoa(ws, [opts.headers], { origin: "A5" });
  // Row 6+: rows
  XLSX.utils.sheet_add_aoa(ws, opts.rows, { origin: "A6" });

  // Apply styles
  ws["A1"].s = whiteBoldCenter;
  ws["A2"].s = titleStyle;
  ws["A3"].s = subtitleStyle;
  for (let c = 0; c < colCount; c++) {
    const addr = `${XLSX.utils.encode_col(c)}5`;
    if (ws[addr]) ws[addr].s = headerCellStyle;
  }
  for (let r = 0; r < opts.rows.length; r++) {
    for (let c = 0; c < colCount; c++) {
      const addr = `${XLSX.utils.encode_col(c)}${6 + r}`;
      if (ws[addr]) ws[addr].s = { font: { name: "Arial", sz: 10 }, border: bodyBorder };
    }
  }

  // Merges for header rows
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
  ];

  // Auto column widths
  ws["!cols"] = opts.headers.map((h, i) => {
    const maxData = opts.rows.reduce(
      (m, r) => Math.max(m, String(r[i] ?? "").length),
      h.length
    );
    return { wch: Math.min(Math.max(maxData + 2, 10), 50) };
  });

  // Row heights
  ws["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }];

  // Freeze panes below header row
  (ws as any)["!freeze"] = { ySplit: 5 };
  ws["!ref"] = `A1:${lastColLetter}${5 + opts.rows.length}`;

  XLSX.utils.book_append_sheet(wb, ws, "Relatório");

  // Extra sections as additional sheets
  if (opts.extraSections && opts.extraSections.length > 0) {
    opts.extraSections.forEach((section, idx) => {
      const ws2 = XLSX.utils.aoa_to_sheet([section.headers, ...section.rows]);
      const colCount2 = section.headers.length;
      for (let c = 0; c < colCount2; c++) {
        const addr = `${XLSX.utils.encode_col(c)}1`;
        if (ws2[addr]) ws2[addr].s = headerCellStyle;
      }
      ws2["!cols"] = section.headers.map((h, i) => {
        const maxData = section.rows.reduce((m, r) => Math.max(m, String(r[i] ?? "").length), h.length);
        return { wch: Math.min(Math.max(maxData + 2, 10), 50) };
      });
      const sheetName = (section.title || `Seção ${idx + 1}`).slice(0, 31).replace(/[\\/:*?[\]]/g, "-");
      XLSX.utils.book_append_sheet(wb, ws2, sheetName);
    });
  }

  XLSX.writeFile(wb, `${sanitizeFilename(opts.filename)}.xlsx`);
}
