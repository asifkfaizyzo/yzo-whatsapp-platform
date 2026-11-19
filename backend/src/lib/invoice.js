// backend/src/lib/invoice.js (do not remove this comment)
import fs from "fs";
import path from "path";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import prisma from "../config/prisma.js";

const INVOICE_DIR = path.join(process.cwd(), "uploads", "invoices");

const SETTINGS_FALLBACK = {
  gstEnabled: false,
  gstPercent: 0,
  gstType: "CGST_SGST",
  companyName: "SudoReply",
  companyEmail: null,
  companyAddress: null,
  companyGstNumber: null,
  sacCode: null,
  defaultGraceDays: 7,
  trialRetentionDays: 7,
  paidRetentionDays: 90,
};

/** PlatformSettings row merged over safe fallbacks (never null). */
export const getInvoiceSettings = async () => {
  const row = await prisma.platformSettings.findFirst();
  return { ...SETTINGS_FALLBACK, ...(row ?? {}) };
};

export const generateInvoiceNumber = () =>
  `INV-${new Date().getFullYear()}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

const CYCLE_LABEL = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
  ONE_TIME: "One-time",
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Core PDF fonts have no rupee glyph, so amounts are printed as "INR 1,180.00".
const money = (n, currency = "INR") =>
  `${currency} ${Number(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const describeLine = (invoice) => {
  const cycle = invoice.billingCycle ? CYCLE_LABEL[invoice.billingCycle] : null;
  const suffix = cycle ? ` - ${cycle}` : "";
  switch (invoice.purchaseType) {
    case "ADDON":
      return `${invoice.planName} (Add-on)${suffix}`;
    case "TOPUP":
      return `${invoice.planName} (Credit top-up)`;
    default:
      return `${invoice.planName} Plan${suffix}`;
  }
};

const gstRows = (invoice) => {
  const amount = Number(invoice.gstAmount ?? 0);
  if (!invoice.gstEnabled || !(amount > 0)) return [];
  const pct = Number(invoice.gstPercent ?? 0);
  if (invoice.gstType === "IGST") {
    return [{ label: `IGST (${pct}%)`, amount }];
  }
  const half = round2(amount / 2);
  return [
    { label: `CGST (${pct / 2}%)`, amount: half },
    { label: `SGST (${pct / 2}%)`, amount: round2(amount - half) },
  ];
};

/**
 * Generates the invoice PDF on disk.
 * @returns {{ filePath: string, fileUrl: string, invoiceNumber: string }}
 */
export const generateInvoicePDF = async (invoice, tenant, settingsArg) => {
  const settings = settingsArg ?? (await getInvoiceSettings());
  await fs.promises.mkdir(INVOICE_DIR, { recursive: true });

  const fileName = `${String(invoice.invoiceNumber).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
  const filePath = path.join(INVOICE_DIR, fileName);
  const currency = invoice.currency || "INR";

  const total = Number(invoice.amount);
  const gstAmount = Number(invoice.gstAmount ?? 0);
  const base =
    invoice.baseAmount != null ? Number(invoice.baseAmount) : round2(total - gstAmount);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const done = new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);
  });

  // Header
  doc.font("Helvetica-Bold").fontSize(18).text(settings.companyName, 50, 50);
  doc.font("Helvetica").fontSize(9).fillColor("#475569");
  if (settings.companyAddress) doc.text(settings.companyAddress, { width: 260 });
  if (settings.companyEmail) doc.text(settings.companyEmail);
  if (settings.companyGstNumber) doc.text(`GSTIN: ${settings.companyGstNumber}`);
  if (settings.sacCode) doc.text(`SAC: ${settings.sacCode}`);

  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(22).text("INVOICE", 350, 50, { width: 195, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor("#475569");
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 350, 80, { width: 195, align: "right" });
  doc.text(`Date: ${fmtDate(invoice.createdAt ?? new Date())}`, { width: 195, align: "right" });
  doc.text(`Status: ${String(invoice.status ?? "paid").toUpperCase()}`, { width: 195, align: "right" });
  if (invoice.offlineReference) {
    doc.text(`Payment ref: ${invoice.offlineReference}`, { width: 195, align: "right" });
  }

  // Bill to
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(10).text("BILL TO", 50, 170);
  doc.font("Helvetica").fontSize(10).fillColor("#334155");
  doc.text(tenant?.tenantName || "-");
  if (tenant?.email) doc.text(tenant.email);
  if (tenant?.phone) doc.text(tenant.phone);

  // Table header
  let y = 250;
  doc.rect(50, y, 495, 22).fill("#F1F5F9");
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(9);
  doc.text("Description", 58, y + 7, { width: 250 });
  doc.text("Billing period", 315, y + 7, { width: 125 });
  doc.text("Amount", 445, y + 7, { width: 92, align: "right" });

  // Line item
  y += 32;
  doc.font("Helvetica").fontSize(10).fillColor("#334155");
  doc.text(describeLine(invoice), 58, y, { width: 250 });
  doc.text(
    `${fmtDate(invoice.billingPeriodStart)} - ${fmtDate(invoice.billingPeriodEnd)}`,
    315,
    y,
    { width: 125 }
  );
  doc.text(money(base, currency), 445, y, { width: 92, align: "right" });

  // Totals
  y += 50;
  const totalsRow = (label, value, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10).fillColor("#0F172A");
    doc.text(label, 320, y, { width: 120 });
    doc.text(value, 445, y, { width: 92, align: "right" });
    y += bold ? 22 : 18;
  };
  totalsRow("Subtotal", money(base, currency));
  for (const row of gstRows(invoice)) totalsRow(row.label, money(row.amount, currency));
  doc.moveTo(320, y).lineTo(545, y).strokeColor("#CBD5E1").stroke();
  y += 8;
  totalsRow("Total", money(total, currency), true);

  doc.font("Helvetica").fontSize(8).fillColor("#94A3B8");
  doc.text("This is a computer-generated invoice and does not require a signature.", 50, 760, {
    width: 495,
    align: "center",
  });

  doc.end();
  await done;

  return { filePath, fileUrl: `/uploads/invoices/${fileName}`, invoiceNumber: invoice.invoiceNumber };
};
