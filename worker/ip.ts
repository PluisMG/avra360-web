export async function hashIp(ip: string): Promise<string> {
  const datos = new TextEncoder().encode(`avra360-preview\n${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function ipDe(request: Request): string {
  const valor = request.headers.get('cf-connecting-ip')?.trim();
  return valor || 'sin-ip';
}
