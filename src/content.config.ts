import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { validarFechaEdicion } from './config/fechas';

const fechaDeEdicion = z.preprocess((valor) => {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const anio = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
  return valor;
}, z.string().superRefine((valor, contexto) => {
  const error = validarFechaEdicion(valor);
  if (error) contexto.addIssue({ code: 'custom', message: error });
}));

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
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo usa minúsculas, números y guiones.')
      .optional(),
    modificado: fechaDeEdicion.optional(),
    autor: z.string().min(3, 'El autor necesita un nombre.').optional(),
    fuentes: z
      .array(z.string().refine((valor) => valor.startsWith('https://'), 'Cada fuente debe ser una URL https.'))
      .optional(),
    palabras: z.array(z.string().min(2)).max(12, 'Doce palabras clave como máximo.').optional(),
    sufijo: z.boolean().optional(),
  }),
});

const paginas = defineCollection({
  loader: glob({ base: './src/content/paginas', pattern: '**/*.md' }),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo usa minúsculas, números y guiones.'),
    tipo: z.enum(['servicio', 'guia', 'nosotros']),
    titulo: z.string().min(12, 'El título SEO necesita al menos 12 caracteres.').max(80),
    descripcion: z.string().min(50, 'La meta descripción necesita al menos 50 caracteres.').max(180),
    h1: z.string().min(12).max(120),
    sufijo: z.boolean().optional(),
  }),
});

export const collections = { boletin, paginas };
