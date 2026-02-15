// logger.js
import fs from "fs";
import path from "path";

const LEVEL = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
  SUCCESS: "SUCCESS",
};

function colorize(level, text) {
  // 터미널 컬러(ANSI). 파일에는 적용 안 함.
  const C = {
    RESET: "\x1b[0m",
    DIM: "\x1b[2m",
    RED: "\x1b[31m",
    YELLOW: "\x1b[33m",
    GREEN: "\x1b[32m",
    CYAN: "\x1b[36m",
  };

  const isTTY = process.stdout.isTTY;
  if (!isTTY) return text;

  switch (level) {
    case LEVEL.ERROR:
      return `${C.RED}${text}${C.RESET}`;
    case LEVEL.WARN:
      return `${C.YELLOW}${text}${C.RESET}`;
    case LEVEL.SUCCESS:
      return `${C.GREEN}${text}${C.RESET}`;
    case LEVEL.INFO:
    default:
      return `${C.CYAN}${text}${C.RESET}`;
  }
}

function formatContext(ctx) {
  if (!ctx || typeof ctx !== "object") return "";
  const parts = Object.entries(ctx)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${String(v)}`);
  return parts.length ? ` | ${parts.join(" ")}` : "";
}

export function log(message, logFilePath, level = LEVEL.INFO, ctx = null) {
  const ts = new Date().toISOString();
  const context = formatContext(ctx);

  // 파일엔 깔끔하게
  const fileLine = `${ts} ${level} ${message}${context}\n`;

  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.appendFileSync(logFilePath, fileLine, "utf8");
  } catch (e) {
    // 파일 기록 실패는 콘솔에만
    console.error("Logger failed:", e?.message || e);
  }

  // 콘솔엔 보기 좋게
  const consoleLine = `[${ts}] ${level.padEnd(7)} ${message}${context}`;
  console.log(colorize(level, consoleLine));
}

// 호환용: 기존 logLine도 유지하고 싶으면 아래처럼 래핑
export function logLine(message, logFilePath) {
  log(message, logFilePath, LEVEL.INFO);
}

export { LEVEL };
