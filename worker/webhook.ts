import { SITIO, TIMEOUT_WEBHOOK_MS } from './constantes.ts';

export type Turno = { role: 'user' | 'assistant'; text: string };

export type CuerpoWebhook = {
  conversationId: string;
  message: string;
  history: Turno[];
  replyUrl: string;
  replyToken: string;
  site: typeof SITIO;
};

export async function despertarAvra(url: string, key: string, cuerpo: CuerpoWebhook): Promise<number | null> {
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'x-automation-key': key,
        'content-type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_WEBHOOK_MS),
    });
    return respuesta.status;
  } catch {
    return null;
  }
}

export function webhookAceptado(estado: number | null): boolean {
  return estado !== null && estado >= 200 && estado < 300;
}
