export type CargaToken = {
  v: 1;
  c: string;
  m: string;
  e: number;
};

function aBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function desdeBase64Url(texto: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(texto)) return null;
  const relleno = texto.length % 4 === 0 ? '' : '='.repeat(4 - (texto.length % 4));
  try {
    const binario = atob(texto.replaceAll('-', '+').replaceAll('_', '/') + relleno);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function clave(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function firmarToken(secret: string, carga: CargaToken): Promise<string> {
  const cuerpo = aBase64Url(new TextEncoder().encode(JSON.stringify(carga)));
  const firma = new Uint8Array(
    await crypto.subtle.sign('HMAC', await clave(secret), new TextEncoder().encode(cuerpo)),
  );
  return `${cuerpo}.${aBase64Url(firma)}`;
}

export async function verificarToken(
  secret: string,
  token: string,
  ahoraSeg = Math.floor(Date.now() / 1000),
): Promise<CargaToken | null> {
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [cuerpo, firmaTexto] = partes;
  if (!cuerpo || !firmaTexto) return null;
  const firma = desdeBase64Url(firmaTexto);
  if (!firma) return null;
  const valida = await crypto.subtle.verify(
    'HMAC',
    await clave(secret),
    firma.slice(),
    new TextEncoder().encode(cuerpo),
  );
  if (!valida) return null;
  const json = desdeBase64Url(cuerpo);
  if (!json) return null;
  let carga: Partial<CargaToken>;
  try {
    carga = JSON.parse(new TextDecoder().decode(json)) as Partial<CargaToken>;
  } catch {
    return null;
  }
  if (carga.v !== 1 || typeof carga.c !== 'string' || typeof carga.m !== 'string' || typeof carga.e !== 'number') {
    return null;
  }
  if (!Number.isFinite(carga.e) || carga.e < ahoraSeg) return null;
  return { v: 1, c: carga.c, m: carga.m, e: carga.e };
}
