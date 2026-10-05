import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  TIPOS_DOCUMENTO,
  analizar,
  generarPaquete,
  problemasDePlantilla,
  sha256,
  textoRellenado,
  type DatosPaquete,
} from './inscripciones.documentos.js';
import { PLANTILLAS_INICIALES } from './inscripciones.plantillas.js';

/**
 * Los seis documentos: que las plantillas sacadas de los Word del cliente
 * sean publicables, que el texto rellenado lleve lo que el representante
 * marcó (es lo que firma su huella) y que el PDF se genere.
 */

const datos: DatosPaquete = {
  fecha: new Date('2026-10-05T15:42:00Z'),
  insId: null,
  ip: '190.0.0.1',
  navegador: 'Prueba',
  representante: {
    nombre: 'María José Pérez Andrade',
    cedula: '1712345678',
    correo: 'maria@ejemplo.com',
    telefono: '0991234567',
    factura: {
      nombre: 'María José Pérez Andrade',
      identificacion: '1712345678001',
      correo: 'facturas@ejemplo.com',
      direccion: 'Av. de los Shyris N35-17, Quito',
    },
  },
  alumno: {
    nombre: 'Martín Pérez Andrade',
    fecha_nacimiento: '2016-05-14',
    curso: '4to de Básica',
    actividades: ['Fútbol'],
    horarios: ['Fútbol: Martes 16:00 a 17:00', 'Fútbol: Jueves 16:00 a 17:00'],
    modalidad_salida: 'privado',
    detalle_retiro: 'Lo retira su tía.',
    emergencia: { nombre: 'Jorge Andrade', relacion: 'Abuelo', telefono: '0987654321' },
    retiro: { nombre: 'Lucía Pérez', cedula: '1723456789', relacion: 'Tía', telefono: '0998877665' },
    salud: { tiene: true, detalle: 'Alergia al maní', autoriza: true },
    imagen: { familias: true, redes: false, promocional: false },
  },
  colegio: {
    sede: 'Colegio CRISFE Carcelén',
    sede_corta: 'Carcelén',
    institucion: 'CRISFE',
    minimo_alumnos: 14,
    tarifa: 32.1,
    descuento_hermano: 20,
  },
  aplicaDescuento: false,
};

const plantilla = (t: (typeof TIPOS_DOCUMENTO)[number]) => PLANTILLAS_INICIALES[t];

describe('plantillas iniciales', () => {
  it.each(TIPOS_DOCUMENTO)('%s se puede publicar tal cual', (tipo) => {
    expect(problemasDePlantilla(tipo, plantilla(tipo).contenido)).toEqual([]);
  });

  it('el contrato rellenado dice lo mismo que el Word de CRISFE', () => {
    const t = textoRellenado('contrato', plantilla('contrato').titulo, plantilla('contrato').contenido, datos);
    expect(t).toContain('de la sede Colegio CRISFE Carcelén, de conformidad');
    expect(t).toContain('Cada grupo requiere al menos 14 estudiantes en Carcelén.');
    expect(t).toContain(
      'Sede: Carcelén. Tarifa ordinaria mensual: USD 32,10 más IVA aplicable. Descuento por hermanos: 20 % por cada hermano beneficiario.',
    );
    expect(t).toContain('coordinará la atención de enfermería ofrecida por CRISFE');
    expect(t).toContain('representante legal del menor Martín Pérez Andrade');
    expect(t).not.toContain('{{');
  });
});

describe('problemasDePlantilla', () => {
  it('no deja publicar la autorizacion sin su casilla', () => {
    expect(problemasDePlantilla('autorizacion_datos', 'Autorizo...')).toContain(
      'Tiene que llevar una vez [casilla acepta] (lleva 0).',
    );
  });

  it('marca la pieza que no va y el dato que no existe', () => {
    const p = problemasDePlantilla('politica', '[firma activa]\n\nHola {{nombre_raro}}');
    expect(p).toContain('[firma activa] no va en este documento.');
    expect(p).toContain('El dato {{nombre_raro}} no existe.');
  });

  it('una directiva mal escrita no pasa', () => {
    expect(problemasDePlantilla('politica', '[casila acepta] x')).toEqual([
      '[casila acepta] no es una pieza conocida.',
    ]);
  });
});

describe('analizar', () => {
  it('reconoce cada pieza y deja lo demas como parrafo', () => {
    const b = analizar('# Uno\n\n## Dos\n\n[casilla redes] Publicar\n\n[firma activa]\nA\nB\n\nTexto');
    expect(b.map((x) => x.t)).toEqual(['subtitulo', 'centrado', 'casilla', 'firma', 'parrafo']);
    expect(b[3]).toEqual({ t: 'firma', quien: 'activa', leyenda: ['A', 'B'] });
  });
});

describe('textoRellenado', () => {
  it('la huella cambia si cambia una respuesta', () => {
    const p = plantilla('imagen');
    const a = sha256(textoRellenado('imagen', p.titulo, p.contenido, datos));
    const b = sha256(
      textoRellenado('imagen', p.titulo, p.contenido, {
        ...datos,
        alumno: { ...datos.alumno, imagen: { ...datos.alumno.imagen, redes: true } },
      }),
    );
    expect(a).not.toBe(b);
  });

  it('la aprobacion no cambia la huella: no la vio el representante', () => {
    const p = plantilla('contrato');
    const a = textoRellenado('contrato', p.titulo, p.contenido, datos);
    const b = textoRellenado('contrato', p.titulo, p.contenido, {
      ...datos,
      aprobacion: { nombre: 'Admin', fecha: new Date() },
    });
    expect(a).toBe(b);
  });

  it('la ficha lleva sus filas con las etiquetas del Word', () => {
    const p = plantilla('ficha_matricula');
    const t = textoRellenado('ficha_matricula', p.titulo, p.contenido, datos);
    expect(t).toContain('Nombres y apellidos del representante legal: María José Pérez Andrade');
    expect(t).toContain('¿Aplica descuento por hermano? (Sí / No): No');
    expect(t).toContain('Modalidad de salida / recorrido: [ ] Transporte escolar [X] Transporte privado');
    expect(t).toContain('Días / horario: Fútbol: Martes 16:00 a 17:00; Fútbol: Jueves 16:00 a 17:00');
  });
});

describe('generarPaquete', () => {
  it('genera un PDF con el membrete una sola vez', async () => {
    const membrete = await readFile(new URL('../../../assets/membrete.png', import.meta.url));
    const documentos = TIPOS_DOCUMENTO.map((tipo, i) => ({
      tipo,
      titulo: plantilla(tipo).titulo,
      contenido: plantilla(tipo).contenido,
      version: i + 1,
    }));
    const { pdf, sha256: huella } = await generarPaquete({
      documentos,
      datos: { ...datos, aprobacion: { nombre: 'Admin de prueba', fecha: new Date() } },
      constancias: documentos.map((d) => ({
        tipo: d.tipo,
        version: d.version,
        sha256: 'a'.repeat(64),
        respuesta: 'Leído y aceptado',
      })),
      membrete,
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(huella).toMatch(/^[0-9a-f]{64}$/);
    // Siete o más páginas con el membrete y aun así pequeño: la imagen va una vez.
    expect(pdf.length).toBeLessThan(400 * 1024);
    if (process.env.PDF_DE_PRUEBA) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(process.env.PDF_DE_PRUEBA, pdf);
    }
  });
});
