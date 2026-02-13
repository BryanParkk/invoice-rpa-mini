import fs from "fs";
import path from "path";
import { createObjectCsvWriter } from "csv-writer";

export async function appendCsvRow(csvPath, row) {
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });

  const fileExists = fs.existsSync(csvPath);

  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: "timestamp", title: "timestamp" },
      { id: "originalFile", title: "originalFile" },
      { id: "newFile", title: "newFile" },
      { id: "vendor", title: "vendor" },
      { id: "invoiceNo", title: "invoiceNo" },
      { id: "invoiceDate", title: "invoiceDate" },
      { id: "total", title: "total" },
      { id: "status", title: "status" },
      { id: "note", title: "note" },
    ],
    // csv-writer는 append를 지원함(파일 없으면 생성)
    append: fileExists,
  });

  await csvWriter.writeRecords([row]);
}
