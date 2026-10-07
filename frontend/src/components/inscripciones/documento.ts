import type { ModalidadSalida, PermisosImagen, TipoDocumento } from '@/api/inscripciones';

/**
 * Las plantillas de los seis documentos, leídas igual que en el backend
 * (backend/src/modules/inscripciones/inscripciones.documentos.ts). Lo que el
 * representante lee en pantalla es lo que queda en su PDF: si cambia una
 * regla allí, cambia aquí.
 *
 *   párrafos separados por línea en blanco
 *   `# ` subtítulo · `## ` línea centrada en negrita
 *   [casilla clave] Texto · [salud] Pregunta · [datos seccion]
 *   [firma quien] (líneas debajo) · [politica] Texto · {{marcador}}
 */

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
            leyenda: resto
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean),
          };
        }
        return { t: 'desconocido', directiva: entera, texto: resto };
      }
      if (bloque.startsWith('## ')) return { t: 'centrado', texto: bloque.slice(3) };
      if (bloque.startsWith('# ')) return { t: 'subtitulo', texto: bloque.slice(2) };
      return { t: 'parrafo', texto: bloque };
    });
}

/** El texto de una casilla de un documento, para usarlo como etiqueta en el formulario. */
export function textoDeCasilla(contenido: string | undefined, clave: string): string | null {
  if (!contenido) return null;
  const b = analizar(contenido).find((x) => x.t === 'casilla' && x.clave === clave);
  return b && b.t === 'casilla' ? b.texto : null;
}

export function textoDeSalud(contenido: string | undefined): string | null {
  if (!contenido) return null;
  const b = analizar(contenido).find((x) => x.t === 'salud');
  return b && b.t === 'salud' ? b.texto : null;
}

/** Qué piezas lleva cada documento. Igual que REGLAS en el backend. */
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

/** Lo que impide publicar, igual que problemasDePlantilla del backend. */
export function problemasDePlantilla(
  tipo: TipoDocumento,
  texto: string,
  marcadores: Record<string, string>,
): string[] {
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
    if (!(m[1]! in marcadores)) desconocidos.add(m[1]!);
  }
  for (const d of desconocidos) problemas.push(`El dato {{${d}}} no existe.`);
  return problemas;
}

// ---------------------------------------------------------------------------
// Con qué se llena: todo ya en texto, para pintarlo tal cual

export interface DatosDocumento {
  /** Marcador → valor. Lo que falte se ve como [marcador]. */
  valores: Record<string, string>;
  representante: {
    nombre: string;
    cedula: string;
    telefono: string;
    factura: { nombre: string; identificacion: string; correo: string; direccion: string };
    aplicaDescuento: string;
  };
  alumno: {
    nombre: string;
    fecha_nacimiento: string;
    curso: string;
    actividades: string;
    horarios: string;
    emergencia: { nombre: string; relacion: string; telefono: string };
    retiro: { nombre: string; cedula: string; relacion: string; telefono: string };
    modalidad_salida: ModalidadSalida | null;
    detalle_retiro: string;
    salud: { tiene: boolean | null; detalle: string; autoriza: boolean };
    imagen: PermisosImagen;
  };
  /** Fecha y hora de la aceptación, o lo que se muestre antes de enviar. */
  fechaFirma: string;
  aprobacion: string | null;
}

export type Celda = string | { opciones: Array<[string, boolean]> };

/** Las filas de la ficha, con las etiquetas de su Word tal cual. Igual que en el backend. */
export function filasDe(seccion: Seccion, d: DatosDocumento): Array<[string, Celda]> {
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
        ['¿Aplica descuento por hermano? (Sí / No)', r.aplicaDescuento],
      ];
    case 'alumno':
      return [
        ['Nombres y apellidos del estudiante', a.nombre],
        ['Fecha de nacimiento', a.fecha_nacimiento],
        ['Curso', a.curso],
        ['Disciplina contratada', a.actividades],
        ['Días / horario', a.horarios],
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
        ['Detalle del recorrido, ruta o instrucciones de retiro', a.detalle_retiro],
      ];
  }
}

export function valorCasilla(tipo: TipoDocumento, clave: string, d: DatosDocumento): boolean {
  if (tipo === 'autorizacion_datos' && clave === 'acepta') return true;
  if (tipo === 'datos_medicos' && clave === 'autoriza') return d.alumno.salud.autoriza;
  if (tipo === 'imagen' && clave in d.alumno.imagen) {
    return d.alumno.imagen[clave as keyof PermisosImagen];
  }
  return false;
}

/** Trozos de un texto: lo escrito y los marcadores, para resaltar los datos. */
export function trozos(
  texto: string,
  valores: Record<string, string>,
): Array<{ texto: string; dato: 'si' | 'no' | null }> {
  return texto.split(/(\{\{\s*[a-z_]+\s*\}\})/g).map((t) => {
    const clave = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(t)?.[1];
    if (!clave) return { texto: t, dato: null };
    const valor = valores[clave];
    return valor !== undefined ? { texto: valor, dato: 'si' } : { texto: t, dato: 'no' };
  });
}

const ZONA = 'America/Guayaquil';
export const fechaLarga = (d: Date) =>
  new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: ZONA }).format(d);
export const fechaYHora = (d: Date) =>
  new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone: ZONA }).format(d);

const NUMERO = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const porcentaje = (n: number) => `${String(n).replace('.', ',')} %`;
export const tarifa = (n: number) => `USD ${NUMERO.format(n)}`;
