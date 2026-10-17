import type {
  Member,
  WorkGroup,
  Product,
  Production,
  Ranking,
  FavoriteProduct,
  Summary,
  PeriodType,
} from "../types/api";

const BASE =
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8080/api";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store", // Evita que el navegador (especialmente móvil) guarde datos viejos
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ===== Catálogos =====
export const getMembers = () => http<Member[]>("/members");
export const getWorkGroups = () => http<WorkGroup[]>("/work-groups");
export const getProducts = (activeOnly = true) =>
  http<Product[]>(`/products?activeOnly=${activeOnly}`);

// ===== Producciones =====
export const getProductions = () => http<Production[]>("/productions");
export const createProduction = (payload: {
  productId: number;
  workGroupId: number;
  notes?: string;
}) =>
  http<Production>("/productions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ===== Estadísticas =====
export const getRanking = (period: PeriodType) =>
  http<Ranking[]>(`/stats/ranking?period=${period}`);

export const getFavorites = (period: PeriodType, limit = 5) =>
  http<FavoriteProduct[]>(`/stats/favorites?period=${period}&limit=${limit}`);

export const getSummary = (period: PeriodType) =>
  http<Summary>(`/stats/summary?period=${period}`);