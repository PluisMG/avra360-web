'use strict';

(function () {
  var CLAVE = 'mkt-creativa-consentimiento';
  var banner = document.getElementById('consentimiento');
  var aceptar = document.getElementById('consent-aceptar');
  var rechazar = document.getElementById('consent-rechazar');
  var reabrir = document.getElementById('consent-reabrir');
  if (!banner || !aceptar || !rechazar) return;

  var ga = banner.getAttribute('data-ga') || '';
  var pixel = banner.getAttribute('data-pixel') || '';

  function validoGa(id) {
    return /^G-[A-Za-z0-9]+$/.test(id);
  }

  function validoPixel(id) {
    return /^\d{5,20}$/.test(id);
  }

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
    try {
      localStorage.setItem(CLAVE, valor);
    } catch (error) {
      /* El sitio sigue usable si el almacenamiento está bloqueado. */
    }
    banner.hidden = true;
    if (valor === 'aceptado') cargar();
  }

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

  var previo = null;
  try {
    previo = localStorage.getItem(CLAVE);
  } catch (error) {
    previo = null;
  }
  if (previo === 'aceptado') {
    banner.hidden = true;
    cargar();
  } else if (previo === 'rechazado') {
    banner.hidden = true;
  }
})();
