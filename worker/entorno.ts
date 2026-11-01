export function presente(valor: string | undefined): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

export function textoEnv(env: Env, clave: keyof Env): string {
  const valor = env[clave];
  return typeof valor === 'string' ? valor : '';
}

export function chatListo(env: Env): boolean {
  const webhook = textoEnv(env, 'AVRA_WEBHOOK_URL');
  return (
    textoEnv(env, 'CHAT_ACTIVO') === '1' &&
    presente(webhook) &&
    presente(textoEnv(env, 'AVRA_WEBHOOK_KEY')) &&
    presente(textoEnv(env, 'AVRA_REPLY_SIGNING_SECRET')) &&
    presente(textoEnv(env, 'TURNSTILE_SECRET_KEY')) &&
    presente(textoEnv(env, 'PUBLIC_TURNSTILE_SITE_KEY')) &&
    esWebhook(webhook)
  );
}

function esWebhook(valor: string | undefined): boolean {
  if (!valor) return false;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
