import { AVISO_VERSION } from './constantes.ts';

export type RegistroConsentimiento = {
  versionAviso: string;
  aceptadoEn: string;
  conversationId: string;
};

export type Prospecto = {
  conversationId: string;
  consentimiento: RegistroConsentimiento;
};

export type ConversacionArchivada = {
  conversationId: string;
  consentimiento: RegistroConsentimiento;
};

export interface LeadStore {
  guardar(prospecto: Prospecto): Promise<void>;
}

export interface ConversationArchive {
  archivar(conversacion: ConversacionArchivada): Promise<void>;
}

type Sentencia = {
  bind(...valores: unknown[]): { run(): Promise<unknown> };
};

export type BaseDeDatos = {
  prepare(sql: string): Sentencia;
};

export type AlmacenClaveValor = {
  put(clave: string, valor: string): Promise<void>;
};

export class AlmacenamientoApagado implements LeadStore, ConversationArchive {
  async guardar(): Promise<void> {}
  async archivar(): Promise<void> {}
}

export class AlmacenamientoNoEnlazado implements LeadStore, ConversationArchive {
  async guardar(): Promise<void> {}
  async archivar(): Promise<void> {}
}

/**
 * Adaptador listo para un D1 que este Worker no tiene enlazado.
 * El SQL no se ejecuta mientras ALMACENAMIENTO_ACTIVO y AVISO_APROBADO
 * no sean "1" y no exista el binding.
 */
export class AdaptadorD1 implements LeadStore, ConversationArchive {
  private readonly db: BaseDeDatos;

  constructor(db: BaseDeDatos) {
    this.db = db;
  }

  async guardar(prospecto: Prospecto): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO prospectos (conversation_id, version_aviso, aceptado_en) VALUES (?, ?, ?)',
      )
      .bind(prospecto.conversationId, prospecto.consentimiento.versionAviso, prospecto.consentimiento.aceptadoEn)
      .run();
  }

  async archivar(conversacion: ConversacionArchivada): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO conversaciones (conversation_id, version_aviso, aceptado_en, cuerpo) VALUES (?, ?, ?, ?)',
      )
      .bind(
        conversacion.conversationId,
        conversacion.consentimiento.versionAviso,
        conversacion.consentimiento.aceptadoEn,
        JSON.stringify(conversacion),
      )
      .run();
  }
}

export class AdaptadorKv implements LeadStore, ConversationArchive {
  private readonly kv: AlmacenClaveValor;

  constructor(kv: AlmacenClaveValor) {
    this.kv = kv;
  }

  async guardar(prospecto: Prospecto): Promise<void> {
    await this.kv.put(`prospecto:${prospecto.conversationId}`, JSON.stringify(prospecto));
  }

  async archivar(conversacion: ConversacionArchivada): Promise<void> {
    await this.kv.put(`conversacion:${conversacion.conversationId}`, JSON.stringify(conversacion));
  }
}

export type EntornoAlmacen = {
  ALMACENAMIENTO_ACTIVO?: string;
  AVISO_APROBADO?: string;
  DB?: BaseDeDatos;
  AVISO_KV?: AlmacenClaveValor;
};

export function resolverAlmacen(env: EntornoAlmacen): LeadStore & ConversationArchive {
  if (env.ALMACENAMIENTO_ACTIVO !== '1' || env.AVISO_APROBADO !== '1') {
    return new AlmacenamientoApagado();
  }
  if (env.DB) return new AdaptadorD1(env.DB);
  if (env.AVISO_KV) return new AdaptadorKv(env.AVISO_KV);
  return new AlmacenamientoNoEnlazado();
}

export type MotivoArchivo =
  | 'apagado'
  | 'aviso-no-aprobado'
  | 'sin-consentimiento'
  | 'no-enlazado'
  | 'archivado';

export async function intentarArchivar(
  env: EntornoAlmacen,
  entrada: { consentimiento: boolean; conversationId: string; ahora?: Date },
): Promise<{ persistido: boolean; motivo: MotivoArchivo }> {
  if (env.AVISO_APROBADO !== '1') return { persistido: false, motivo: 'aviso-no-aprobado' };
  if (env.ALMACENAMIENTO_ACTIVO !== '1') return { persistido: false, motivo: 'apagado' };
  if (!entrada.consentimiento) return { persistido: false, motivo: 'sin-consentimiento' };
  const almacen = resolverAlmacen(env);
  if (almacen instanceof AlmacenamientoApagado || almacen instanceof AlmacenamientoNoEnlazado) {
    return { persistido: false, motivo: 'no-enlazado' };
  }
  const aceptadoEn = (entrada.ahora ?? new Date()).toISOString();
  const consentimiento = {
    versionAviso: AVISO_VERSION,
    aceptadoEn,
    conversationId: entrada.conversationId,
  };
  await almacen.archivar({ conversationId: entrada.conversationId, consentimiento });
  return { persistido: true, motivo: 'archivado' };
}
