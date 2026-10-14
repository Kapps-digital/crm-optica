import type { Pool } from 'pg';

export interface SentenciaPreparada {
  consultaSql: string;
  all(...params: any[]): Promise<any[]>;
  get(...params: any[]): Promise<any>;
  run(...params: any[]): Promise<{ changes: number; lastInsertRowid: any }>;
}

export interface AdaptadorBaseDatos {
  pool: Pool;
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
  exec(sql: string): Promise<any>;
  prepare(sql: string): SentenciaPreparada;
}

export const pool: Pool;
export const base_datos: AdaptadorBaseDatos;
export function normalizarSql(sql: string): string;
export function inicializar_base_datos(): Promise<void>;
