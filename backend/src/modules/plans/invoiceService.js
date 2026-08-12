// modules/plans/invoiceService.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import prisma from "../../config/prisma.js";

// ── Ensure invoices directory exists ──
const invoicesDir = path.join(process.cwd(), "uploads", "invoices");
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

// ── Generate Invoice Number ──
export const generateInvoiceNumber = (paymentId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const short = paymentId.slice(-6).toUpperCase();
  return `INV-${year}${month}-${short}`;
};

// ── Format Currency ──
const formatINR = (amount) => {
  return `Rs. ${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// ── Format Date ──
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

// ══════════════════════════════════════════
// MAIN: Generate Invoice PDF
// ══════════════════════════════════════════
export const generateInvoicePDF = (payment, tenant) => {
  return new Promise(async (resolve, reject) => {
    // ── Fetch GST config ──
    const gstConfig = await getInvoiceGSTConfig();
    try {
      const invoiceNumber = generateInvoiceNumber(payment.id);
      const fileName = `${invoiceNumber}.pdf`;
      const filePath = path.join(invoicesDir, fileName);
      const fileUrl = `/uploads/invoices/${fileName}`;

      // ── Create PDF Document ──
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      // ── Pipe to file ──
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ════════════════════════════════
      // HEADER SECTION
      // ════════════════════════════════
      // Blue header background
      doc.rect(0, 0, 595, 120).fill("#125EF2");

      // ********Company name********
      doc
        .fillColor("#FFFFFF")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("SudoReply", 50, 35);

      // ********Company tagline********
      doc
        .fillColor("#CFE0FD")
        .fontSize(10)
        .font("Helvetica")
        .text("WhatsApp Business Platform", 50, 65);

      // TAX INVOICE text (right side)
      doc
        .fillColor("#FFFFFF")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("TAX INVOICE", 350, 35, { align: "right", width: 195 });

      // Invoice number
      doc
        .fillColor("#CFE0FD")
        .fontSize(10)
        .font("Helvetica")
        .text(invoiceNumber, 350, 65, { align: "right", width: 195 });

      // ════════════════════════════════
      // INVOICE META (Date, Status)
      // ════════════════════════════════
      doc.rect(0, 120, 595, 50).fill("#F8FAFF");

      doc
        .fillColor("#125EF2")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("INVOICE DATE", 50, 135);

      doc
        .fillColor("#333333")
        .fontSize(9)
        .font("Helvetica")
        .text(formatDate(payment.paidAt || payment.createdAt), 50, 148);

      doc
        .fillColor("#125EF2")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("DUE DATE", 200, 135);

      doc
        .fillColor("#333333")
        .fontSize(9)
        .font("Helvetica")
        .text(formatDate(payment.paidAt || payment.createdAt), 200, 148);

      doc
        .fillColor("#125EF2")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("STATUS", 350, 135);

      // Status badge
      doc.rect(348, 145, 50, 16).fill("#DCFCE7");
      doc
        .fillColor("#16A34A")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("PAID", 353, 149);

      // ════════════════════════════════
      // SELLER & BUYER INFO
      // ════════════════════════════════
      doc.moveDown(4);
      const infoY = 195;

      // ********Seller (From)********
      doc
        .fillColor("#125EF2")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("FROM", 50, infoY);

      doc
        .fillColor("#1A1A1A")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("SudoReply Technologies Pvt Ltd", 50, infoY + 14);

      doc
        .fillColor("#666666")
        .fontSize(9)
        .font("Helvetica")
        .text("Mumbai, Maharashtra, India", 50, infoY + 30)
        .text("GSTIN: 27AABCU9603R1ZM", 50, infoY + 43)
        .text("SAC Code: 998314", 50, infoY + 56)
        .text("support@sudoreply.com", 50, infoY + 69);

      // Buyer (Bill To)
      doc
        .fillColor("#125EF2")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("BILL TO", 320, infoY);

      doc
        .fillColor("#1A1A1A")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(tenant.tenantName, 320, infoY + 14);

      doc
        .fillColor("#666666")
        .fontSize(9)
        .font("Helvetica")
        .text(tenant.email, 320, infoY + 30);

      if (tenant.phone) {
        doc.text(tenant.phone, 320, infoY + 43);
      }

      if (tenant.address) {
        doc.text(tenant.address, 320, infoY + 56, { width: 220 });
      }

      // ════════════════════════════════
      // PAYMENT DETAILS TABLE
      // ════════════════════════════════
      const tableY = 310;

      // Table header background
      doc.rect(50, tableY, 495, 30).fill("#125EF2");

      // Table headers
      doc
        .fillColor("#FFFFFF")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("DESCRIPTION", 60, tableY + 10)
        .text("SAC", 300, tableY + 10)
        .text("QTY", 370, tableY + 10)
        .text("AMOUNT", 430, tableY + 10, { width: 100, align: "right" });

      // Table row background
      doc.rect(50, tableY + 30, 495, 40).fill("#F8FAFF");

      // Table row content
      const billingLabel =
        payment.billingType === "annual" ? "Annual" : "Monthly";

      doc
        .fillColor("#1A1A1A")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(
          `${payment.planName} Plan - ${billingLabel} Subscription`,
          60,
          tableY + 42
        );

      doc
        .fillColor("#666666")
        .fontSize(8)
        .font("Helvetica")
        .text("WhatsApp Business Platform Access", 60, tableY + 56);

      doc
        .fillColor("#1A1A1A")
        .fontSize(10)
        .font("Helvetica")
        .text("998314", 300, tableY + 42)
        .text("1", 370, tableY + 42)
        .text(formatINR(payment.baseAmount), 430, tableY + 42, {
          width: 100,
          align: "right",
        });

      // ════════════════════════════════
      // AMOUNT SUMMARY
      // ════════════════════════════════
      const summaryY = tableY + 90;

      // Divider line
      doc
        .moveTo(50, summaryY - 10)
        .lineTo(545, summaryY - 10)
        .strokeColor("#E2E8F0")
        .lineWidth(1)
        .stroke();


      // Summary rows
const summaryX      = 380;
const summaryValueX = 430;

// Base amount
doc
  .fillColor("#666666")
  .fontSize(9)
  .font("Helvetica")
  .text("Subtotal:", summaryX, summaryY)
  .text(formatINR(payment.baseAmount), summaryValueX, summaryY, {
    width: 110,
    align: "right",
  });

let currentY = summaryY + 18;

// ── Dynamic GST Rows ──
if (gstConfig.gstEnabled && payment.gstAmount > 0) {
  if (gstConfig.gstType === "CGST_SGST") {
    const halfPct = gstConfig.gstPercent / 2;
    const half    = parseFloat((payment.gstAmount / 2).toFixed(2));

    doc
      .fillColor("#666666")
      .fontSize(9)
      .font("Helvetica")
      .text(`CGST (${halfPct}%):`, summaryX, currentY)
      .text(formatINR(half), summaryValueX, currentY, {
        width: 110,
        align: "right",
      });
    currentY += 18;

    doc
      .fillColor("#666666")
      .fontSize(9)
      .font("Helvetica")
      .text(`SGST (${halfPct}%):`, summaryX, currentY)
      .text(formatINR(half), summaryValueX, currentY, {
        width: 110,
        align: "right",
      });
    currentY += 18;

  } else {
    // ── IGST ──
    doc
      .fillColor("#666666")
      .fontSize(9)
      .font("Helvetica")
      .text(`IGST (${gstConfig.gstPercent}%):`, summaryX, currentY)
      .text(formatINR(payment.gstAmount), summaryValueX, currentY, {
        width: 110,
        align: "right",
      });
    currentY += 18;
  }

} else if (!gstConfig.gstEnabled) {
  doc
    .fillColor("#888888")
    .fontSize(8)
    .font("Helvetica")
    .text("Tax: Not Applicable", summaryX, currentY);
  currentY += 18;
}

// Divider before total
doc
  .moveTo(summaryX, currentY)
  .lineTo(545, currentY)
  .strokeColor("#125EF2")
  .lineWidth(1)
  .stroke();

currentY += 4;

// Total box
doc.rect(summaryX - 5, currentY, 175, 28).fill("#125EF2");

doc
  .fillColor("#FFFFFF")
  .fontSize(11)
  .font("Helvetica-Bold")
  .text("TOTAL:", summaryX, currentY + 8)
  .text(formatINR(payment.totalAmount), summaryValueX, currentY + 8, {
    width: 110,
    align: "right",
  });



      // ════════════════════════════════
      // PAYMENT INFO
      // ════════════════════════════════
      const payInfoY = summaryY + 110;

      doc.rect(50, payInfoY, 495, 70).fill("#F0F7FF");

      doc
        .fillColor("#125EF2")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("PAYMENT INFORMATION", 65, payInfoY + 12);

      doc
        .fillColor("#666666")
        .fontSize(9)
        .font("Helvetica")
        .text(
          `Payment Method: ${payment.paymentMethod || "Online"}`,
          65,
          payInfoY + 28
        )
        .text(
          `Transaction ID: ${payment.razorpayPaymentId || "N/A"}`,
          65,
          payInfoY + 41
        )
        .text(
          `Order ID: ${payment.razorpayOrderId}`,
          65,
          payInfoY + 54
        );

      // ════════════════════════════════
      // AMOUNT IN WORDS
      // ════════════════════════════════
      const wordsY = payInfoY + 90;

      doc
        .fillColor("#1A1A1A")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Amount in Words: ", 50, wordsY, { continued: true })
        .font("Helvetica")
        .fillColor("#666666")
        .text(`${numberToWords(payment.totalAmount)} Only`);

      // ════════════════════════════════
      // NOTES / GST NOTE — Dynamic
      // ════════════════════════════════
      const noteY = wordsY + 30;

      doc
        .fillColor("#125EF2")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("NOTE:", 50, noteY);

      doc
        .fillColor("#888888")
        .fontSize(8)
        .font("Helvetica")
        .text(
          "This is a computer-generated invoice and does not require a physical signature.",
          50,
          noteY + 14,
          { width: 495 }
        );

      if (gstConfig.gstEnabled && payment.gstAmount > 0) {
        const gstNote = gstConfig.gstType === "CGST_SGST"
          ? `GST charged at ${gstConfig.gstPercent}% (CGST ${gstConfig.gstPercent / 2}% + SGST ${gstConfig.gstPercent / 2}%) as applicable for SaaS services under SAC Code ${gstConfig.sacCode || "998314"}.`
          : `IGST charged at ${gstConfig.gstPercent}% as applicable for SaaS services under SAC Code ${gstConfig.sacCode || "998314"}.`;

        doc
          .fillColor("#888888")
          .fontSize(8)
          .font("Helvetica")
          .text(gstNote, 50, noteY + 26, { width: 495 });

      } else {
        doc
          .fillColor("#888888")
          .fontSize(8)
          .font("Helvetica")
          .text(
            "No GST applicable on this invoice.",
            50,
            noteY + 26,
            { width: 495 }
          );
      }

      // ════════════════════════════════
      // FOOTER
      // ════════════════════════════════
      doc.rect(0, 760, 595, 82).fill("#125EF2");

      doc
        .fillColor("#FFFFFF")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Thank you for your business!", 0, 778, {
          align: "center",
          width: 595,
        });

      doc
        .fillColor("#CFE0FD")
        .fontSize(8)
        .font("Helvetica")
        .text(
          "SudoReply | support@sudoreply.com | www.sudoreply.com",
          0,
          798,
          { align: "center", width: 595 }
        );

      // ── Finalize PDF ──
      doc.end();

      stream.on("finish", () => {
        resolve({ filePath, fileUrl, invoiceNumber });
      });

      stream.on("error", (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};

// ════════════════════════════════
// HELPER: Number to Words
// ════════════════════════════════
// ── Helper: Number to Words ──
const numberToWords = (amount) => {
  let num = Math.round(amount);  // ← Change const to let

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
    "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
    "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty",
    "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  if (num === 0) return "Zero Rupees";

  const convertHundreds = (n) => {
    let result = "";
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      result += ones[n] + " ";
    }
    return result;
  };

  let result = "";

  if (num >= 10000000) {
    result += convertHundreds(Math.floor(num / 10000000)) + "Crore ";
    num %= 10000000;  // ← Now works because num is let
  }
  if (num >= 100000) {
    result += convertHundreds(Math.floor(num / 100000)) + "Lakh ";
    num %= 100000;
  }
  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + "Thousand ";
    num %= 1000;
  }
  result += convertHundreds(num);

  return `Indian Rupees ${result.trim()}`;
};


// ── Generate PDF from new Invoice Model (Append to the end of invoiceService.js) ──
export const generateInvoicePDFFromModel = (invoice, tenant) => {
  return new Promise((resolve, reject) => {
    try {
      const invoiceNumber = invoice.invoiceNumber;
      const fileName = `${invoiceNumber}.pdf`;
      const filePath = path.join(invoicesDir, fileName);
      const fileUrl = `/uploads/invoices/${fileName}`;

      // ── Create PDF Document ──
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      // ── Pipe to file ──
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header Section (Blue background)
      doc.rect(0, 0, 595, 120).fill("#125EF2");

      // Company name
      doc.fillColor("#FFFFFF")
         .fontSize(24)
         .font("Helvetica-Bold")
         .text("SudoReply", 50, 35);

      // Company tagline
      doc.fillColor("#CFE0FD")
         .fontSize(10)
         .font("Helvetica")
         .text("WhatsApp Business Platform", 50, 65);

      // TAX INVOICE text
      doc.fillColor("#FFFFFF")
         .fontSize(20)
         .font("Helvetica-Bold")
         .text("TAX INVOICE", 350, 35, { align: "right", width: 195 });

      // Invoice number
      doc.fillColor("#CFE0FD")
         .fontSize(10)
         .font("Helvetica")
         .text(invoiceNumber, 350, 65, { align: "right", width: 195 });

      // Invoice Meta (Date, Status)
      doc.rect(0, 120, 595, 50).fill("#F8FAFF");

      doc.fillColor("#125EF2").fontSize(9).font("Helvetica-Bold").text("INVOICE DATE", 50, 135);
      doc.fillColor("#333333").fontSize(9).font("Helvetica").text(formatDate(invoice.createdAt), 50, 148);

      doc.fillColor("#125EF2").fontSize(9).font("Helvetica-Bold").text("BILLING PERIOD", 200, 135);
      doc.fillColor("#333333").fontSize(9).font("Helvetica").text(`${formatDate(invoice.billingPeriodStart)} - ${formatDate(invoice.billingPeriodEnd)}`, 200, 148);

      doc.fillColor("#125EF2").fontSize(9).font("Helvetica-Bold").text("STATUS", 420, 135);
      
      // Status badge
      doc.rect(418, 145, 50, 16).fill("#DCFCE7");
      doc.fillColor("#16A34A").fontSize(8).font("Helvetica-Bold").text(invoice.status.toUpperCase(), 423, 149);

      // Seller & Buyer Info
      doc.moveDown(4);
      const infoY = 195;

      // Seller
      doc.fillColor("#125EF2").fontSize(9).font("Helvetica-Bold").text("FROM", 50, infoY);
      doc.fillColor("#1A1A1A").fontSize(11).font("Helvetica-Bold").text("SudoReply Technologies Pvt Ltd", 50, infoY + 14);
      doc.fillColor("#666666").fontSize(9).font("Helvetica")
         .text("Mumbai, Maharashtra, India", 50, infoY + 30)
         .text("GSTIN: 27AABCU9603R1ZM", 50, infoY + 43)
         .text("SAC Code: 998314", 50, infoY + 56)
         .text("support@sudoreply.com", 50, infoY + 69);

      // Buyer
      doc.fillColor("#125EF2").fontSize(9).font("Helvetica-Bold").text("BILL TO", 320, infoY);
      doc.fillColor("#1A1A1A").fontSize(11).font("Helvetica-Bold").text(tenant.tenantName || tenant.email, 320, infoY + 14);
      doc.fillColor("#666666").fontSize(9).font("Helvetica").text(tenant.email, 320, infoY + 30);
      if (tenant.phone) doc.text(tenant.phone, 320, infoY + 43);
      if (tenant.address) doc.text(tenant.address, 320, infoY + 56, { width: 220 });

      // Table
      const tableY = 310;
      doc.rect(50, tableY, 495, 30).fill("#125EF2");
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
         .text("DESCRIPTION", 60, tableY + 10)
         .text("SAC", 300, tableY + 10)
         .text("QTY", 370, tableY + 10)
         .text("AMOUNT", 430, tableY + 10, { width: 100, align: "right" });

      doc.rect(50, tableY + 30, 495, 40).fill("#F8FAFF");
      doc.fillColor("#1A1A1A").fontSize(10).font("Helvetica-Bold").text(`${invoice.planName} Plan`, 60, tableY + 42);
      doc.fillColor("#666666").fontSize(8).font("Helvetica").text("WhatsApp Business Platform Access", 60, tableY + 56);
      doc.fillColor("#1A1A1A").fontSize(10).font("Helvetica")
         .text("998314", 300, tableY + 42)
         .text("1", 370, tableY + 42)
         .text(formatINR(invoice.amount), 430, tableY + 42, { width: 100, align: "right" });

      // Amount Summary
      const summaryY = tableY + 90;
      doc.moveTo(50, summaryY - 10).lineTo(545, summaryY - 10).strokeColor("#E2E8F0").lineWidth(1).stroke();

      const summaryX = 380;
      const summaryValueX = 430;

      doc.fillColor("#666666").fontSize(9).font("Helvetica")
         .text("Subtotal:", summaryX, summaryY)
         .text(formatINR(invoice.amount), summaryValueX, summaryY, { width: 110, align: "right" });

      doc.moveTo(summaryX, summaryY + 18).lineTo(545, summaryY + 18).strokeColor("#125EF2").lineWidth(1).stroke();

      doc.rect(summaryX - 5, summaryY + 22, 175, 28).fill("#125EF2");
      doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold")
         .text("TOTAL:", summaryX, summaryY + 30)
         .text(formatINR(invoice.amount), summaryValueX, summaryY + 30, { width: 110, align: "right" });

      // Payment Info
      const payInfoY = summaryY + 70;
      doc.rect(50, payInfoY, 495, 50).fill("#F0F7FF");
      doc.fillColor("#125EF2").fontSize(10).font("Helvetica-Bold").text("PAYMENT INFORMATION", 65, payInfoY + 10);
      doc.fillColor("#666666").fontSize(9).font("Helvetica")
         .text(`Payment Card: ${invoice.paymentMethodBrand || "Online"} ending in ${invoice.paymentMethodLast4 || "XXXX"}`, 65, payInfoY + 26);

      // Amount in words
      const wordsY = payInfoY + 70;
      doc.fillColor("#1A1A1A").fontSize(9).font("Helvetica-Bold").text("Amount in Words: ", 50, wordsY, { continued: true })
         .font("Helvetica").fillColor("#666666").text(`${numberToWords(invoice.amount)} Only`);

      // Large green Paid stamp
      doc.save();
      doc.rotate(-15, { origin: [150, 480] });
      doc.rect(100, 470, 110, 40).lineWidth(3).strokeColor("#16A34A");
      doc.fillColor("#16A34A").fontSize(18).font("Helvetica-Bold").text("PAID", 135, 482);
      doc.restore();

      // Footer
      const noteY = wordsY + 30;
      doc.fillColor("#125EF2").fontSize(9).font("Helvetica-Bold").text("NOTE:", 50, noteY);
      doc.fillColor("#888888").fontSize(8).font("Helvetica")
         .text("This is a computer-generated invoice and does not require a physical signature.", 50, noteY + 14, { width: 495 });

      doc.rect(0, 760, 595, 82).fill("#125EF2");
      doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold").text("Thank you for your business!", 0, 778, { align: "center", width: 595 });
      doc.fillColor("#CFE0FD").fontSize(8).font("Helvetica").text("SudoReply | support@sudoreply.com | www.sudoreply.com", 0, 798, { align: "center", width: 595 });

      doc.end();

      stream.on("finish", () => {
        resolve({ filePath, fileUrl, invoiceNumber });
      });
      stream.on("error", (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
};


// ── Helper: Fetch GST config from DB ──
const getInvoiceGSTConfig = async () => {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "GLOBAL" },
    });
    if (!settings) {
      return {
        gstEnabled:       true,
        gstPercent:       18,
        gstType:          "CGST_SGST",
        companyGstNumber: "27AABCU9603R1ZM",
        companyName:      "SudoReply Technologies Pvt Ltd",
        companyEmail:     "support@sudoreply.com",
        companyAddress:   "Mumbai, Maharashtra, India",
        sacCode:          "998314",
      };
    }
    return settings;
  } catch {
    return {
      gstEnabled:  true,
      gstPercent:  18,
      gstType:     "CGST_SGST",
      sacCode:     "998314",
    };
  }
};