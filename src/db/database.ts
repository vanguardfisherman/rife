import * as SQLite from 'expo-sqlite';
import { DashboardMetrics, ExportPayload, NumberEntry, Raffle, Sale } from '../types/models';

const db = SQLite.openDatabaseSync('rifa_progress.db');

export const initDatabase = (): void => {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS raffles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_numbers INTEGER NOT NULL,
      number_price REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS number_entries (
      raffle_id TEXT NOT NULL,
      number_value INTEGER NOT NULL,
      state TEXT NOT NULL,
      sold_at TEXT,
      buyer_name TEXT,
      buyer_phone TEXT,
      PRIMARY KEY (raffle_id, number_value)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      raffle_id TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_phone TEXT NOT NULL,
      total_paid REAL NOT NULL,
      sold_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      sale_id TEXT NOT NULL,
      raffle_id TEXT NOT NULL,
      number_value INTEGER NOT NULL,
      PRIMARY KEY (sale_id, number_value)
    );
  `);
};

export const getCurrentRaffle = (): Raffle | null => {
  const row = db.getFirstSync<any>('SELECT * FROM raffles ORDER BY updated_at DESC LIMIT 1');
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    totalNumbers: row.total_numbers,
    numberPrice: row.number_price,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const createRaffle = (name: string, totalNumbers: number, numberPrice: number): Raffle => {
  const now = new Date().toISOString();
  const raffle: Raffle = {
    id: `raffle-${Date.now()}`,
    name,
    totalNumbers,
    numberPrice,
    createdAt: now,
    updatedAt: now,
  };

  db.withTransactionSync(() => {
    db.runSync('DELETE FROM raffles');
    db.runSync('DELETE FROM number_entries');
    db.runSync('DELETE FROM sales');
    db.runSync('DELETE FROM sale_items');

    db.runSync(
      `INSERT INTO raffles (id, name, total_numbers, number_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [raffle.id, raffle.name, raffle.totalNumbers, raffle.numberPrice, raffle.createdAt, raffle.updatedAt]
    );

    for (let i = 1; i <= totalNumbers; i += 1) {
      db.runSync(
        `INSERT INTO number_entries (raffle_id, number_value, state) VALUES (?, ?, 'disponible')`,
        [raffle.id, i]
      );
    }
  });

  return raffle;
};

export const getDashboardMetrics = (raffleId: string, numberPrice: number): DashboardMetrics => {
  const aggregate = db.getFirstSync<any>(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN state = 'vendido' THEN 1 ELSE 0 END) as sold
     FROM number_entries WHERE raffle_id = ?`,
    [raffleId]
  );

  const total = aggregate?.total ?? 0;
  const sold = aggregate?.sold ?? 0;
  const available = total - sold;
  const progress = total === 0 ? 0 : (sold / total) * 100;

  return {
    total,
    sold,
    available,
    progress,
    collected: sold * numberPrice,
  };
};

export const getNumbers = (raffleId: string, state?: 'disponible' | 'vendido'): NumberEntry[] => {
  const rows = state
    ? db.getAllSync<any>('SELECT * FROM number_entries WHERE raffle_id = ? AND state = ? ORDER BY number_value', [raffleId, state])
    : db.getAllSync<any>('SELECT * FROM number_entries WHERE raffle_id = ? ORDER BY number_value', [raffleId]);

  return rows.map((row) => ({
    raffleId: row.raffle_id,
    numberValue: row.number_value,
    state: row.state,
    soldAt: row.sold_at ?? undefined,
    buyerName: row.buyer_name ?? undefined,
    buyerPhone: row.buyer_phone ?? undefined,
  }));
};

export const sellNumbers = (
  raffle: Raffle,
  numberValues: number[],
  buyerName: string,
  buyerPhone: string
): Sale => {
  const uniqueNumbers = [...new Set(numberValues)].sort((a, b) => a - b);
  if (uniqueNumbers.length === 0) {
    throw new Error('Debes seleccionar al menos un número');
  }

  const placeholders = uniqueNumbers.map(() => '?').join(',');
  const existingSold = db.getAllSync<any>(
    `SELECT number_value FROM number_entries
     WHERE raffle_id = ? AND number_value IN (${placeholders}) AND state = 'vendido'`,
    [raffle.id, ...uniqueNumbers]
  );

  if (existingSold.length > 0) {
    const duplicated = existingSold.map((item) => item.number_value).join(', ');
    throw new Error(`Estos números ya fueron vendidos: ${duplicated}`);
  }

  const soldAt = new Date().toISOString();
  const sale: Sale = {
    id: `sale-${Date.now()}`,
    raffleId: raffle.id,
    buyerName,
    buyerPhone,
    totalPaid: uniqueNumbers.length * raffle.numberPrice,
    soldAt,
  };

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO sales (id, raffle_id, buyer_name, buyer_phone, total_paid, sold_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sale.id, sale.raffleId, sale.buyerName, sale.buyerPhone, sale.totalPaid, sale.soldAt]
    );

    for (const value of uniqueNumbers) {
      db.runSync(
        `UPDATE number_entries
         SET state = 'vendido', sold_at = ?, buyer_name = ?, buyer_phone = ?
         WHERE raffle_id = ? AND number_value = ?`,
        [soldAt, buyerName, buyerPhone, raffle.id, value]
      );

      db.runSync(
        `INSERT INTO sale_items (sale_id, raffle_id, number_value)
         VALUES (?, ?, ?)`,
        [sale.id, raffle.id, value]
      );
    }

    db.runSync('UPDATE raffles SET updated_at = ? WHERE id = ?', [soldAt, raffle.id]);
  });

  return sale;
};

export const parseRange = (rangeInput: string): number[] => {
  const match = rangeInput.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) {
    throw new Error('El rango debe tener formato inicio-fin, por ejemplo 10-30');
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (start <= 0 || end <= 0 || start > end) {
    throw new Error('Rango inválido');
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const exportPayload = (raffleId: string): ExportPayload => {
  const raffleRow = db.getFirstSync<any>('SELECT * FROM raffles WHERE id = ?', [raffleId]);
  if (!raffleRow) {
    throw new Error('No existe la rifa para exportar');
  }

  const numbers = db.getAllSync<any>('SELECT * FROM number_entries WHERE raffle_id = ? ORDER BY number_value', [raffleId]);
  const sales = db.getAllSync<any>('SELECT * FROM sales WHERE raffle_id = ? ORDER BY sold_at', [raffleId]);
  const saleItems = db.getAllSync<any>('SELECT * FROM sale_items WHERE raffle_id = ? ORDER BY number_value', [raffleId]);

  return {
    exportedAt: new Date().toISOString(),
    raffle: {
      id: raffleRow.id,
      name: raffleRow.name,
      totalNumbers: raffleRow.total_numbers,
      numberPrice: raffleRow.number_price,
      createdAt: raffleRow.created_at,
      updatedAt: raffleRow.updated_at,
    },
    numbers: numbers.map((row) => ({
      raffleId: row.raffle_id,
      numberValue: row.number_value,
      state: row.state,
      soldAt: row.sold_at ?? undefined,
      buyerName: row.buyer_name ?? undefined,
      buyerPhone: row.buyer_phone ?? undefined,
    })),
    sales: sales.map((row) => ({
      id: row.id,
      raffleId: row.raffle_id,
      buyerName: row.buyer_name,
      buyerPhone: row.buyer_phone,
      totalPaid: row.total_paid,
      soldAt: row.sold_at,
    })),
    saleItems: saleItems.map((row) => ({
      saleId: row.sale_id,
      raffleId: row.raffle_id,
      numberValue: row.number_value,
    })),
  };
};

export const replaceWithImportedPayload = (payload: ExportPayload): void => {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM raffles');
    db.runSync('DELETE FROM number_entries');
    db.runSync('DELETE FROM sales');
    db.runSync('DELETE FROM sale_items');

    db.runSync(
      `INSERT INTO raffles (id, name, total_numbers, number_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.raffle.id,
        payload.raffle.name,
        payload.raffle.totalNumbers,
        payload.raffle.numberPrice,
        payload.raffle.createdAt,
        payload.raffle.updatedAt,
      ]
    );

    for (const item of payload.numbers) {
      db.runSync(
        `INSERT INTO number_entries (raffle_id, number_value, state, sold_at, buyer_name, buyer_phone)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.raffleId, item.numberValue, item.state, item.soldAt ?? null, item.buyerName ?? null, item.buyerPhone ?? null]
      );
    }

    for (const sale of payload.sales) {
      db.runSync(
        `INSERT INTO sales (id, raffle_id, buyer_name, buyer_phone, total_paid, sold_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sale.id, sale.raffleId, sale.buyerName, sale.buyerPhone, sale.totalPaid, sale.soldAt]
      );
    }

    for (const saleItem of payload.saleItems) {
      db.runSync(
        `INSERT INTO sale_items (sale_id, raffle_id, number_value)
         VALUES (?, ?, ?)`,
        [saleItem.saleId, saleItem.raffleId, saleItem.numberValue]
      );
    }
  });
};
