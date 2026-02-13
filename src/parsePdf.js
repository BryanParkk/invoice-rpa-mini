import * as pdfParse from "pdf-parse";
const pdf = pdfParse.default ?? pdfParse;

function pick(regex, text) {
  const m = text.match(regex);
  return m ? (m[2] || m[1] || "").trim() : "";
}

// 너무 빡세게 안 잡고, 실패하면 needs-review로 보내는 전략이에요
export async function parseInvoiceFromPdf(buffer) {
  const data = await pdf(buffer);
  const text = (data.text || "").replace(/\s+/g, " ").trim();

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

  // vendor는 PDF에서 잡기 어려우면 파일명 기반으로도 보완할 거라 여기선 optional
  const vendor = pick(/Vendor\s*[:]?[\s]*([A-Za-z0-9 &.,-]{2,})/i, text);

  return { invoiceNo, invoiceDate, total, vendor, rawText: text };
}
