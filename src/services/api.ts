import type {
  Member,
  WorkGroup,
  Category,
  Product,
  Production,
  Ranking,
  FavoriteProduct,
  Summary,
  PeriodType,
} from "../types/api";

const BASE =
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8080/api";

export class ApiError extends Error {
  readonly code?: string;

  constructor(readonly status: number, body: string, statusText: string) {
    super("HTTP " + status + " — " + (body || statusText));
    this.name = "ApiError";
    try {
      const detail = JSON.parse(body) as { code?: unknown } | null;
      if (typeof detail?.code === "string") this.code = detail.code;
    } catch {
      // The server may return a plain-text error instead of JSON.
    }
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store", // Evita que el navegador (especialmente móvil) guarde datos viejos
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text, res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ===== Catálogos =====
export const getMembers = () => http<Member[]>("/members");
export const getWorkGroups = (signal?: AbortSignal) => http<WorkGroup[]>("/work-groups", { signal });
export const getProducts = (activeOnly = true, signal?: AbortSignal) =>
  http<Product[]>(`/products?activeOnly=${activeOnly}`, { signal });
export const getCategories = (signal?: AbortSignal) => http<Category[]>("/categories", { signal });
type ProductAppearance = { emoji?: string | null; color?: string | null };

export const createProduct = (payload: { name: string; categoryId: number } & ProductAppearance) =>
  http<Product>("/products", {
    method: "POST",
    body: JSON.stringify({ ...payload, active: true }),
  });

export async function updateProductAppearance(id: number, appearance: ProductAppearance) {
  const path = "/products/" + id;
  const current = await http<Product>(path);
  return http<Product>(path, {
    method: "PUT",
    body: JSON.stringify({ name: current.name, categoryId: current.categoryId, ...appearance }),
  });
}

// ===== Producciones =====
export const getProductions = (signal?: AbortSignal) => http<Production[]>("/productions", { signal });
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
