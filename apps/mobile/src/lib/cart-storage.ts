import * as FileSystem from "expo-file-system/legacy";
import type { StoreCartLine } from "../types/app";

const CART_FILE = "saasclinics-owner-store-cart.json";

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return fallback;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as unknown;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export async function loadStoreCart(): Promise<StoreCartLine[]> {
  const base = FileSystem.documentDirectory;
  if (!base) return [];
  const path = `${base}${CART_FILE}`;
  const data = await readJsonFile<unknown>(path, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is StoreCartLine =>
      row != null &&
      typeof row === "object" &&
      typeof (row as StoreCartLine).productId === "string" &&
      typeof (row as StoreCartLine).name === "string" &&
      typeof (row as StoreCartLine).price === "number" &&
      typeof (row as StoreCartLine).quantity === "number",
  );
}

export async function saveStoreCart(lines: StoreCartLine[]): Promise<void> {
  const base = FileSystem.documentDirectory;
  if (!base) return;
  const path = `${base}${CART_FILE}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(lines));
}
