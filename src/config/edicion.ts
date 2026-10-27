export function slugDeEdicion(edicion: { id: string; data: { slug?: string } }) {
  return edicion.data.slug || edicion.id;
}

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (caracter) => {
    switch (caracter) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function enlaces(texto: string) {
  return texto.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>');
}

function bloque(texto: string) {
  const limpio = texto.trim();
  if (limpio.startsWith('### ')) return `<h3>${enlaces(escapar(limpio.slice(4)))}</h3>`;
  if (limpio.startsWith('## ')) return `<h2>${enlaces(escapar(limpio.slice(3)))}</h2>`;
  return `<p>${enlaces(escapar(limpio))}</p>`;
}

/** HTML del RSS: cuerpo en Markdown, si lo hay, y después las notas. */
export function htmlDeEdicion(edicion: {
  body?: string;
  data: { notas: readonly { titulo: string; texto: string }[] };
}) {
  const cuerpo = edicion.body?.trim()
    ? edicion.body
        .trim()
        .split(/\n{2,}/)
        .map((parte) => bloque(parte))
        .join('')
    : '';
  const notas = edicion.data.notas
    .map((nota) => `<h2>${escapar(nota.titulo)}</h2><p>${escapar(nota.texto)}</p>`)
    .join('');
  return `${cuerpo}${notas}`;
}
