export async function verificarTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  if (!token.trim()) return false;
  const cuerpo = new URLSearchParams();
  cuerpo.set('secret', secret);
  cuerpo.set('response', token);
  if (ip && ip !== 'sin-ip') cuerpo.set('remoteip', ip);
  try {
    const respuesta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
      signal: AbortSignal.timeout(8_000),
    });
    if (!respuesta.ok) return false;
    const data = (await respuesta.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
