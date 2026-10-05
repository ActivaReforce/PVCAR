import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';

/**
 * Los seis documentos de la inscripción y su PDF (migración 0016).
 *
 * Los textos los escribe Activa Reforce en el módulo interno, copiados de
 * sus Word (Contratos/). **Una plantilla por documento para todos los
 * colegios**: lo que cambia de un colegio a otro (sede, tarifa, mínimo) son
 * datos, y entran con marcadores `{{sede}}`.
 *
 * El texto es plano, con unas pocas reglas:
 *   - párrafos separados por una línea en blanco;
 *   - `# ` al principio: subtítulo; `## `: línea centrada en negrita;
 *   - un párrafo que empieza con una **directiva** entre corchetes es una
 *     pieza que arma el sistema con lo que llenó el representante:
 *       [casilla clave] Texto      casilla (☐/☒) con ese texto
 *       [salud] Pregunta           la pregunta con ○ No / ○ Sí. Especifique
 *       [datos seccion]            la tabla de la ficha (representante,
 *                                  alumno, emergencia, retiro)
 *       [firma quien]              bloque de firma (representante, activa);
 *                                  las líneas siguientes van debajo
 *       [politica] Texto           enlace a la política
 *
 * El mismo análisis lo hace el formulario (frontend/src/components/
 * inscripciones/documento.ts): lo que el representante lee en pantalla es
 * lo que queda en su PDF.
 *
 * No hay firma dibujada (decisión del cliente, 2026-10-05): firmar es marcar
 * las casillas de aceptar. En cada bloque de firma sale "Aceptado
 * electrónicamente" con su nombre, cédula y fecha.
 */

/** En el orden en que van en el paquete de cada alumno. */
export const TIPOS_DOCUMENTO = [
  'ficha_matricula',
  'contrato',
  'autorizacion_datos',
  'datos_medicos',
  'imagen',
  'politica',
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  ficha_matricula: 'Ficha de matrícula',
  contrato: 'Contrato',
  autorizacion_datos: 'Autorización de datos personales',
  datos_medicos: 'Información de salud',
  imagen: 'Uso de imagen',
  politica: 'Política de datos personales',
};

export const MARCADORES = {
  fecha: 'Fecha de la inscripción',
  representante_nombre: 'Nombre del representante',
  representante_cedula: 'Cédula del representante',
  alumno_nombre: 'Nombre del alumno',
  sede: 'Sede, nombre completo (Colegio CRISFE Carcelén)',
  sede_corta: 'Sede, nombre corto (Carcelén)',
  institucion: 'Institución en las cláusulas (CRISFE)',
  minimo_alumnos: 'Mínimo de alumnos por grupo',
  tarifa: 'Tarifa mensual (USD 32,10)',
  descuento_hermano: 'Descuento por hermano (20 %)',
  iva: 'IVA (15 %)',
} as const;
export type Marcador = keyof typeof MARCADORES;

export const SECCIONES = ['representante', 'alumno', 'emergencia', 'retiro'] as const;
export type Seccion = (typeof SECCIONES)[number];
export const FIRMANTES = ['representante', 'activa'] as const;
export type Firmante = (typeof FIRMANTES)[number];

export type Bloque =
  | { t: 'parrafo'; texto: string }
  | { t: 'subtitulo'; texto: string }
  | { t: 'centrado'; texto: string }
  | { t: 'casilla'; clave: string; texto: string }
  | { t: 'salud'; texto: string }
  | { t: 'datos'; seccion: Seccion }
  | { t: 'firma'; quien: Firmante; leyenda: string[] }
  | { t: 'politica'; texto: string }
  | { t: 'desconocido'; directiva: string; texto: string };

const DIRECTIVA = /^\[([a-z]+)(?:\s+([a-z_]+))?\]/;

export function analizar(texto: string): Bloque[] {
  return texto
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((bloque): Bloque => {
      const m = DIRECTIVA.exec(bloque);
      if (m) {
        const [entera, nombre, clave] = m;
        const resto = bloque.slice(entera.length).trim();
        if (nombre === 'casilla' && clave) return { t: 'casilla', clave, texto: resto };
        if (nombre === 'salud' && !clave) return { t: 'salud', texto: resto };
        if (nombre === 'politica' && !clave) return { t: 'politica', texto: resto };
        if (nombre === 'datos' && (SECCIONES as readonly string[]).includes(clave ?? '')) {
          return { t: 'datos', seccion: clave as Seccion };
        }
        if (nombre === 'firma' && (FIRMANTES as readonly string[]).includes(clave ?? '')) {
          return {
            t: 'firma',
            quien: clave as Firmante,
            leyenda: resto.split('\n').map((l) => l.trim()).filter(Boolean),
          };
        }
        return { t: 'desconocido', directiva: entera, texto: resto };
      }
      if (bloque.startsWith('## ')) return { t: 'centrado', texto: bloque.slice(3) };
      if (bloque.startsWith('# ')) return { t: 'subtitulo', texto: bloque.slice(2) };
      return { t: 'parrafo', texto: bloque };
    });
}

/** Qué piezas lleva cada documento. Lo que no está aquí no puede ir en él. */
export const REGLAS: Record<
  TipoDocumento,
  { casillas: string[]; salud: boolean; datos: Seccion[]; firmas: Firmante[]; politica: boolean }
> = {
  ficha_matricula: {
    casillas: [],
    salud: false,
    datos: ['representante', 'alumno', 'emergencia', 'retiro'],
    firmas: ['representante'],
    politica: false,
  },
  contrato: { casillas: [], salud: false, datos: [], firmas: ['activa', 'representante'], politica: false },
  autorizacion_datos: { casillas: ['acepta'], salud: false, datos: [], firmas: [], politica: true },
  datos_medicos: { casillas: ['autoriza'], salud: true, datos: [], firmas: [], politica: false },
  imagen: {
    casillas: ['familias', 'redes', 'promocional'],
    salud: false,
    datos: [],
    firmas: [],
    politica: false,
  },
  politica: { casillas: [], salud: false, datos: [], firmas: [], politica: false },
};

/**
 * Lo que impide publicar una plantilla, en frases para el admin. Vacío si
 * está bien. Sin esto, un documento sin su casilla dejaría al formulario sin
 * dónde guardar la respuesta.
 */
export function problemasDePlantilla(tipo: TipoDocumento, texto: string): string[] {
  const regla = REGLAS[tipo];
  const bloques = analizar(texto);
  const problemas: string[] = [];
  const contar = (f: (b: Bloque) => boolean) => bloques.filter(f).length;

  for (const b of bloques) {
    if (b.t === 'desconocido') problemas.push(`${b.directiva} no es una pieza conocida.`);
    if (b.t === 'casilla' && !regla.casillas.includes(b.clave)) {
      problemas.push(`[casilla ${b.clave}] no va en este documento.`);
    }
  }
  for (const clave of regla.casillas) {
    const n = contar((b) => b.t === 'casilla' && b.clave === clave);
    if (n !== 1) problemas.push(`Tiene que llevar una vez [casilla ${clave}] (lleva ${n}).`);
  }
  const salud = contar((b) => b.t === 'salud');
  if (regla.salud && salud !== 1) problemas.push(`Tiene que llevar una vez [salud] (lleva ${salud}).`);
  if (!regla.salud && salud > 0) problemas.push('[salud] no va en este documento.');

  for (const s of SECCIONES) {
    const n = contar((b) => b.t === 'datos' && b.seccion === s);
    if (regla.datos.includes(s) && n !== 1) {
      problemas.push(`Tiene que llevar una vez [datos ${s}] (lleva ${n}).`);
    }
    if (!regla.datos.includes(s) && n > 0) problemas.push(`[datos ${s}] no va en este documento.`);
  }
  for (const f of FIRMANTES) {
    const n = contar((b) => b.t === 'firma' && b.quien === f);
    if (regla.firmas.includes(f) && n !== 1) {
      problemas.push(`Tiene que llevar una vez [firma ${f}] (lleva ${n}).`);
    }
    if (!regla.firmas.includes(f) && n > 0) problemas.push(`[firma ${f}] no va en este documento.`);
  }
  if (!regla.politica && contar((b) => b.t === 'politica') > 0) {
    problemas.push('[politica] no va en este documento.');
  }

  const desconocidos = new Set<string>();
  for (const m of texto.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
    if (!(m[1]! in MARCADORES)) desconocidos.add(m[1]!);
  }
  for (const d of desconocidos) problemas.push(`El dato {{${d}}} no existe.`);
  return problemas;
}

// ---------------------------------------------------------------------------
// Los datos con que se llena

export interface DatosPaquete {
  fecha: Date;
  insId: number | null;
  ip: string | null;
  navegador: string | null;
  representante: {
    nombre: string;
    cedula: string;
    correo: string;
    telefono: string;
    factura: { nombre: string; identificacion: string; correo: string; direccion: string };
  };
  alumno: {
    nombre: string;
    fecha_nacimiento: string;
    curso: string | null;
    actividades: string[];
    horarios: string[];
    modalidad_salida: 'escolar' | 'privado';
    detalle_retiro: string | null;
    emergencia: { nombre: string; relacion: string; telefono: string };
    retiro: { nombre: string; cedula: string; relacion: string; telefono: string };
    salud: { tiene: boolean; detalle: string | null; autoriza: boolean };
    imagen: { familias: boolean; redes: boolean; promocional: boolean };
  };
  colegio: {
    sede: string;
    sede_corta: string;
    institucion: string;
    minimo_alumnos: number;
    tarifa: number;
    descuento_hermano: number;
  };
  ivaPct: number;
  aplicaDescuento: boolean;
  /** Al aprobar: bajo la firma de Activa sale "Aprobado por". */
  aprobacion?: { nombre: string; fecha: Date } | null;
  /** Marca de "EJEMPLO" para la vista previa del módulo interno. */
  ejemplo?: boolean;
}

const ZONA = 'America/Guayaquil';

export function fechaLarga(fecha: Date): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: ZONA }).format(fecha);
}

export function fechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: ZONA,
  }).format(fecha);
}

/** 2015-03-09 → 9 de marzo de 2015, sin que la zona horaria mueva el día. */
export function fechaDeNacimiento(iso: string): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

const NUMERO = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcentaje = (n: number) => `${String(n).replace('.', ',')} %`;

export function valoresDe(d: DatosPaquete): Record<Marcador, string> {
  return {
    fecha: fechaLarga(d.fecha),
    representante_nombre: d.representante.nombre,
    representante_cedula: d.representante.cedula,
    alumno_nombre: d.alumno.nombre,
    sede: d.colegio.sede,
    sede_corta: d.colegio.sede_corta,
    institucion: d.colegio.institucion,
    minimo_alumnos: String(d.colegio.minimo_alumnos),
    tarifa: `USD ${NUMERO.format(d.colegio.tarifa)}`,
    descuento_hermano: porcentaje(d.colegio.descuento_hermano),
    iva: porcentaje(d.ivaPct),
  };
}

/** Sustituye {{marcador}}. Uno desconocido se deja tal cual, a la vista. */
export function rellenar(texto: string, valores: Record<Marcador, string>): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (original, clave: string) =>
    clave in valores ? valores[clave as Marcador] : original,
  );
}

export function valorCasilla(tipo: TipoDocumento, clave: string, d: DatosPaquete): boolean {
  if (tipo === 'autorizacion_datos' && clave === 'acepta') return true;
  if (tipo === 'datos_medicos' && clave === 'autoriza') return d.alumno.salud.autoriza;
  if (tipo === 'imagen' && clave in d.alumno.imagen) {
    return d.alumno.imagen[clave as keyof DatosPaquete['alumno']['imagen']];
  }
  return false;
}

type Celda = string | { opciones: Array<[string, boolean]> };

/** Las filas de la ficha, con las etiquetas de su Word tal cual. */
export function filasDe(seccion: Seccion, d: DatosPaquete): Array<[string, Celda]> {
  const r = d.representante;
  const a = d.alumno;
  switch (seccion) {
    case 'representante':
      return [
        ['Nombres y apellidos del representante legal', r.nombre],
        ['Nombres y apellidos para factura', r.factura.nombre],
        ['Cédula o RUC', r.factura.identificacion],
        ['Teléfono', r.telefono],
        ['Correo electrónico para factura', r.factura.correo],
        ['Dirección para factura', r.factura.direccion],
        ['¿Aplica descuento por hermano? (Sí / No)', d.aplicaDescuento ? 'Sí' : 'No'],
      ];
    case 'alumno':
      return [
        ['Nombres y apellidos del estudiante', a.nombre],
        ['Fecha de nacimiento', fechaDeNacimiento(a.fecha_nacimiento)],
        ['Curso', a.curso ?? ''],
        ['Disciplina contratada', a.actividades.join(', ')],
        ['Días / horario', a.horarios.join('; ')],
      ];
    case 'emergencia':
      return [
        ['Nombres y apellidos', a.emergencia.nombre],
        ['Relación con el menor', a.emergencia.relacion],
        ['Teléfono', a.emergencia.telefono],
      ];
    case 'retiro':
      return [
        ['Persona autorizada para retirar al menor', a.retiro.nombre],
        ['Cédula / identificación', a.retiro.cedula],
        ['Relación con el menor', a.retiro.relacion],
        ['Teléfono', a.retiro.telefono],
        [
          'Modalidad de salida / recorrido',
          {
            opciones: [
              ['Transporte escolar', a.modalidad_salida === 'escolar'],
              ['Transporte privado', a.modalidad_salida === 'privado'],
            ],
          },
        ],
        ['Detalle del recorrido, ruta o instrucciones de retiro', a.detalle_retiro ?? ''],
      ];
  }
}

const marca = (v: boolean) => (v ? '[X]' : '[ ]');

function lineasFirma(quien: Firmante, d: DatosPaquete): string[] {
  if (quien === 'activa') {
    return d.aprobacion
      ? [`Aprobado por ${d.aprobacion.nombre} el ${fechaHora(d.aprobacion.fecha)}`]
      : [];
  }
  return [
    'Aceptado electrónicamente',
    `Nombre: ${d.representante.nombre}`,
    `C.C.: ${d.representante.cedula}`,
    `Fecha: ${fechaHora(d.fecha)}`,
  ];
}

/**
 * El documento rellenado, en texto. Su sha256 es la huella de lo que el
 * representante vio: lleva cada dato, cada casilla y cada respuesta. La
 * aprobación no entra (llega después y no la vio).
 */
export function textoRellenado(
  tipo: TipoDocumento,
  titulo: string,
  plantilla: string,
  d: DatosPaquete,
): string {
  const valores = valoresDe(d);
  const sinAprobar = { ...d, aprobacion: null };
  const salida: string[] = [rellenar(titulo, valores)];
  for (const b of analizar(plantilla)) {
    switch (b.t) {
      case 'parrafo':
      case 'subtitulo':
      case 'centrado':
        salida.push(rellenar(b.texto, valores));
        break;
      case 'casilla':
        salida.push(`${marca(valorCasilla(tipo, b.clave, d))} ${rellenar(b.texto, valores)}`);
        break;
      case 'salud': {
        const s = d.alumno.salud;
        salida.push(rellenar(b.texto, valores));
        salida.push(`${marca(!s.tiene)} No ${marca(s.tiene)} Sí. Especifique: ${s.detalle ?? ''}`);
        break;
      }
      case 'datos':
        for (const [etiqueta, celda] of filasDe(b.seccion, d)) {
          const valor =
            typeof celda === 'string'
              ? celda
              : celda.opciones.map(([o, v]) => `${marca(v)} ${o}`).join(' ');
          salida.push(`${etiqueta}: ${valor}`);
        }
        break;
      case 'firma':
        salida.push(...lineasFirma(b.quien, sinAprobar), ...b.leyenda.map((l) => rellenar(l, valores)));
        break;
      case 'politica':
        salida.push(`[${rellenar(b.texto, valores)}]`);
        break;
      case 'desconocido':
        salida.push(`${b.directiva} ${b.texto}`);
        break;
    }
  }
  return salida.join('\n');
}

export function sha256(texto: string | Buffer): string {
  return createHash('sha256').update(texto).digest('hex');
}

// ---------------------------------------------------------------------------
// El PDF: un paquete por alumno con sus seis documentos y la constancia

export interface DocumentoDelPaquete {
  tipo: TipoDocumento;
  titulo: string;
  contenido: string;
  version: number;
}

export interface Constancia {
  tipo: TipoDocumento;
  version: number;
  sha256: string;
  respuesta: string;
}

/** Lo que marcó en cada documento, en una frase para la hoja de constancias. */
export function respuestaDe(tipo: TipoDocumento, d: DatosPaquete): string {
  const sino = (v: boolean) => (v ? 'Sí' : 'No');
  switch (tipo) {
    case 'autorizacion_datos':
      return 'Autoriza el tratamiento de datos';
    case 'datos_medicos':
      return `Condición de salud: ${sino(d.alumno.salud.tiene)} · Autoriza su tratamiento: ${sino(d.alumno.salud.autoriza)}`;
    case 'imagen': {
      const i = d.alumno.imagen;
      return `Familias: ${sino(i.familias)} · Redes: ${sino(i.redes)} · Promocional: ${sino(i.promocional)}`;
    }
    case 'politica':
      return 'Leída y aceptada';
    default:
      return 'Leído y aceptado';
  }
}

/** Las fuentes estándar de PDF solo cubren Latin-1: lo demás se cambia o se quita. */
function aLatin1(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[☐☑☒○●]/g, '')
    .replace(/[^\n\t -ÿ–—•€]/g, '');
}

// Medidas del Word del cliente: carta, Arial 9,5 (Helvetica en PDF), tablas
// de la ficha en 8,5 con la etiqueta sombreada E7E6E6, membrete de 589 pt.
const PAGINA = { ancho: 612, alto: 792 };
const MARGEN = { arriba: 96, abajo: 60, izquierda: 71, derecha: 71 };
const ANCHO = PAGINA.ancho - MARGEN.izquierda - MARGEN.derecha;
const CUERPO = 9.5;
const TABLA = 8.5;
const SOMBRA = '#E7E6E6';
const MEMBRETE_ANCHO = 589.6;

export async function generarPaquete(entrada: {
  documentos: DocumentoDelPaquete[];
  datos: DatosPaquete;
  constancias: Constancia[];
  membrete: Buffer | null;
}): Promise<{ pdf: Buffer; sha256: string }> {
  const d = entrada.datos;
  const valores = valoresDe(d);
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGEN.arriba, bottom: MARGEN.abajo, left: MARGEN.izquierda, right: MARGEN.derecha },
    info: { Title: aLatin1(`Inscripción de ${d.alumno.nombre}`), Author: 'Activa Reforce' },
    autoFirstPage: false,
  });

  const partes: Buffer[] = [];
  doc.on('data', (parte: Buffer) => partes.push(parte));
  const terminado = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  // Con un Buffer, pdfkit incrusta la imagen otra vez en cada página (solo
  // cachea rutas de archivo). Abierta una vez y reusada, va una sola vez:
  // el paquete pesa ~100 KB en vez de ~1 MB. openImage existe pero no está
  // en los tipos de @types/pdfkit.
  let membrete: Buffer | null = null;
  if (entrada.membrete) {
    try {
      membrete = (doc as unknown as { openImage(b: Buffer): Buffer }).openImage(entrada.membrete);
    } catch (err) {
      // Un membrete ilegible no debe tumbar una inscripción.
      console.error('Membrete ilegible:', err);
    }
  }

  doc.on('pageAdded', () => {
    if (membrete) {
      try {
        doc.image(membrete, 0, 0, { width: MEMBRETE_ANCHO });
      } catch (err) {
        console.error('No se pudo dibujar el membrete:', err);
      }
    }
    if (d.ejemplo) {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#b91c1c')
        .text('EJEMPLO CON DATOS FICTICIOS — NO ES UNA INSCRIPCIÓN', MARGEN.izquierda, MARGEN.arriba - 22, {
          width: ANCHO,
          align: 'center',
        })
        .fillColor('#000000');
    }
    doc.x = MARGEN.izquierda;
    doc.y = MARGEN.arriba;
  });

  const limite = () => PAGINA.alto - MARGEN.abajo;
  const asegurar = (alto: number) => {
    if (doc.y + alto > limite()) doc.addPage();
  };

  const casillaEn = (x: number, y: number, marcada: boolean, redonda = false) => {
    const lado = 7.5;
    doc.save().lineWidth(0.7);
    if (redonda) {
      doc.circle(x + lado / 2, y + lado / 2, lado / 2).stroke();
      if (marcada) doc.circle(x + lado / 2, y + lado / 2, lado / 4).fill('#000000');
    } else {
      doc.rect(x, y, lado, lado).stroke();
      if (marcada) {
        doc
          .moveTo(x + 1.5, y + 1.5)
          .lineTo(x + lado - 1.5, y + lado - 1.5)
          .moveTo(x + lado - 1.5, y + 1.5)
          .lineTo(x + 1.5, y + lado - 1.5)
          .stroke();
      }
    }
    doc.restore();
  };

  const parrafo = (texto: string, opciones: { negrita?: boolean; alinear?: 'justify' | 'center' | 'left' } = {}) => {
    const limpio = aLatin1(texto);
    doc.font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(CUERPO);
    asegurar(doc.heightOfString(limpio, { width: ANCHO, lineGap: 1.5 }));
    doc.text(limpio, MARGEN.izquierda, doc.y, {
      width: ANCHO,
      align: opciones.alinear ?? 'justify',
      lineGap: 1.5,
    });
    doc.moveDown(0.6);
  };

  const filaCasilla = (texto: string, marcada: boolean) => {
    const limpio = aLatin1(texto);
    doc.font('Helvetica-Bold').fontSize(CUERPO);
    const ancho = ANCHO - 14;
    const alto = doc.heightOfString(limpio, { width: ancho, lineGap: 1.5 });
    asegurar(alto);
    const y = doc.y;
    casillaEn(MARGEN.izquierda, y + 1, marcada);
    doc.text(limpio, MARGEN.izquierda + 14, y, { width: ancho, align: 'justify', lineGap: 1.5 });
    doc.moveDown(0.6);
  };

  const tabla = (filas: Array<[string, Celda]>) => {
    const anchoEtiqueta = Math.round(ANCHO * 0.45);
    const anchoValor = ANCHO - anchoEtiqueta;
    const relleno = 2.5;
    doc.fontSize(TABLA);
    for (const [etiqueta, celda] of filas) {
      const textoEtiqueta = aLatin1(etiqueta);
      const textoValor = typeof celda === 'string' ? aLatin1(celda) : '';
      doc.font('Helvetica-Bold');
      const hEtiqueta = doc.heightOfString(textoEtiqueta, { width: anchoEtiqueta - relleno * 2 });
      doc.font('Helvetica');
      const hValor = textoValor ? doc.heightOfString(textoValor, { width: anchoValor - relleno * 2 }) : 0;
      const alto = Math.max(hEtiqueta, hValor, TABLA + 2) + relleno * 2;
      asegurar(alto);
      const y = doc.y;
      const x = MARGEN.izquierda;
      doc.save().rect(x, y, anchoEtiqueta, alto).fill(SOMBRA).restore();
      doc.save().lineWidth(0.5).rect(x, y, anchoEtiqueta, alto).rect(x + anchoEtiqueta, y, anchoValor, alto).stroke().restore();
      doc.font('Helvetica-Bold').fillColor('#000000').text(textoEtiqueta, x + relleno, y + relleno, {
        width: anchoEtiqueta - relleno * 2,
      });
      if (typeof celda === 'string') {
        doc.font('Helvetica').text(textoValor, x + anchoEtiqueta + relleno, y + relleno, {
          width: anchoValor - relleno * 2,
        });
      } else {
        let cx = x + anchoEtiqueta + relleno;
        doc.font('Helvetica');
        for (const [opcion, marcada] of celda.opciones) {
          casillaEn(cx, y + relleno, marcada);
          doc.text(aLatin1(opcion), cx + 11, y + relleno, { lineBreak: false });
          cx += 11 + doc.widthOfString(aLatin1(opcion)) + 22;
        }
      }
      doc.x = MARGEN.izquierda;
      doc.y = y + alto;
    }
    doc.moveDown(0.6);
  };

  /**
   * La firma sola del representante, sin leyenda, va en dos líneas como en
   * la ficha del Word: "Firma … C.C. …" y "Nombre … Fecha …".
   */
  const firmaCompacta = () => {
    const mitad = ANCHO * 0.52;
    doc.moveDown(0.6);
    asegurar(30);
    const fila = (izquierda: [string, string], derecha: [string, string]) => {
      const y = doc.y;
      doc.font('Helvetica').fontSize(CUERPO).text(`${izquierda[0]} `, MARGEN.izquierda, y, { continued: true });
      doc.font('Helvetica-Oblique').text(aLatin1(izquierda[1]), { width: mitad });
      const alto = doc.y - y;
      doc.font('Helvetica').text(`${derecha[0]} `, MARGEN.izquierda + mitad, y, { continued: true });
      doc.font('Helvetica-Oblique').text(aLatin1(derecha[1]), { width: ANCHO - mitad });
      doc.y = y + Math.max(alto, doc.y - y) + 3;
    };
    fila(['Firma del REPRESENTANTE:', 'Aceptado electrónicamente'], ['C.C.:', d.representante.cedula]);
    fila(['Nombre:', d.representante.nombre], ['Fecha:', fechaHora(d.fecha)]);
    doc.x = MARGEN.izquierda;
  };

  /** Bloques de firma seguidos van uno al lado del otro, como en el Word. */
  const firmas = (grupo: Array<{ quien: Firmante; leyenda: string[] }>) => {
    if (grupo.length === 1 && grupo[0]!.quien === 'representante' && grupo[0]!.leyenda.length === 0) {
      firmaCompacta();
      return;
    }
    const columnas = grupo.length;
    const separacion = 30;
    const anchoColumna = (ANCHO - separacion * (columnas - 1)) / columnas;
    const lineas = grupo.map((f) => {
      const propias = lineasFirma(f.quien, d);
      const leyenda = f.leyenda.map((l) => rellenar(l, valores));
      // Activa: la raya y debajo su leyenda; el "Aprobado por" encima de la raya.
      // Representante: "Aceptado electrónicamente" encima, y debajo su leyenda y sus datos.
      return f.quien === 'activa'
        ? { encima: propias, debajo: leyenda }
        : { encima: propias.slice(0, 1), debajo: [...leyenda, ...propias.slice(1)] };
    });
    doc.fontSize(CUERPO);
    const alturaDe = (textos: string[]) =>
      textos.reduce((s, t) => s + doc.heightOfString(aLatin1(t), { width: anchoColumna }) + 1, 0);
    const alto = Math.max(...lineas.map((l) => alturaDe(l.encima) + 12 + alturaDe(l.debajo))) + 10;
    doc.moveDown(1);
    asegurar(alto);
    const y0 = doc.y;
    lineas.forEach((l, i) => {
      const x = MARGEN.izquierda + i * (anchoColumna + separacion);
      let y = y0 + Math.max(...lineas.map((o) => alturaDe(o.encima))) - alturaDe(l.encima);
      doc.font('Helvetica-Oblique');
      for (const t of l.encima) {
        doc.text(aLatin1(t), x, y, { width: anchoColumna, align: 'center' });
        y = doc.y + 1;
      }
      const yRaya = y0 + Math.max(...lineas.map((o) => alturaDe(o.encima))) + 4;
      doc.save().lineWidth(0.6).moveTo(x + 10, yRaya).lineTo(x + anchoColumna - 10, yRaya).stroke().restore();
      y = yRaya + 4;
      l.debajo.forEach((t, j) => {
        doc.font(grupo[i]!.quien === 'activa' || j < grupo[i]!.leyenda.length ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(aLatin1(t), x, y, { width: anchoColumna, align: 'center' });
        y = doc.y + 1;
      });
    });
    doc.x = MARGEN.izquierda;
    doc.y = y0 + alto;
  };

  for (const documento of entrada.documentos) {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(12).text(aLatin1(rellenar(documento.titulo, valores)), {
      width: ANCHO,
      align: 'center',
    });
    doc.moveDown(0.8);

    const bloques = analizar(documento.contenido);
    for (let i = 0; i < bloques.length; i++) {
      const b = bloques[i]!;
      switch (b.t) {
        case 'parrafo':
          parrafo(rellenar(b.texto, valores));
          break;
        case 'subtitulo':
          parrafo(rellenar(b.texto, valores), { negrita: true, alinear: 'left' });
          break;
        case 'centrado':
          parrafo(rellenar(b.texto, valores), { negrita: true, alinear: 'center' });
          break;
        case 'casilla':
          filaCasilla(rellenar(b.texto, valores), valorCasilla(documento.tipo, b.clave, d));
          break;
        case 'salud': {
          if (b.texto) parrafo(rellenar(b.texto, valores));
          const s = d.alumno.salud;
          const detalle = aLatin1(s.detalle ?? '');
          doc.font('Helvetica').fontSize(CUERPO);
          const anchoDetalle = ANCHO - 110;
          asegurar(Math.max(12, doc.heightOfString(detalle || ' ', { width: anchoDetalle })) + 6);
          const y = doc.y;
          casillaEn(MARGEN.izquierda, y + 1, !s.tiene, true);
          doc.text('No', MARGEN.izquierda + 12, y, { lineBreak: false });
          casillaEn(MARGEN.izquierda + 40, y + 1, s.tiene, true);
          doc.text('Sí. Especifique:', MARGEN.izquierda + 52, y, { lineBreak: false });
          doc.text(detalle || ' ', MARGEN.izquierda + 125, y, { width: ANCHO - 125, underline: false });
          doc.x = MARGEN.izquierda;
          doc.moveDown(0.6);
          break;
        }
        case 'datos':
          tabla(filasDe(b.seccion, d));
          break;
        case 'firma': {
          const grupo = [{ quien: b.quien, leyenda: b.leyenda }];
          while (bloques[i + 1]?.t === 'firma') {
            const sig = bloques[++i] as Extract<Bloque, { t: 'firma' }>;
            grupo.push({ quien: sig.quien, leyenda: sig.leyenda });
          }
          firmas(grupo);
          break;
        }
        case 'politica':
          parrafo(`[${rellenar(b.texto, valores)}]`, { alinear: 'left' });
          break;
        case 'desconocido':
          parrafo(`${b.directiva} ${b.texto}`);
          break;
      }
    }
  }

  // Hoja de constancias
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(12).text('CONSTANCIA DE ACEPTACIÓN ELECTRÓNICA', { width: ANCHO, align: 'center' });
  doc.moveDown(0.8);
  tabla(
    [
      ['Inscripción', d.insId ? `N.° ${d.insId}` : '—'],
      ['Representante', d.representante.nombre],
      ['C.C.', d.representante.cedula],
      ['Correo', d.representante.correo],
      ['Alumno', d.alumno.nombre],
      ['Sede', d.colegio.sede],
      ['Fecha y hora (Ecuador)', fechaHora(d.fecha)],
      ['Dirección IP', d.ip ?? '—'],
      ['Navegador', (d.navegador ?? '—').slice(0, 160)],
    ] as Array<[string, Celda]>,
  );
  parrafo(
    'El representante aceptó los siguientes documentos marcando las casillas del formulario de inscripción. ' +
      'No hay firma manuscrita: la aceptación electrónica es la firma. La huella es el SHA-256 del texto exacto ' +
      'que el representante vio, ya rellenado con sus datos; sirve para comprobar que el documento no cambió.',
  );
  tabla(
    entrada.constancias.map((c): [string, Celda] => [
      `${NOMBRE_DOCUMENTO[c.tipo]} (versión ${c.version})`,
      `${c.respuesta}\nHuella: ${c.sha256}`,
    ]),
  );
  if (d.aprobacion) {
    parrafo(`Inscripción aprobada por ${d.aprobacion.nombre} el ${fechaHora(d.aprobacion.fecha)}`, {
      negrita: true,
      alinear: 'left',
    });
  }

  doc.end();
  const pdf = await terminado;
  return { pdf, sha256: sha256(pdf) };
}
