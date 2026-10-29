import {
  ESPERA_INICIAL_MS,
  TEXTO_CONFIGURACION,
  TEXTO_LENTO,
  esperaAgotada,
  siguienteEspera,
} from './estado.ts';

const CLAVE_CONVERSACION = 'avra360.conversationId';

type MensajeEvento = {
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

  area.addEventListener('focus', () => {
    if (activo) void cargarTurnstile();
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

  async function enviarTexto(bruto: string): Promise<void> {
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
      const token = await tokenTurnstile();
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
      agregarMensaje('assistant', reply);
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
    const turno = (
      window as Window & {
        turnstile?: { execute: (id: string) => void };
      }
    ).turnstile;
    const idWidget = widgetId;
    if (!turno || !idWidget) throw new Error('turnstile');
    return new Promise((resolver, rechazar) => {
      const nodo = document.querySelector<HTMLElement>('#turnstile');
      if (!nodo) {
        rechazar(new Error('turnstile'));
        return;
      }
      const limite = window.setTimeout(() => rechazar(new Error('turnstile')), 15_000);
      nodo.addEventListener(
        'turno',
        (evento) => {
          window.clearTimeout(limite);
          resolver((evento as CustomEvent<string>).detail);
        },
        { once: true },
      );
      const api = (
        window as Window & {
          turnstile?: {
            execute: (id: string, opciones?: Record<string, unknown>) => void;
          };
        }
      ).turnstile;
      api?.execute(idWidget, {
        callback: (token: string) => {
          nodo.dispatchEvent(new CustomEvent('turno', { detail: token }));
        },
        'error-callback': () => rechazar(new Error('turnstile')),
      });
    });
  }
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolver) => {
    window.setTimeout(resolver, ms);
  });
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

iniciarChat();
