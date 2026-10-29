import { DurableObject } from 'cloudflare:workers';
import { HISTORIAL, VIDA_CONVERSACION_MS } from './constantes.ts';
import type { Turno } from './webhook.ts';

export type MensajeGuardado = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  replyTo: string | null;
  createdAt: number;
};

export class Conversation extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.asegurar();
    });
  }

  async existe(): Promise<boolean> {
    this.asegurar();
    return this.filas("SELECT clave FROM meta WHERE clave = 'creada'").length > 0;
  }

  async agregarUsuario(text: string): Promise<{ messageId: string; history: Turno[] }> {
    this.asegurar();
    const previas = this.filas<{ role: string; text: string }>(
      'SELECT role, text FROM messages ORDER BY created_at DESC LIMIT ?',
      HISTORIAL,
    )
      .reverse()
      .filter((fila): fila is Turno => fila.role === 'user' || fila.role === 'assistant');
    const messageId = crypto.randomUUID();
    const ahora = Date.now();
    this.ctx.storage.sql.exec(
      'INSERT INTO messages (id, role, text, reply_to, created_at) VALUES (?, ?, ?, NULL, ?)',
      messageId,
      'user',
      text,
      ahora,
    );
    this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO meta (clave, valor) VALUES ('creada', ?)",
      String(ahora),
    );
    await this.ctx.storage.setAlarm(ahora + VIDA_CONVERSACION_MS);
    return { messageId, history: previas };
  }

  async consumirRespuesta(messageId: string, text: string): Promise<'ok' | 'desconocido' | 'usado'> {
    this.asegurar();
    const usuario = this.filas("SELECT id FROM messages WHERE id = ? AND role = 'user'", messageId);
    if (usuario.length === 0) return 'desconocido';
    const usado = this.filas('SELECT message_id FROM used_replies WHERE message_id = ?', messageId);
    if (usado.length > 0) return 'usado';
    const ahora = Date.now();
    this.ctx.storage.sql.exec('INSERT INTO used_replies (message_id) VALUES (?)', messageId);
    this.ctx.storage.sql.exec(
      'INSERT INTO messages (id, role, text, reply_to, created_at) VALUES (?, ?, ?, ?, ?)',
      crypto.randomUUID(),
      'assistant',
      text,
      messageId,
      ahora,
    );
    await this.ctx.storage.setAlarm(ahora + VIDA_CONVERSACION_MS);
    return 'ok';
  }

  async leer(): Promise<{ messages: MensajeGuardado[] } | null> {
    this.asegurar();
    if (!(await this.existe())) return null;
    const filas = this.filas<{
      id: string;
      role: string;
      text: string;
      reply_to: string | null;
      created_at: number;
    }>('SELECT id, role, text, reply_to, created_at FROM messages ORDER BY created_at ASC');
    return {
      messages: filas
        .filter((fila): fila is typeof fila & { role: 'user' | 'assistant' } =>
          fila.role === 'user' || fila.role === 'assistant',
        )
        .map((fila) => ({
          id: fila.id,
          role: fila.role,
          text: fila.text,
          replyTo: fila.reply_to,
          createdAt: fila.created_at,
        })),
    };
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  private asegurar(): void {
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS meta (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )`);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      reply_to TEXT,
      created_at INTEGER NOT NULL
    )`);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS used_replies (
      message_id TEXT PRIMARY KEY
    )`);
  }

  private filas<T extends Record<string, SqlStorageValue>>(consulta: string, ...valores: SqlStorageValue[]): T[] {
    return this.ctx.storage.sql.exec<T>(consulta, ...valores).toArray();
  }
}
