import {
  ESPERA_INICIAL_MS,
  ESPERA_MAX_MS,
  TEXTO_CONFIGURACION,
  TEXTO_LENTO,
  esperaAgotada,
  siguienteEspera,
} from './estado.ts';

const CLAVE_CONVERSACION = 'avra360.conversationId';

type MensajeEvento = {
  id?: string;
  role?: string;
  text?: string;
  replyTo?: string;
};

export function iniciarChat(): void {
  const formQuery = document.querySelector<HTMLFormElement>('[data-chat]');
  const areaQuery = document.querySelector<HTMLTextAreaElement>('#mensaje');
  const hiloQuery = document.querySelector<HTMLElement>('#hilo');
  const listaQuery = document.querySelector<HTMLElement>('#mensajes');
  if (!formQuery || !areaQuery || !hiloQuery || !listaQuery) return;
  const formulario: HTMLFormElement = formQuery;
  const area: HTMLTextAreaElement = areaQuery;
  const hilo: HTMLElement = hiloQuery;
  const lista: HTMLElement = listaQuery;

  const activo =
    formulario.dataset.chatActivo === '1' &&
    /^[0-9A-Za-z_-]{8,200}$/.test(formulario.dataset.turnstileSiteKey ?? '');
  let ocupado = false;
  let widgetId: string | undefined;
  let turnstileListo: Promise<void> | undefined;
  // Tras entregar un token, el widget queda resuelto: execute() sin reset()
  // devuelve el mismo token ya gastado y Siteverify responde 403.
  let tokenEntregado = false;
  // Token ya pedido y todavía no verificado. reset() en ese lapso lo invalida.
  let tokenEnVuelo = false;
  let reserva: Promise<string> | null = null;

  area.addEventListener('focus', () => {
    if (activo) precalentarTurnstile();
  });

  area.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' || evento.shiftKey || evento.isComposing) return;
    evento.preventDefault();
    void enviarTexto(area.value);
  });

  const botonEnviar = formulario.querySelector<HTMLButtonElement>('.enviar');
  if (botonEnviar) {
    botonEnviar.disabled = false;
    botonEnviar.addEventListener('click', () => {
      void enviarTexto(area.value);
    });
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    void enviarTexto(area.value);
  });

  for (const boton of document.querySelectorAll<HTMLButtonElement>('[data-sugerencia]')) {
    boton.addEventListener('click', () => {
      void enviarTexto(boton.textContent ?? '');
    });
  }

  const historialListo = restaurarHistorial();

  async function enviarTexto(bruto: string): Promise<void> {
    await historialListo;
    const texto = bruto.trim();
    if (!texto || ocupado) return;
    ocupado = true;
    area.value = '';
    agregarMensaje('user', texto);
    entrarConversacion();
    if (!activo) {
      mostrarConfiguracion();
      soltarFoco();
      return;
    }
    mostrarEscribiendo();
    try {
      let { respuesta, data } = await mandarMensaje(texto);
      // Un token de Turnstile se valida una sola vez. Si el servidor lo rechaza
      // (vencido o repetido), se pide uno nuevo y se reintenta una sola vez.
      if (respuesta.status === 403 && data?.status === 'verificacion') {
        ({ respuesta, data } = await mandarMensaje(texto));
      }
      if (respuesta.status === 404 && data?.status === 'no-encontrado') {
        olvidarConversacion();
        ({ respuesta, data } = await mandarMensaje(texto));
      }
      if (respuesta.status === 503 && data?.status === 'configurando') {
        quitarEscribiendo();
        mostrarConfiguracion();
        return;
      }
      if (respuesta.status === 429) {
        quitarEscribiendo();
        mostrarFallo('Has enviado muchos mensajes. Espera un momento e inténtalo de nuevo.', texto);
        return;
      }
      if (!respuesta.ok || !data?.conversationId || !data.messageId) {
        quitarEscribiendo();
        mostrarFallo('No se pudo enviar el mensaje. Inténtalo de nuevo.', texto);
        return;
      }
      guardarConversacion(data.conversationId);
      const reply = await esperarRespuesta(data.conversationId, data.messageId);
      quitarEscribiendo();
      if (!lista.querySelector(`[data-reply="${data.messageId}"]`)) agregarMensaje('assistant', reply);
    } catch (error) {
      quitarEscribiendo();
      if (error instanceof Error && error.message === 'lento') {
        mostrarFallo(TEXTO_LENTO, texto);
      } else {
        mostrarFallo('No se pudo enviar el mensaje. Inténtalo de nuevo.', texto);
      }
    } finally {
      soltarFoco();
    }
  }

  async function mandarMensaje(texto: string): Promise<{
    respuesta: Response;
    data: { status?: string; conversationId?: string; messageId?: string } | null;
  }> {
    const token = await tomarToken();
    try {
      const cuerpo: { message: string; turnstileToken: string; conversationId?: string } = {
        message: texto,
        turnstileToken: token,
      };
      const guardado = leerConversacion();
      if (guardado) cuerpo.conversationId = guardado;
      const respuesta = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const data = (await respuesta.json().catch(() => null)) as {
        status?: string;
        conversationId?: string;
        messageId?: string;
      } | null;
      return { respuesta, data };
    } finally {
      tokenEnVuelo = false;
      precalentarTurnstile();
    }
  }

  function precalentarTurnstile(): void {
    if (!activo || reserva || tokenEnVuelo) return;
    const pendiente = tokenTurnstile();
    reserva = pendiente;
    pendiente.catch(() => {
      if (reserva === pendiente) reserva = null;
    });
  }

  async function tomarToken(): Promise<string> {
    if (!reserva) precalentarTurnstile();
    const pendiente = reserva;
    reserva = null;
    tokenEnVuelo = true;
    if (!pendiente) throw new Error('turnstile');
    return pendiente;
  }

  function soltarFoco(): void {
    ocupado = false;
    const enfocado = document.activeElement;
    if (enfocado instanceof HTMLButtonElement && enfocado.dataset.reintento === '1') return;
    area.focus();
  }

  function entrarConversacion(): void {
    if (document.body.classList.contains('en-conversacion')) return;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.add('replegando');
    hilo.hidden = false;
    if (reducir) {
      document.body.classList.add('en-conversacion');
      return;
    }
    window.setTimeout(() => {
      document.body.classList.add('en-conversacion');
    }, 220);
  }

  function agregarMensaje(rol: 'user' | 'assistant', texto: string): HTMLParagraphElement {
    const p = document.createElement('p');
    p.className = `mensaje mensaje-${rol}`;
    p.textContent = texto;
    lista.append(p);
    p.scrollIntoView({ block: 'nearest' });
    return p;
  }

  function mostrarConfiguracion(): void {
    const nota = document.querySelector<HTMLElement>('#nota-config');
    if (nota) nota.hidden = true;
    const p = document.createElement('p');
    p.className = 'mensaje mensaje-sistema';
    p.dataset.config = '1';
    p.textContent = TEXTO_CONFIGURACION;
    lista.append(p);
  }

  function mostrarEscribiendo(): void {
    quitarEscribiendo();
    const p = document.createElement('p');
    p.id = 'escribiendo';
    p.className = 'escribiendo';
    const etiqueta = document.createElement('span');
    etiqueta.className = 'sr';
    etiqueta.textContent = 'AVRA está escribiendo';
    const puntos = document.createElement('span');
    puntos.className = 'puntos';
    puntos.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i += 1) puntos.append(document.createElement('span'));
    p.append(etiqueta, puntos);
    lista.append(p);
  }

  function quitarEscribiendo(): void {
    document.querySelector('#escribiendo')?.remove();
  }

  function mostrarFallo(texto: string, reintento: string): void {
    const p = document.createElement('p');
    p.className = 'mensaje mensaje-error';
    p.textContent = texto;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'reintentar';
    boton.dataset.reintento = '1';
    boton.textContent = 'Reintentar';
    boton.addEventListener('click', () => {
      p.remove();
      boton.remove();
      void enviarTexto(reintento);
    });
    lista.append(p, boton);
    boton.focus();
  }

  async function esperarRespuesta(conversationId: string, messageId: string): Promise<string> {
    try {
      return await esperarPorSse(conversationId, messageId);
    } catch (error) {
      if (error instanceof Error && error.message === 'lento') throw error;
    }
    return esperarPorSondeo(conversationId, messageId);
  }

  async function esperarPorSse(conversationId: string, messageId: string): Promise<string> {
    const inicio = Date.now();
    const controlador = new AbortController();
    const respuesta = await fetch(
      `/api/chat/${encodeURIComponent(conversationId)}/stream?messageId=${encodeURIComponent(messageId)}`,
      {
        headers: { accept: 'text/event-stream' },
        signal: controlador.signal,
      },
    );
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (!respuesta.ok || !respuesta.body || !tipo.includes('text/event-stream')) {
      controlador.abort();
      throw new Error('sse');
    }
    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let resto = '';
    let texto = '';
    let esperaConfirmacion = false;
    try {
      while (!esperaAgotada(inicio, Date.now())) {
        const paso = await leerConTope(lector, inicio);
        if (paso.done) break;
        if (!paso.value) continue;
        resto += decodificador.decode(paso.value, { stream: true });
        const bloques = resto.split('\n\n');
        resto = bloques.pop() ?? '';
        for (const bloque of bloques) {
          const evento = parsearEvento(bloque);
          if (!evento) continue;
          if (
            (evento.nombre === 'delta' && evento.datos.messageId === messageId) ||
            (evento.nombre === 'mensaje' && evento.datos.replyTo === messageId)
          ) {
            if (typeof evento.datos.text !== 'string') continue;
            texto = evento.nombre === 'delta' ? texto + evento.datos.text : evento.datos.text;
            pintarRespuesta(messageId, texto);
          } else if (
            esperaConfirmacion &&
            evento.nombre === 'mensaje' &&
            evento.datos.role === 'assistant' &&
            typeof evento.datos.replyTo === 'string' &&
            evento.datos.replyTo !== messageId &&
            typeof evento.datos.text === 'string'
          ) {
            const nuevo = mostrarUnaVez(evento.datos.replyTo, evento.datos.text);
            if (nuevo) return texto;
          }
          if (evento.nombre === 'fin' && evento.datos.messageId === messageId && texto) {
            if (evento.datos.traspaso === true) {
              esperaConfirmacion = true;
              continue;
            }
            return texto;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'lento' && texto && !esperaConfirmacion) return texto;
      if (error instanceof Error && error.message === 'lento' && esperaConfirmacion) throw error;
      if (texto && !esperaConfirmacion) return texto;
      throw error;
    } finally {
      controlador.abort();
    }
    if (texto) return texto;
    if (esperaAgotada(inicio, Date.now())) throw new Error('lento');
    throw new Error('sse');
  }

  function pintarRespuesta(clave: string, texto: string): void {
    quitarEscribiendo();
    const p = buscarRespuesta(clave);
    if (!p) {
      const nuevo = agregarMensaje('assistant', texto);
      nuevo.dataset.reply = clave;
      return;
    }
    p.textContent = texto;
  }

  function mostrarUnaVez(clave: string, texto: string): boolean {
    if (buscarRespuesta(clave)) return false;
    const p = agregarMensaje('assistant', texto);
    p.dataset.reply = clave;
    return true;
  }

  function buscarRespuesta(clave: string): HTMLParagraphElement | null {
    if (!/^[0-9a-f-]{36}$/i.test(clave)) return null;
    return lista.querySelector<HTMLParagraphElement>(`[data-reply="${clave}"]`);
  }

  async function restaurarHistorial(): Promise<void> {
    const id = leerConversacion();
    if (!activo || !id) return;
    try {
      const respuesta = await fetch(`/api/chat/${encodeURIComponent(id)}/events`);
      if (respuesta.status === 404) {
        olvidarConversacion();
        return;
      }
      if (!respuesta.ok) return;
      const data = (await respuesta.json()) as { messages?: MensajeEvento[] };
      const mensajes = data.messages ?? [];
      if (mensajes.length === 0) return;
      entrarConversacion();
      for (const mensaje of mensajes) {
        if ((mensaje.role !== 'user' && mensaje.role !== 'assistant') || typeof mensaje.text !== 'string') continue;
        if (mensaje.role === 'assistant') {
          const clave = typeof mensaje.replyTo === 'string' ? mensaje.replyTo : null;
          if (clave && buscarRespuesta(clave)) continue;
          const p = agregarMensaje('assistant', mensaje.text);
          if (clave && /^[0-9a-f-]{36}$/i.test(clave)) p.dataset.reply = clave;
        } else {
          agregarMensaje('user', mensaje.text);
        }
      }
    } catch {
      /* si el historial no carga, esta visita igual puede empezar de cero */
    }
  }

  async function esperarPorSondeo(conversationId: string, messageId: string): Promise<string> {
    const inicio = Date.now();
    let espera = ESPERA_INICIAL_MS;
    while (!esperaAgotada(inicio, Date.now())) {
      await dormir(espera);
      if (esperaAgotada(inicio, Date.now())) break;
      const respuesta = await fetch(`/api/chat/${encodeURIComponent(conversationId)}/events`);
      if (!respuesta.ok) throw new Error('eventos');
      const data = (await respuesta.json()) as { messages?: MensajeEvento[] };
      const hallado = (data.messages ?? []).find(
        (mensaje) =>
          mensaje.role === 'assistant' && mensaje.replyTo === messageId && typeof mensaje.text === 'string',
      );
      if (hallado?.text) return hallado.text;
      espera = siguienteEspera(espera);
    }
    throw new Error('lento');
  }

  function cargarTurnstile(): Promise<void> {
    const siteKey = formulario.dataset.turnstileSiteKey ?? '';
    turnstileListo ??= new Promise((resolver, rechazar) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        const turno = (
          window as Window & {
            turnstile?: {
              render: (nodo: HTMLElement, opciones: Record<string, unknown>) => string;
              execute: (id: string) => void;
            };
          }
        ).turnstile;
        const nodo = document.querySelector<HTMLElement>('#turnstile');
        if (!turno || !nodo) {
          rechazar(new Error('turnstile'));
          return;
        }
        widgetId = turno.render(nodo, {
          sitekey: siteKey,
          execution: 'execute',
          appearance: 'interaction-only',
        });
        resolver();
      };
      script.onerror = () => rechazar(new Error('turnstile'));
      document.head.append(script);
    });
    return turnstileListo;
  }

  async function tokenTurnstile(): Promise<string> {
    await cargarTurnstile();
    const api = (
      window as Window & {
        turnstile?: {
          execute: (id: string, opciones?: Record<string, unknown>) => void;
          reset: (id: string) => void;
        };
      }
    ).turnstile;
    const idWidget = widgetId;
    if (!api || !idWidget) throw new Error('turnstile');
    if (tokenEntregado) {
      api.reset(idWidget);
      tokenEntregado = false;
    }
    return new Promise((resolver, rechazar) => {
      let listo = false;
      const terminar = (token?: string) => {
        if (listo) return;
        listo = true;
        window.clearTimeout(limite);
        if (token) {
          tokenEntregado = true;
          resolver(token);
        } else {
          // Deja el widget limpio para el siguiente intento.
          tokenEntregado = true;
          rechazar(new Error('turnstile'));
        }
      };
      const limite = window.setTimeout(() => terminar(), 15_000);
      api.execute(idWidget, {
        callback: (token: string) => terminar(token),
        'error-callback': () => terminar(),
        'expired-callback': () => terminar(),
        'timeout-callback': () => terminar(),
      });
    });
  }
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolver) => {
    window.setTimeout(resolver, ms);
  });
}

async function leerConTope(
  lector: ReadableStreamDefaultReader<Uint8Array>,
  inicio: number,
): Promise<{ done: boolean; value?: Uint8Array }> {
  const restante = ESPERA_MAX_MS - (Date.now() - inicio);
  if (restante <= 0) throw new Error('lento');
  let temporizador = 0;
  const tope = new Promise<never>((_, rechazar) => {
    temporizador = window.setTimeout(() => rechazar(new Error('lento')), restante);
  });
  try {
    return await Promise.race([lector.read(), tope]);
  } finally {
    window.clearTimeout(temporizador);
  }
}

function parsearEvento(bloque: string): { nombre: string; datos: Record<string, unknown> } | null {
  let nombre = 'message';
  const datos: string[] = [];
  for (const linea of bloque.split('\n')) {
    if (linea.startsWith(':')) continue;
    if (linea.startsWith('event:')) nombre = linea.slice(6).trim();
    else if (linea.startsWith('data:')) datos.push(linea.slice(5).trim());
  }
  if (datos.length === 0) return null;
  try {
    const valor = JSON.parse(datos.join('\n')) as unknown;
    if (!valor || typeof valor !== 'object') return null;
    return { nombre, datos: valor as Record<string, unknown> };
  } catch {
    return null;
  }
}

function leerConversacion(): string | null {
  try {
    const valor = localStorage.getItem(CLAVE_CONVERSACION);
    return valor && /^[0-9a-f-]{36}$/i.test(valor) ? valor : null;
  } catch {
    return null;
  }
}

function guardarConversacion(id: string): void {
  try {
    localStorage.setItem(CLAVE_CONVERSACION, id);
  } catch {
    /* el aviso explica que el identificador vive en el navegador; si está bloqueado, el hilo sigue en esta visita */
  }
}

function olvidarConversacion(): void {
  try {
    localStorage.removeItem(CLAVE_CONVERSACION);
  } catch {
    /* si el almacenamiento está bloqueado, el siguiente envío igual puede ir sin id */
  }
}

iniciarChat();
