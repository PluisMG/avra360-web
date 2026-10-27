'use strict';

var CLAVE = 'mkt-creativa-consentimiento';
export var CAMPO_TRAMPA = 'empresa_web';

export function validoGa(id) {
  return /^G-[A-Za-z0-9]+$/.test(id);
}

export function validoPixel(id) {
  return /^\d{5,20}$/.test(id);
}

export function tipoContacto(href) {
  if (typeof href !== 'string' || href.trim() === '') return null;
  var url;
  try {
    url = new URL(href, 'https://mktcreativa.example');
  } catch (error) {
    return null;
  }
  if (url.protocol === 'tel:') return 'contacto_llamada';
  if (url.protocol === 'https:' && (url.hostname === 'wa.me' || url.hostname === 'www.wa.me')) {
    return 'contacto_whatsapp';
  }
  return null;
}

/**
 * No envía nada si el consentimiento no está aceptado.
 * Con consentimiento, GA4 recibe el nombre del clic y Meta, si hay píxel, el evento Contact.
 */
export function despacharContacto(opciones) {
  var enviados = [];
  if (!opciones || opciones.consentimiento !== 'aceptado') return enviados;
  var nombre = tipoContacto(opciones.href);
  if (!nombre) return enviados;
  if (validoGa(opciones.gaId) && typeof opciones.gtag === 'function') {
    opciones.gtag('event', nombre, { transport_type: 'beacon' });
    enviados.push({ canal: 'ga4', nombre: nombre });
  }
  if (validoPixel(opciones.pixelId) && typeof opciones.fbq === 'function') {
    opciones.fbq('track', 'Contact', { content_name: nombre });
    enviados.push({ canal: 'meta', nombre: 'Contact' });
  }
  return enviados;
}

export function nombresAnalitica(encabezado) {
  var encontrados = new Set();
  var texto = typeof encabezado === 'string' ? encabezado : '';
  var partes = texto.split(';');
  for (var i = 0; i < partes.length; i += 1) {
    var nombre = partes[i].split('=')[0].trim();
    if (nombre === '_ga' || nombre === '_fbp' || nombre.indexOf('_ga_') === 0) encontrados.add(nombre);
  }
  encontrados.add('_ga');
  encontrados.add('_fbp');
  return Array.from(encontrados).sort();
}

export function dominiosDeBorrado(hostname) {
  var host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.indexOf(':') !== -1) return [''];
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return [''];
  var etiquetas = host.split('.').filter(Boolean);
  var dominios = new Set(['', host, '.' + host]);
  if (etiquetas.length >= 3) {
    var padre = etiquetas.slice(1).join('.');
    if (padre.split('.').length >= 2) {
      dominios.add(padre);
      dominios.add('.' + padre);
    }
    var registrable = etiquetas.slice(-2).join('.');
    dominios.add(registrable);
    dominios.add('.' + registrable);
  }
  return Array.from(dominios);
}

export function directivasDeBorrado(nombres, hostname) {
  var dominios = dominiosDeBorrado(hostname);
  var salida = [];
  for (var i = 0; i < nombres.length; i += 1) {
    for (var j = 0; j < dominios.length; j += 1) {
      var domain = dominios[j] ? '; Domain=' + dominios[j] : '';
      var base = nombres[i] + '=; Max-Age=0; Path=/' + domain;
      salida.push(base);
      salida.push(base + '; Secure');
    }
  }
  return salida;
}

export function borrarCookiesAnalitica(documento, hostname) {
  var directivas = directivasDeBorrado(nombresAnalitica(documento.cookie || ''), hostname);
  for (var i = 0; i < directivas.length; i += 1) documento.cookie = directivas[i];
  return directivas;
}

export function prepararTrampa(valor) {
  if (typeof valor !== 'string' || valor === '') return 'omitir';
  return 'bloquear';
}

export function revisarFormulario(form) {
  if (!form || typeof form.querySelector !== 'function') return 'ajeno';
  var campo = form.querySelector('input[name="' + CAMPO_TRAMPA + '"]');
  if (!campo) return 'ajeno';
  if (prepararTrampa(campo.value) === 'bloquear') return 'bloquear';
  campo.disabled = true;
  return 'omitir';
}

export function aplicarTrampa(evento) {
  var decision = revisarFormulario(evento && evento.target);
  if (decision === 'bloquear') {
    if (evento && typeof evento.preventDefault === 'function') evento.preventDefault();
    return 'bloquear';
  }
  if (decision === 'omitir' && evento && evento.formData && typeof evento.formData.delete === 'function') {
    evento.formData.delete(CAMPO_TRAMPA);
  }
  return decision;
}

if (typeof document !== 'undefined') {
  document.addEventListener(
    'submit',
    function (evento) {
      aplicarTrampa(evento);
    },
    true,
  );

  var banner = document.getElementById('consentimiento');
  var aceptar = document.getElementById('consent-aceptar');
  var rechazar = document.getElementById('consent-rechazar');
  var reabrir = document.getElementById('consent-reabrir');
  var ga = banner ? banner.getAttribute('data-ga') || '' : '';
  var pixel = banner ? banner.getAttribute('data-pixel') || '' : '';
  var estado = null;

  function cargarGa(id) {
    if (window.__mktGa) return;
    window.__mktGa = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', id);
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  function cargarPixel(id) {
    if (window.__mktPixel) return;
    window.__mktPixel = true;
    var fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/es_LA/fbevents.js';
    document.head.appendChild(script);
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  function cargar() {
    if (validoGa(ga)) cargarGa(ga);
    if (validoPixel(pixel)) cargarPixel(pixel);
  }

  function guardar(valor) {
    estado = valor;
    try {
      localStorage.setItem(CLAVE, valor);
    } catch (error) {
      /* El sitio sigue usable si el almacenamiento está bloqueado. */
    }
    if (banner) banner.hidden = true;
    if (valor === 'aceptado') cargar();
    if (valor === 'rechazado') borrarCookiesAnalitica(document, location.hostname);
  }

  document.addEventListener('click', function (evento) {
    var nodo = evento.target;
    if (nodo && nodo.nodeType === 3) nodo = nodo.parentElement;
    if (!nodo || typeof nodo.closest !== 'function') return;
    var enlace = nodo.closest('a');
    if (!enlace) return;
    despacharContacto({
      consentimiento: estado,
      href: enlace.href,
      gaId: ga,
      pixelId: pixel,
      gtag: window.gtag,
      fbq: window.fbq,
    });
  });

  if (banner && aceptar && rechazar) {
    aceptar.addEventListener('click', function () {
      guardar('aceptado');
    });
    rechazar.addEventListener('click', function () {
      guardar('rechazado');
    });
    if (reabrir) {
      reabrir.addEventListener('click', function () {
        banner.hidden = false;
      });
    }

    try {
      estado = localStorage.getItem(CLAVE);
    } catch (error) {
      estado = null;
    }
    if (estado === 'aceptado') {
      banner.hidden = true;
      cargar();
    } else if (estado === 'rechazado') {
      banner.hidden = true;
      borrarCookiesAnalitica(document, location.hostname);
    } else {
      estado = null;
    }
  }
}
