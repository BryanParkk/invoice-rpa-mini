import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

function pick(regex, text) {
  const m = text.match(regex);
  return m ? (m[2] || m[1] || "").trim() : "";
}

async function extractTextFromPdf(buffer) {
  // Buffer면 "Buffer가 아닌" Uint8Array 뷰로 강제 변환
  const uint8 = Buffer.isBuffer(buffer)
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : buffer;

  const loadingTask = pdfjsLib.getDocument({ data: uint8 });
  const doc = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str).join(" ");
    fullText += pageText + " ";
  }

  return fullText.replace(/\s+/g, " ").trim();
}

export async function parseInvoiceFromPdf(buffer) {
  const text = await extractTextFromPdf(buffer);

  const invoiceNo =
    pick(/Invoice\s*(?:Number|No\.?)\s*[:#]?\s*([A-Z0-9-]+)/i, text) ||
    pick(/Invoice\s*#\s*([A-Z0-9-]+)/i, text);

  const invoiceDate = pick(
    /(?:Invoice Date|Date)\s*[:]?[\s]*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
    text,
  );

  const total = pick(
    /(?:Total|Amount Due|Balance Due)\s*[:$]?\s*\$?\s*([0-9,]+\.\d{2})/i,
    text,
  );

  const vendor = pick(/Vendor\s*[:]?[\s]*([A-Za-z0-9 &.,-]{2,})/i, text);

  return { invoiceNo, invoiceDate, total, vendor, rawText: text };
}
