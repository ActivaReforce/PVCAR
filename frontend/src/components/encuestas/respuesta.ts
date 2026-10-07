/** Lo que contesta un representante a una pregunta, por tipo. */
export interface ValorRespuesta {
  texto: string;
  numero: number | null;
  fecha: string;
  hora: string;
  sino: boolean | null;
}

export const valorVacio = (): ValorRespuesta => ({ texto: '', numero: null, fecha: '', hora: '', sino: null });

/** Lo mínimo de una pregunta para pintarla: sirve la guardada y la del constructor. */
export interface PreguntaParaPintar {
  encupreg_pregunta: string;
  encupreg_nota?: string | null;
  encutiporesp_id: number;
  encupreg_escala_min?: number | null;
  encupreg_escala_max?: number | null;
}
