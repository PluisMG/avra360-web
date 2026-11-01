export function json(datos: unknown, estado = 200): Response {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

type Lectura = { ok: true; valor: unknown } | { ok: false; motivo: 'largo' | 'invalido' };

export async function leerJson(request: Request, maximo = 16_000): Promise<Lectura> {
  const anunciado = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(anunciado) && anunciado > maximo) return { ok: false, motivo: 'largo' };
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > maximo) return { ok: false, motivo: 'largo' };
  try {
    return { ok: true, valor: JSON.parse(new TextDecoder().decode(buffer)) as unknown };
  } catch {
    return { ok: false, motivo: 'invalido' };
  }
}
