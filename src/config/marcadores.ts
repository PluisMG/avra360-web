import { pendientes } from './agencia';

export const MARCADORES = [
  pendientes.razonSocial,
  pendientes.domicilio,
  pendientes.correoPrivacidad,
  pendientes.horario,
  pendientes.proveedorHospedaje,
] as const;

const expresion = new RegExp(
  `(${MARCADORES.map((marcador) => marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'g',
);

export function partes(texto: string) {
  return texto
    .split(expresion)
    .filter((trozo) => trozo.length > 0)
    .map((valor) => ({
      marcador: (MARCADORES as readonly string[]).includes(valor),
      valor,
    }));
}
