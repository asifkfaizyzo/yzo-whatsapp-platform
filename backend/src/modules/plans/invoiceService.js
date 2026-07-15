// modules/plans/invoiceService.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

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
  return new Promise((resolve, reject) => {
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
      const summaryX = 380;
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

      // CGST
      const cgst = payment.gstAmount / 2;
      doc
        .text(`CGST (9%):`, summaryX, summaryY + 18)
        .text(formatINR(cgst), summaryValueX, summaryY + 18, {
          width: 110,
          align: "right",
        });

      // SGST
      const sgst = payment.gstAmount / 2;
      doc
        .text(`SGST (9%):`, summaryX, summaryY + 36)
        .text(formatINR(sgst), summaryValueX, summaryY + 36, {
          width: 110,
          align: "right",
        });

      // Divider before total
      doc
        .moveTo(summaryX, summaryY + 54)
        .lineTo(545, summaryY + 54)
        .strokeColor("#125EF2")
        .lineWidth(1)
        .stroke();

      // Total
      doc.rect(summaryX - 5, summaryY + 58, 175, 28).fill("#125EF2");

      doc
        .fillColor("#FFFFFF")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("TOTAL:", summaryX, summaryY + 66)
        .text(formatINR(payment.totalAmount), summaryValueX, summaryY + 66, {
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
      // NOTES / GST NOTE
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
        )
        .text(
          "GST charged at 18% (CGST 9% + SGST 9%) as applicable for SaaS services under SAC Code 998314.",
          50,
          noteY + 26,
          { width: 495 }
        );

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