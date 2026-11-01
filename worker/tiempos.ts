export type CampoTiempo =
  | 't_recibido'
  | 't_webhook_ok'
  | 't_respuesta'
  | 't_entregado'
  | 't_primer_token'
  | 't_fin';

export type MarcasTiempo = {
  t_recibido: number | null;
  t_webhook_ok: number | null;
  t_respuesta: number | null;
  t_entregado: number | null;
  t_primer_token: number | null;
  t_fin: number | null;
  fallback: number | null;
};

const CAMPOS: CampoTiempo[] = [
  't_recibido',
  't_webhook_ok',
  't_respuesta',
  't_entregado',
  't_primer_token',
  't_fin',
];

/** Solo identificadores y milisegundos. Sin texto del chat ni datos personales. */
export function logTiempo(conversationId: string, messageId: string, marcas: MarcasTiempo): void {
  const salida: Record<string, string | number | boolean> = {
    evento: 'chat_tiempo',
    conversationId,
    messageId,
  };
  for (const campo of CAMPOS) {
    const valor = marcas[campo];
    if (valor != null) salida[campo] = valor;
  }
  if (marcas.t_recibido != null && marcas.t_webhook_ok != null) {
    salida.ms_webhook = marcas.t_webhook_ok - marcas.t_recibido;
  }
  if (marcas.t_webhook_ok != null && marcas.t_respuesta != null) {
    salida.ms_respuesta = marcas.t_respuesta - marcas.t_webhook_ok;
  }
  if (marcas.t_respuesta != null && marcas.t_entregado != null) {
    salida.ms_entrega = marcas.t_entregado - marcas.t_respuesta;
  }
  if (marcas.t_recibido != null && marcas.t_entregado != null) {
    salida.ms_total = marcas.t_entregado - marcas.t_recibido;
  }
  if (marcas.t_recibido != null && marcas.t_primer_token != null) {
    salida.ms_primer_token = marcas.t_primer_token - marcas.t_recibido;
  }
  if (marcas.t_recibido != null && marcas.t_fin != null) {
    salida.ms_generacion = marcas.t_fin - marcas.t_recibido;
  }
  if (marcas.fallback != null) salida.fallback = marcas.fallback === 1;
  console.log(JSON.stringify(salida));
}
