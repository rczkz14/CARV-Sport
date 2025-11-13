import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const RAFFLE_PREFIX = "raffle-";

export function getRaffleFilePath(eventId: string) {
  return path.join(DATA_DIR, `${RAFFLE_PREFIX}${eventId}.json`);
}

export function readRaffleData(eventId: string) {
  const filePath = getRaffleFilePath(eventId);
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function writeRaffleData(eventId: string, data: any) {
  const filePath = getRaffleFilePath(eventId);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getAllRaffleFiles() {
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(RAFFLE_PREFIX) && f.endsWith(".json"))
    .map(f => path.join(DATA_DIR, f));
}

export function readJson(file: string, fallback: any) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, obj: any) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}