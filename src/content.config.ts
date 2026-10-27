import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const fechaDeEdicion = z.preprocess((valor) => {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const anio = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
  return valor;
}, z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha se escribe AAAA-MM-DD.'))
  .superRefine((valor, contexto) => {
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    const real =
      fecha.getUTCFullYear() === anio &&
      fecha.getUTCMonth() === mes - 1 &&
      fecha.getUTCDate() === dia;
    if (!real) {
      contexto.addIssue({ code: 'custom', message: 'La fecha no existe en el calendario.' });
      return;
    }
    if (dia !== 1 && dia !== 15) {
      contexto.addIssue({
        code: 'custom',
        message: 'El boletín sale el día 1 o el día 15. Use una de esas fechas.',
      });
    }
  });

const boletin = defineCollection({
  loader: glob({ base: './src/content/boletin', pattern: '**/*.md' }),
  schema: z.object({
    titulo: z.string().min(12, 'El título necesita al menos 12 caracteres.'),
    fecha: fechaDeEdicion,
    tema: z.string().min(8, 'Falta el tema principal.'),
    descripcion: z
      .string()
      .min(50, 'La descripción necesita al menos 50 caracteres.')
      .max(160, 'La descripción no debe pasar de 160 caracteres.'),
    notas: z
      .array(
        z.object({
          titulo: z.string().min(8, 'Cada nota necesita un título.'),
          texto: z.string().min(40, 'Cada nota necesita un texto breve de al menos 40 caracteres.'),
        }),
      )
      .min(2, 'Cada edición lleva 2 o 3 notas.')
      .max(3, 'Cada edición lleva 2 o 3 notas.'),
    llamado: z.object({
      texto: z.string().min(20, 'El llamado a la acción necesita un texto.'),
      enlace: z
        .string()
        .refine(
          (valor) => valor.startsWith('/') || valor.startsWith('https://'),
          'El enlace del llamado debe ser una ruta del sitio o una URL https.',
        ),
      etiqueta: z.string().min(4, 'Falta la etiqueta del botón o enlace.'),
    }),
    ejemplo: z.boolean().default(false),
  }),
});

export const collections = { boletin };
