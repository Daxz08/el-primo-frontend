export interface Member {
  id: number;
  name: string;
  color: string;
  avatarUrl?: string | null;
  active: boolean;
}

export interface WorkGroup {
  id: number;
  name: string;
  isTeam: boolean;
  members: Member[];
}

export interface Category {
  id: number;
  name: string;
  emoji?: string | null;
}

export interface Product {
  id: number;
  name: string;
  emoji?: string | null;
  color?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  categoryEmoji?: string | null;
  active: boolean;
}

export interface ProductionPoint {
  memberId: number;
  memberName: string;
  memberColor: string;
  points: number;
}

export interface Production {
  id: number;
  productId: number;
  productName: string;
  productEmoji?: string | null;
  productColor?: string | null;
  workGroupId: number;
  workGroupName: string;
  isTeam: boolean;
  members: Member[];
  points: number; // <-- AHORA ES UN NÚMERO SIMPLE
  producedAt: string; 
  notes?: string | null;
}

export interface Ranking {
  id: number; // <-- ID del grupo
  name: string;
  isTeam: boolean;
  members: Member[];
  totalPoints: number;
  totalProductions: number;
  position: number;
}

export interface FavoriteProduct {
  productId: number;
  productName: string;
  emoji?: string | null;
  color?: string | null;
  totalProductions: number;
}

export interface Summary {
  totalProductions: number;
  periodLabel: string;
  leader: Ranking | null;
  favoriteProduct: FavoriteProduct | null;
  ranking: Ranking[];
  topProducts: FavoriteProduct[];
}

export type PeriodType = "WEEK" | "MONTH" | "QUARTER" | "ALL";