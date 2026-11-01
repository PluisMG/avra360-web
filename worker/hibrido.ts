import { intentarArchivar } from './almacenamiento.ts';
import type { Conversation } from './conversation.ts';
import { VIDA_TOKEN_SEG } from './constantes.ts';
import { textoEnv } from './entorno.ts';
import { hablarConModelo, mensajeParaAvra, modeloDe, timeoutGeneracion, timeoutPrimerToken, type PedidoAvra } from './openai.ts';
import { firmarToken } from './tokens.ts';
import { despertarAvra, webhookAceptado, type CuerpoWebhook } from './webhook.ts';

type StubConversacion = DurableObjectStub<Conversation>;

const TOPE_OBJETO_MS = 3_000;

export async function correrHibrido(
  env: Env,
  conversacion: StubConversacion,
  cuerpo: CuerpoWebhook,
  messageId: string,
): Promise<void> {
  try {
    await atenderHibrido(env, conversacion, cuerpo, messageId);
  } catch {
    console.log(JSON.stringify({ evento: 'error', nombre: 'Error', conversationId: cuerpo.conversationId, messageId }));
    await caerAAvra(env, conversacion, cuerpo, messageId, 'error');
  }
}

async function atenderHibrido(
  env: Env,
  conversacion: StubConversacion,
  cuerpo: CuerpoWebhook,
  messageId: string,
): Promise<void> {
  const resultado = await hablarConModelo({
    apiKey: textoEnv(env, 'OPENAI_API_KEY'),
    modelo: modeloDe(env),
    historial: cuerpo.history,
    mensaje: cuerpo.message,
    timeoutMs: timeoutPrimerToken(env),
    timeoutTotalMs: timeoutGeneracion(env),
    alDelta: async (fragmento) => {
      await conTope(conversacion.emitir('delta', { messageId, text: fragmento }));
    },
  });

  if (!resultado.ok) {
    await caerAAvra(env, conversacion, cuerpo, messageId, resultado.motivo === 'timeout' ? 'timeout' : 'error');
    return;
  }

  const guardado = await conversacion.guardarAsistente(messageId, resultado.texto);
  if (guardado !== 'ok') {
    await caerAAvra(env, conversacion, cuerpo, messageId, 'error');
    return;
  }

  await conversacion.anotarTiempo(cuerpo.conversationId, messageId, 't_primer_token', resultado.tPrimerToken);
  await conversacion.anotarTiempo(cuerpo.conversationId, messageId, 't_fin', resultado.tFin, 0);
  await conTope(conversacion.emitir('mensaje', { role: 'assistant', replyTo: messageId, text: resultado.texto }));
  await conTope(conversacion.emitir('fin', { messageId, traspaso: resultado.traspaso !== null }));
  await conTope(Promise.resolve(conversacion.marcarEntregas(false)));
  await intentarArchivar(env, { consentimiento: false, conversationId: cuerpo.conversationId });

  if (resultado.traspaso) await pasarAAvra(env, conversacion, cuerpo, resultado.traspaso);
  await conTope(conversacion.publicarTiempo(cuerpo.conversationId, messageId));
}

async function caerAAvra(
  env: Env,
  conversacion: StubConversacion,
  cuerpo: CuerpoWebhook,
  messageId: string,
  motivo: 'sin_clave' | 'modo' | 'error' | 'timeout',
): Promise<void> {
  await conversacion.anotarTiempo(cuerpo.conversationId, messageId, 't_fin', Date.now(), 1);
  console.log(JSON.stringify({ evento: 'fallback', conversationId: cuerpo.conversationId, messageId, motivo }));
  await despertarYArchivar(env, conversacion, cuerpo, messageId);
  await conTope(conversacion.publicarTiempo(cuerpo.conversationId, messageId));
}

async function pasarAAvra(
  env: Env,
  conversacion: StubConversacion,
  anterior: CuerpoWebhook,
  pedido: PedidoAvra,
): Promise<void> {
  const resumen = mensajeParaAvra(pedido);
  const { messageId, history } = await conversacion.agregarInterno(resumen);
  await conversacion.anotarTiempo(anterior.conversationId, messageId, 't_recibido', Date.now());
  const expira = Math.floor(Date.now() / 1000) + VIDA_TOKEN_SEG;
  const replyToken = await firmarToken(textoEnv(env, 'AVRA_REPLY_SIGNING_SECRET'), {
    v: 1,
    c: anterior.conversationId,
    m: messageId,
    e: expira,
  });
  const cuerpo: CuerpoWebhook = {
    conversationId: anterior.conversationId,
    message: resumen,
    history,
    replyUrl: anterior.replyUrl,
    replyToken,
    site: anterior.site,
  };
  const estado = await despertarYArchivar(env, conversacion, cuerpo, messageId);
  console.log(
    JSON.stringify({
      evento: 'traspaso_avra',
      conversationId: anterior.conversationId,
      messageId,
      motivo: pedido.motivo,
      estado: estado ?? 0,
    }),
  );
}

async function despertarYArchivar(
  env: Env,
  conversacion: StubConversacion,
  cuerpo: CuerpoWebhook,
  messageId: string,
): Promise<number | null> {
  const estado = await despertarAvra(textoEnv(env, 'AVRA_WEBHOOK_URL'), textoEnv(env, 'AVRA_WEBHOOK_KEY'), cuerpo);
  if (webhookAceptado(estado)) await conversacion.anotarTiempo(cuerpo.conversationId, messageId, 't_webhook_ok', Date.now());
  await intentarArchivar(env, { consentimiento: false, conversationId: cuerpo.conversationId });
  return estado;
}

function conTope(promesa: Promise<unknown>): Promise<void> {
  return new Promise((resolver) => {
    const temporizador = setTimeout(resolver, TOPE_OBJETO_MS);
    promesa.then(
      () => {
        clearTimeout(temporizador);
        resolver();
      },
      () => {
        clearTimeout(temporizador);
        resolver();
      },
    );
  });
}
