import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import "dotenv/config";

import { parseInvoiceFromPdf } from "./parsePdf.js";
import { appendCsvRow } from "./writeCsv.js";
import { logLine } from "./logger.js";

const WATCH_DIR = process.env.WATCH_DIR || "./input";
const SUCCESS_DIR = process.env.SUCCESS_DIR || "./processed/success";
const REVIEW_DIR = process.env.REVIEW_DIR || "./processed/needs-review";
const OUTPUT_CSV = process.env.OUTPUT_CSV || "./output/invoice_log.csv";
const LOG_FILE = process.env.LOG_FILE || "./logs/run.log";

// 파일명에서 vendor 추정: Vendor_YYYYMMDD_anything.pdf
function vendorFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const parts = base.split("_");
  return (parts[0] || "Unknown").trim() || "Unknown";
}

function normalizeDateFromFilename(filename) {
  // 파일명에 20260213 같은 게 있으면 2026-02-13로
  const base = path.basename(filename, path.extname(filename));
  const m = base.match(/(20\d{2})(\d{2})(\d{2})/);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function safeName(s) {
  return String(s || "")
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function moveWithRetry(src, dest, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
      return;
    } catch (e) {
      if (i === tries) throw e;
      await sleep(300 * i);
    }
  }
}

async function handleFile(fullPath) {
  const ts = new Date().toISOString();
  const originalFile = path.basename(fullPath);

  // 1) 확장자 체크
  if (path.extname(originalFile).toLowerCase() !== ".pdf") {
    logLine(`Skip non-pdf: ${originalFile}`, LOG_FILE);
    return;
  }

  // 2) 아직 복사 중일 수 있으니 잠깐 기다렸다가 읽기
  await sleep(500);

  let vendor = vendorFromFilename(originalFile);
  const dateFromName = normalizeDateFromFilename(originalFile);

  let invoiceNo = "";
  let invoiceDate = "";
  let total = "";
  let status = "success";
  let note = "";

  try {
    const buf = fs.readFileSync(fullPath);
    const parsed = await parseInvoiceFromPdf(buf);

    invoiceNo = parsed.invoiceNo || "";
    invoiceDate = parsed.invoiceDate || dateFromName || "";
    total = parsed.total || "";

    // vendor는 PDF에서 뽑히면 더 좋지만, 없으면 파일명 기반 유지
    if (parsed.vendor && parsed.vendor.length <= 60) {
      vendor = parsed.vendor;
    }

    // 핵심 필드가 너무 비면 review로 보냄
    const missing = [];
    if (!invoiceDate) missing.push("invoiceDate");
    if (!total) missing.push("total");
    if (!invoiceNo) missing.push("invoiceNo");

    if (missing.length >= 2) {
      status = "needs-review";
      note = `Missing: ${missing.join(", ")}`;
    }
  } catch (e) {
    status = "needs-review";
    note = `Parse error: ${e?.message || e}`;
  }

  // 3) 리네임 규칙: [date]_[vendor]_[invoiceNo or original].pdf
  const datePart = safeName(invoiceDate || dateFromName || "unknown-date");
  const vendorPart = safeName(vendor || "UnknownVendor");
  const invPart = safeName(invoiceNo || "no-invoice-no");

  const newFile = `${datePart}_${vendorPart}_${invPart}.pdf`;

  // 4) 이동 경로
  const destBase =
    status === "success"
      ? path.join(SUCCESS_DIR, vendorPart)
      : path.join(REVIEW_DIR, vendorPart);

  const destPath = path.join(destBase, newFile);

  // 5) 이동(재시도 포함)
  try {
    await moveWithRetry(fullPath, destPath, 3);
    logLine(`Moved: ${originalFile} -> ${destPath}`, LOG_FILE);
  } catch (e) {
    status = "needs-review";
    note = note || `Move error: ${e?.message || e}`;
    // 이동 실패하면 원본은 그대로 두고 로그만 남김
    logLine(`Move failed: ${originalFile} (${note})`, LOG_FILE);
  }

  // 6) CSV 기록
  await appendCsvRow(OUTPUT_CSV, {
    timestamp: ts,
    originalFile,
    newFile,
    vendor: vendorPart,
    invoiceNo,
    invoiceDate,
    total,
    status,
    note,
  });
}

function main() {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
  fs.mkdirSync(SUCCESS_DIR, { recursive: true });
  fs.mkdirSync(REVIEW_DIR, { recursive: true });

  logLine(`Watching: ${WATCH_DIR}`, LOG_FILE);

  const watcher = chokidar.watch(WATCH_DIR, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 800,
      pollInterval: 100,
    },
  });

  watcher.on("add", async (filePath) => {
    try {
      logLine(`Detected: ${path.basename(filePath)}`, LOG_FILE);
      await handleFile(filePath);
    } catch (e) {
      logLine(`Unhandled error for ${filePath}: ${e?.message || e}`, LOG_FILE);
    }
  });
}

main();
