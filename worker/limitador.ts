import { DurableObject } from 'cloudflare:workers';
import { LIMITE_DIA, LIMITE_MINUTO, VENTANA_DIA_MS, VENTANA_MINUTO_MS } from './constantes.ts';

export class RateLimiter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS golpes (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL)',
      );
    });
  }

  async consumir(): Promise<'ok' | 'minuto' | 'dia'> {
    const ahora = Date.now();
    const desdeDia = ahora - VENTANA_DIA_MS;
    this.ctx.storage.sql.exec('DELETE FROM golpes WHERE at < ?', desdeDia);
    const enMinuto = this.contar(ahora - VENTANA_MINUTO_MS);
    const enDia = this.contar(desdeDia);
    if (enMinuto >= LIMITE_MINUTO) return 'minuto';
    if (enDia >= LIMITE_DIA) return 'dia';
    this.ctx.storage.sql.exec('INSERT INTO golpes (at) VALUES (?)', ahora);
    return 'ok';
  }

  private contar(desde: number): number {
    const fila = this.ctx.storage.sql
      .exec<{ n: number }>('SELECT COUNT(*) AS n FROM golpes WHERE at >= ?', desde)
      .toArray()[0];
    return Number(fila?.n ?? 0);
  }
}
