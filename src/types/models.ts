export type NumberState = 'disponible' | 'vendido';

export interface Raffle {
  id: string;
  name: string;
  totalNumbers: number;
  numberPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface NumberEntry {
  raffleId: string;
  numberValue: number;
  state: NumberState;
  soldAt?: string;
  buyerName?: string;
  buyerPhone?: string;
}

export interface Sale {
  id: string;
  raffleId: string;
  buyerName: string;
  buyerPhone: string;
  totalPaid: number;
  soldAt: string;
}

export interface SaleItem {
  saleId: string;
  raffleId: string;
  numberValue: number;
}

export interface ExportPayload {
  exportedAt: string;
  raffle: Raffle;
  numbers: NumberEntry[];
  sales: Sale[];
  saleItems: SaleItem[];
}

export interface DashboardMetrics {
  total: number;
  sold: number;
  available: number;
  progress: number;
  collected: number;
}
