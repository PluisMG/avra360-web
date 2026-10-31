import { DurableObject } from 'cloudflare:workers';
import { HISTORIAL, VIDA_CONVERSACION_MS } from './constantes.ts';
import { logTiempo, type CampoTiempo, type MarcasTiempo } from './tiempos.ts';
import type { Turno } from './webhook.ts';

const encoderSse = new TextEncoder();
const TOPE_SSE = 200;

export type MensajeGuardado = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  replyTo: string | null;
  createdAt: number;
};

export class Conversation extends DurableObject<Env> {
  private oyentes = new Set<ReadableStreamDefaultController<Uint8Array>>();
  private bufferSse: string[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.asegurar();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/sse') return new Response(null, { status: 404 });
    return this.abrirSse();
  }

  async emitir(evento: string, datos: Record<string, unknown>): Promise<void> {
    this.emitirFrame(evento, datos);
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
    const conversationId = this.idGuardado();
    if (conversationId) {
      this.ctx.storage.sql.exec('INSERT OR IGNORE INTO tiempos (message_id) VALUES (?)', messageId);
      this.escribirCampo('t_respuesta', ahora, messageId);
      this.logFila(conversationId, messageId);
    }
    this.emitirFrame('mensaje', { role: 'assistant', replyTo: messageId, text });
    this.emitirFrame('fin', { messageId, traspaso: false });
    if (this.oyentes.size > 0) this.marcarEntregas(false);
    return 'ok';
  }

  async anotarTiempo(
    conversationId: string,
    messageId: string,
    campo: CampoTiempo,
    valor: number,
    fallback?: number,
  ): Promise<void> {
    this.asegurar();
    this.recordarId(conversationId);
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO tiempos (message_id) VALUES (?)', messageId);
    this.escribirCampo(campo, valor, messageId);
    if (fallback !== undefined) {
      this.ctx.storage.sql.exec('UPDATE tiempos SET fallback = ? WHERE message_id = ?', fallback, messageId);
    }
    this.logFila(conversationId, messageId);
  }

  marcarEntregas(forzar: boolean): void {
    this.asegurar();
    if (!forzar && this.oyentes.size === 0) return;
    const conversationId = this.idGuardado();
    if (!conversationId) return;
    const ahora = Date.now();
    const filas = this.filas<{ message_id: string }>(
      `SELECT t.message_id AS message_id
       FROM tiempos t
       WHERE t.t_entregado IS NULL
         AND EXISTS (
           SELECT 1 FROM messages m
           WHERE m.reply_to = t.message_id AND m.role = 'assistant'
         )`,
    );
    for (const fila of filas) {
      this.ctx.storage.sql.exec(
        'UPDATE tiempos SET t_entregado = ? WHERE message_id = ? AND t_entregado IS NULL',
        ahora,
        fila.message_id,
      );
      this.logFila(conversationId, fila.message_id);
    }
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
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS tiempos (
      message_id TEXT PRIMARY KEY,
      t_recibido INTEGER,
      t_webhook_ok INTEGER,
      t_respuesta INTEGER,
      t_entregado INTEGER,
      t_primer_token INTEGER,
      t_fin INTEGER,
      fallback INTEGER
    )`);
  }

  private abrirSse(): Response {
    let control: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start: (controlador) => {
        control = controlador;
        if (this.bufferSse.length === 0) this.reponerDesdeSql();
        this.oyentes.add(controlador);
        if (this.bufferSse.length > 0) controlador.enqueue(encoderSse.encode(this.bufferSse.join('')));
        this.marcarEntregas(false);
      },
      cancel: () => {
        if (control) this.oyentes.delete(control);
      },
    });
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  private reponerDesdeSql(): void {
    const filas = this.filas<{ reply_to: string; text: string }>(
      `SELECT reply_to, text FROM messages
       WHERE role = 'assistant' AND reply_to IS NOT NULL
       ORDER BY created_at ASC`,
    );
    const cerrados = new Set<string>();
    for (const fila of filas) {
      this.emitirFrame('mensaje', { role: 'assistant', replyTo: fila.reply_to, text: fila.text });
      if (!cerrados.has(fila.reply_to)) {
        cerrados.add(fila.reply_to);
        this.emitirFrame('fin', { messageId: fila.reply_to, traspaso: false });
      }
    }
  }

  private emitirFrame(evento: string, datos: Record<string, unknown>): void {
    const frame = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
    this.bufferSse.push(frame);
    if (this.bufferSse.length > TOPE_SSE) this.bufferSse.shift();
    const bytes = encoderSse.encode(frame);
    for (const control of this.oyentes) {
      try {
        control.enqueue(bytes);
      } catch {
        this.oyentes.delete(control);
      }
    }
  }

  private escribirCampo(campo: CampoTiempo, valor: number, messageId: string): void {
    switch (campo) {
      case 't_recibido':
        this.ctx.storage.sql.exec('UPDATE tiempos SET t_recibido = ? WHERE message_id = ?', valor, messageId);
        break;
      case 't_webhook_ok':
        this.ctx.storage.sql.exec('UPDATE tiempos SET t_webhook_ok = ? WHERE message_id = ?', valor, messageId);
        break;
      case 't_respuesta':
        this.ctx.storage.sql.exec('UPDATE tiempos SET t_respuesta = ? WHERE message_id = ?', valor, messageId);
        break;
      case 't_entregado':
        this.ctx.storage.sql.exec('UPDATE tiempos SET t_entregado = ? WHERE message_id = ?', valor, messageId);
        break;
      case 't_primer_token':
        this.ctx.storage.sql.exec('UPDATE tiempos SET t_primer_token = ? WHERE message_id = ?', valor, messageId);
        break;
      case 't_fin':
        this.ctx.storage.sql.exec('UPDATE tiempos SET t_fin = ? WHERE message_id = ?', valor, messageId);
        break;
      default: {
        const nunca: never = campo;
        throw new Error(nunca);
      }
    }
  }

  private recordarId(conversationId: string): void {
    this.ctx.storage.sql.exec(
      "INSERT INTO meta (clave, valor) VALUES ('id', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
      conversationId,
    );
  }

  private idGuardado(): string | null {
    const filas = this.filas<{ valor: string }>("SELECT valor FROM meta WHERE clave = 'id'");
    return filas[0]?.valor ?? null;
  }

  private logFila(conversationId: string, messageId: string): void {
    const fila = this.filas<{
      t_recibido: number | null;
      t_webhook_ok: number | null;
      t_respuesta: number | null;
      t_entregado: number | null;
      t_primer_token: number | null;
      t_fin: number | null;
      fallback: number | null;
    }>(
      `SELECT t_recibido, t_webhook_ok, t_respuesta, t_entregado, t_primer_token, t_fin, fallback
       FROM tiempos WHERE message_id = ?`,
      messageId,
    )[0];
    if (!fila) return;
    const marcas: MarcasTiempo = {
      t_recibido: numeroONulo(fila.t_recibido),
      t_webhook_ok: numeroONulo(fila.t_webhook_ok),
      t_respuesta: numeroONulo(fila.t_respuesta),
      t_entregado: numeroONulo(fila.t_entregado),
      t_primer_token: numeroONulo(fila.t_primer_token),
      t_fin: numeroONulo(fila.t_fin),
      fallback: numeroONulo(fila.fallback),
    };
    logTiempo(conversationId, messageId, marcas);
  }

  private filas<T extends Record<string, SqlStorageValue>>(consulta: string, ...valores: SqlStorageValue[]): T[] {
    return this.ctx.storage.sql.exec<T>(consulta, ...valores).toArray();
  }
}

function numeroONulo(valor: number | null): number | null {
  return typeof valor === 'number' ? valor : null;
}
