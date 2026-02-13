import fs from "fs";
import path from "path";

export function logLine(message, logFilePath) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}\n`;
  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.appendFileSync(logFilePath, line, "utf8");
  } catch (e) {
    console.error("Logger failed:", e?.message || e);
  }
  console.log(line.trim());
}
