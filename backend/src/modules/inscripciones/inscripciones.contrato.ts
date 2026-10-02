import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { dinero, textoDescuento, type CobroAlumno } from './inscripciones.precios.js';

/**
 * El contrato en PDF, uno por alumno.
 *
 * El texto lo escribe Activa Reforce en el modulo interno, con marcadores
 * ({{alumno_nombre}}...). Se genera en el servidor al recibir el envio, ya
 * con los datos del representante, del alumno, sus disciplinas y lo que
 * paga, y se guarda con su sha256. Despues no se vuelve a generar: el PDF
 * guardado es lo que se firmo, aunque luego cambien la ficha del alumno, los
 * precios o el texto del contrato.
 *
 * Solo texto, con las fuentes estandar de PDF (sin incrustar ninguna): sale
 * en unos pocos KB, que es la "compresion" que un contrato necesita.
 */

/**
 * Los datos que el texto del contrato puede llevar. El modulo interno los
 * ensena como botones para insertarlos y como ejemplo rellenado.
 */
export const MARCADORES = {
  representante_nombre: 'Nombre del representante',
  representante_cedula: 'Cédula o pasaporte del representante',
  representante_correo: 'Correo del representante',
  representante_telefono: 'Teléfono del representante',
  representante_sector: 'Sector donde vive',
  parentesco: 'Parentesco con el alumno',
  alumno_nombre: 'Nombre del alumno',
  alumno_fecha_nacimiento: 'Fecha de nacimiento del alumno',
  alumno_cedula: 'Cédula del alumno',
  colegio: 'Colegio',
  grado: 'Grado',
  disciplinas: 'Disciplinas elegidas, separadas por punto y coma',
  precio_disciplina: 'Precio mensual de una disciplina en ese colegio',
  descuento: 'Descuento por hermano aplicado, o "Sin descuento"',
  valor_alumno: 'Lo que paga este alumno al mes',
  fecha: 'Fecha de la inscripción',
} as const;

export type Marcador = keyof typeof MARCADORES;

export interface DatosContrato {
  titulo: string;
  texto: string;
  versionContrato: number;
  versionTerminos: number;
  versionPrivacidad: number;
  representante: {
    nombre: string;
    cedula: string;
    correo: string;
    telefono: string;
    sector?: string | null;
  };
  alumno: {
    nombre: string;
    fechaNacimiento: string;
    cedula: string | null;
    colegio: string;
    grado: string | null;
    parentesco: string;
  };
  disciplinas: string[];
  cobro: CobroAlumno;
  fecha: Date;
  ip: string | null;
  /** Marca de agua de "EJEMPLO" para la vista previa del modulo interno. */
  ejemplo?: boolean;
}

const ZONA = 'America/Guayaquil';

export function fechaLarga(fecha: Date): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: ZONA }).format(fecha);
}

function fechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: ZONA,
  }).format(fecha);
}

/** 2015-03-09 → 9 de marzo de 2015, sin que la zona horaria mueva el dia. */
export function fechaDeNacimiento(iso: string): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** Sustituye {{marcador}}. Uno desconocido se deja tal cual, a la vista. */
export function rellenar(texto: string, valores: Record<Marcador, string>): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (original, clave: string) =>
    clave in valores ? valores[clave as Marcador] : original,
  );
}

export function valoresDelContrato(datos: DatosContrato): Record<Marcador, string> {
  return {
    representante_nombre: datos.representante.nombre,
    representante_cedula: datos.representante.cedula,
    representante_correo: datos.representante.correo,
    representante_telefono: datos.representante.telefono,
    representante_sector: datos.representante.sector || '—',
    parentesco: datos.alumno.parentesco,
    alumno_nombre: datos.alumno.nombre,
    alumno_fecha_nacimiento: fechaDeNacimiento(datos.alumno.fechaNacimiento),
    alumno_cedula: datos.alumno.cedula || '—',
    colegio: datos.alumno.colegio,
    grado: datos.alumno.grado || '—',
    disciplinas: datos.disciplinas.join('; '),
    precio_disciplina: dinero(datos.cobro.precio_disciplina),
    descuento: textoDescuento(datos.cobro),
    valor_alumno: dinero(datos.cobro.total),
    fecha: fechaLarga(datos.fecha),
  };
}

/**
 * Las fuentes estandar de PDF solo cubren Latin-1 (WinAnsi). Un emoji o unas
 * comillas raras pegadas desde Word saldrian como basura: se cambian por su
 * equivalente o se quitan.
 */
function aLatin1(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\n\t -ÿ–—•€]/g, '');
}

export async function generarContrato(
  datos: DatosContrato,
): Promise<{ pdf: Buffer; sha256: string }> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 56, bottom: 56, left: 60, right: 60 },
    info: { Title: aLatin1(datos.titulo), Author: 'Activa Reforce' },
  });

  const partes: Buffer[] = [];
  doc.on('data', (parte: Buffer) => partes.push(parte));
  const terminado = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  if (datos.ejemplo) {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#b91c1c')
      .text('EJEMPLO CON DATOS FICTICIOS — NO ES UN CONTRATO', { align: 'center' })
      .fillColor('#000000');
    doc.moveDown(0.8);
  }

  const cuerpo = rellenar(datos.texto, valoresDelContrato(datos));

  doc.font('Helvetica-Bold').fontSize(15).text(aLatin1(datos.titulo), { align: 'center' });
  doc.moveDown(1.2);

  // Parrafos separados por linea en blanco; "# " al principio es un subtitulo.
  for (const bloque of cuerpo.split(/\n\s*\n/)) {
    const limpio = aLatin1(bloque.trim());
    if (!limpio) continue;
    if (limpio.startsWith('# ')) {
      doc.font('Helvetica-Bold').fontSize(11.5).text(limpio.slice(2), { align: 'left' });
      doc.moveDown(0.4);
    } else {
      doc.font('Helvetica').fontSize(10.5).text(limpio, { align: 'justify', lineGap: 2 });
      doc.moveDown(0.7);
    }
  }

  const seccion = (titulo: string) => {
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(11.5).text(titulo);
    doc.moveDown(0.3);
  };
  const fila = (etiqueta: string, valor: string) => {
    doc.font('Helvetica-Bold').fontSize(10).text(`${etiqueta}: `, { continued: true });
    doc.font('Helvetica').text(aLatin1(valor));
  };

  seccion('Datos de la inscripción');
  fila('Representante', datos.representante.nombre);
  fila('Cédula o pasaporte', datos.representante.cedula);
  fila('Correo', datos.representante.correo);
  fila('Teléfono', datos.representante.telefono);
  fila('Parentesco', datos.alumno.parentesco);
  doc.moveDown(0.4);
  fila('Alumno', datos.alumno.nombre);
  fila('Fecha de nacimiento', fechaDeNacimiento(datos.alumno.fechaNacimiento));
  if (datos.alumno.cedula) fila('Cédula del alumno', datos.alumno.cedula);
  fila('Colegio', datos.alumno.colegio);
  if (datos.alumno.grado) fila('Grado', datos.alumno.grado);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10).text('Disciplinas:');
  doc.font('Helvetica').fontSize(10);
  for (const disciplina of datos.disciplinas) {
    doc.text(`• ${aLatin1(disciplina)}`, { indent: 12 });
  }

  seccion('Valores mensuales');
  const c = datos.cobro;
  fila(
    `${c.disciplinas} disciplina${c.disciplinas === 1 ? '' : 's'} a ${dinero(c.precio_disciplina)}`,
    dinero(c.subtotal),
  );
  if (c.descuento > 0) fila('Descuento', `${textoDescuento(c)}`);
  fila('Total mensual de este alumno', dinero(c.total));

  seccion('Aceptación electrónica');
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(
      aLatin1(
        `El representante aceptó este contrato (versión ${datos.versionContrato}), los ` +
          `Términos y condiciones (versión ${datos.versionTerminos}) y la Política de ` +
          `privacidad (versión ${datos.versionPrivacidad}) marcando las casillas ` +
          `correspondientes del formulario de inscripción el ${fechaHora(datos.fecha)} ` +
          `(hora de Ecuador)${datos.ip ? `, desde la dirección IP ${datos.ip}` : ''}.`,
      ),
      { align: 'justify', lineGap: 2 },
    );

  doc.end();
  const pdf = await terminado;
  return { pdf, sha256: createHash('sha256').update(pdf).digest('hex') };
}
