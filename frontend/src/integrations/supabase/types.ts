export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      actividad: {
        Row: {
          act_descripcion: string | null
          act_espacio_secundario: string | null
          act_espacio_trabajo: string | null
          act_fecha_creacion: string
          act_fecha_modificacion: string
          act_id: number
          act_indumentaria_tipo: string | null
          act_materiales_alumno: string[] | null
          act_nombre: string
          act_tipo_espacio: string | null
          cat_id: number | null
        }
        Insert: {
          act_descripcion?: string | null
          act_espacio_secundario?: string | null
          act_espacio_trabajo?: string | null
          act_fecha_creacion?: string
          act_fecha_modificacion?: string
          act_id?: number
          act_indumentaria_tipo?: string | null
          act_materiales_alumno?: string[] | null
          act_nombre: string
          act_tipo_espacio?: string | null
          cat_id?: number | null
        }
        Update: {
          act_descripcion?: string | null
          act_espacio_secundario?: string | null
          act_espacio_trabajo?: string | null
          act_fecha_creacion?: string
          act_fecha_modificacion?: string
          act_id?: number
          act_indumentaria_tipo?: string | null
          act_materiales_alumno?: string[] | null
          act_nombre?: string
          act_tipo_espacio?: string | null
          cat_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actividad_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["cat_id"]
          },
        ]
      }
      asistencia_auxiliar: {
        Row: {
          asisaux_fecha: string
          asisaux_fecha_registrado: string
          asisaux_hora_tarde: string | null
          asisaux_id: number
          asisaux_razon_justificado: string | null
          asisest_id: number
          col_id: number
          usu_id: number
          usu_registrador: number
        }
        Insert: {
          asisaux_fecha: string
          asisaux_fecha_registrado?: string
          asisaux_hora_tarde?: string | null
          asisaux_id?: number
          asisaux_razon_justificado?: string | null
          asisest_id: number
          col_id: number
          usu_id: number
          usu_registrador: number
        }
        Update: {
          asisaux_fecha?: string
          asisaux_fecha_registrado?: string
          asisaux_hora_tarde?: string | null
          asisaux_id?: number
          asisaux_razon_justificado?: string | null
          asisest_id?: number
          col_id?: number
          usu_id?: number
          usu_registrador?: number
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_auxiliar_asisest_id_fkey"
            columns: ["asisest_id"]
            isOneToOne: false
            referencedRelation: "asistencia_estado"
            referencedColumns: ["asisest_id"]
          },
          {
            foreignKeyName: "asistencia_auxiliar_usu_id_fkey"
            columns: ["usu_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
          {
            foreignKeyName: "asistencia_auxiliar_usu_registrador_fkey"
            columns: ["usu_registrador"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
          {
            foreignKeyName: "fk_asistencia_auxiliar_colegio"
            columns: ["col_id"]
            isOneToOne: false
            referencedRelation: "colegio"
            referencedColumns: ["col_id"]
          },
        ]
      }
      asistencia_entrenador: {
        Row: {
          asisent_fecha: string
          asisent_fecha_registrado: string
          asisent_hora_tarde: string | null
          asisent_id: number
          asisent_razon_justificado: string | null
          asisest_id: number
          col_id: number
          ent_id: number
          usu_registrador: number
        }
        Insert: {
          asisent_fecha: string
          asisent_fecha_registrado?: string
          asisent_hora_tarde?: string | null
          asisent_id?: number
          asisent_razon_justificado?: string | null
          asisest_id: number
          col_id: number
          ent_id: number
          usu_registrador: number
        }
        Update: {
          asisent_fecha?: string
          asisent_fecha_registrado?: string
          asisent_hora_tarde?: string | null
          asisent_id?: number
          asisent_razon_justificado?: string | null
          asisest_id?: number
          col_id?: number
          ent_id?: number
          usu_registrador?: number
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_entrenador_asisest_id_fkey"
            columns: ["asisest_id"]
            isOneToOne: false
            referencedRelation: "asistencia_estado"
            referencedColumns: ["asisest_id"]
          },
          {
            foreignKeyName: "asistencia_entrenador_ent_id_fkey"
            columns: ["ent_id"]
            isOneToOne: false
            referencedRelation: "entrenador"
            referencedColumns: ["ent_id"]
          },
          {
            foreignKeyName: "asistencia_entrenador_usu_registrador_fkey"
            columns: ["usu_registrador"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
          {
            foreignKeyName: "fk_asistencia_entrenador_colegio"
            columns: ["col_id"]
            isOneToOne: false
            referencedRelation: "colegio"
            referencedColumns: ["col_id"]
          },
        ]
      }
      asistencia_estado: {
        Row: {
          asisest_id: number
          asisest_nombre: string
        }
        Insert: {
          asisest_id?: number
          asisest_nombre: string
        }
        Update: {
          asisest_id?: number
          asisest_nombre?: string
        }
        Relationships: []
      }
      asistencia_nino: {
        Row: {
          asisest_id: number
          asisnino_fecha: string
          asisnino_fecha_registrado: string
          asisnino_hora_tarde: string | null
          asisnino_id: number
          asisnino_razon_justificado: string | null
          colacthor_id: number
          nino_id: number
          usu_registrador: number
        }
        Insert: {
          asisest_id: number
          asisnino_fecha: string
          asisnino_fecha_registrado?: string
          asisnino_hora_tarde?: string | null
          asisnino_id?: number
          asisnino_razon_justificado?: string | null
          colacthor_id: number
          nino_id: number
          usu_registrador: number
        }
        Update: {
          asisest_id?: number
          asisnino_fecha?: string
          asisnino_fecha_registrado?: string
          asisnino_hora_tarde?: string | null
          asisnino_id?: number
          asisnino_razon_justificado?: string | null
          colacthor_id?: number
          nino_id?: number
          usu_registrador?: number
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_nino_asisest_id_fkey"
            columns: ["asisest_id"]
            isOneToOne: false
            referencedRelation: "asistencia_estado"
            referencedColumns: ["asisest_id"]
          },
          {
            foreignKeyName: "asistencia_nino_colacthor_id_fkey"
            columns: ["colacthor_id"]
            isOneToOne: false
            referencedRelation: "colegio_actividad_horario"
            referencedColumns: ["colacthor_id"]
          },
          {
            foreignKeyName: "asistencia_nino_nino_id_fkey"
            columns: ["nino_id"]
            isOneToOne: false
            referencedRelation: "nino"
            referencedColumns: ["nino_id"]
          },
          {
            foreignKeyName: "asistencia_nino_usu_registrador_fkey"
            columns: ["usu_registrador"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      categoria: {
        Row: {
          cat_descripcion: string | null
          cat_id: number
          cat_nombre: string
        }
        Insert: {
          cat_descripcion?: string | null
          cat_id?: number
          cat_nombre: string
        }
        Update: {
          cat_descripcion?: string | null
          cat_id?: number
          cat_nombre?: string
        }
        Relationships: []
      }
      categoria_nino_grado: {
        Row: {
          catninograd_id: number
          catninograd_nombre: string
        }
        Insert: {
          catninograd_id?: number
          catninograd_nombre: string
        }
        Update: {
          catninograd_id?: number
          catninograd_nombre?: string
        }
        Relationships: []
      }
      colegio: {
        Row: {
          col_direccion: string
          col_fecha_creacion: string | null
          col_fecha_modificacion: string | null
          col_id: number
          col_nombre: string
          col_rep_email: string | null
          col_rep_foto: string | null
          col_rep_nombre: string | null
          col_rep_telefono: string | null
        }
        Insert: {
          col_direccion: string
          col_fecha_creacion?: string | null
          col_fecha_modificacion?: string | null
          col_id?: number
          col_nombre: string
          col_rep_email?: string | null
          col_rep_foto?: string | null
          col_rep_nombre?: string | null
          col_rep_telefono?: string | null
        }
        Update: {
          col_direccion?: string
          col_fecha_creacion?: string | null
          col_fecha_modificacion?: string | null
          col_id?: number
          col_nombre?: string
          col_rep_email?: string | null
          col_rep_foto?: string | null
          col_rep_nombre?: string | null
          col_rep_telefono?: string | null
        }
        Relationships: []
      }
      colegio_actividad_horario: {
        Row: {
          act_id: number | null
          col_id: number | null
          colacthor_fecha_creacion: string
          colacthor_hora_fin: string | null
          colacthor_hora_inicio: string | null
          colacthor_id: number
          dia_id: number | null
          est_id: number | null
        }
        Insert: {
          act_id?: number | null
          col_id?: number | null
          colacthor_fecha_creacion?: string
          colacthor_hora_fin?: string | null
          colacthor_hora_inicio?: string | null
          colacthor_id?: number
          dia_id?: number | null
          est_id?: number | null
        }
        Update: {
          act_id?: number | null
          col_id?: number | null
          colacthor_fecha_creacion?: string
          colacthor_hora_fin?: string | null
          colacthor_hora_inicio?: string | null
          colacthor_id?: number
          dia_id?: number | null
          est_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colegio_actividad_horario_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: false
            referencedRelation: "actividad"
            referencedColumns: ["act_id"]
          },
          {
            foreignKeyName: "colegio_actividad_horario_col_id_fkey"
            columns: ["col_id"]
            isOneToOne: false
            referencedRelation: "colegio"
            referencedColumns: ["col_id"]
          },
          {
            foreignKeyName: "colegio_actividad_horario_dia_id_fkey"
            columns: ["dia_id"]
            isOneToOne: false
            referencedRelation: "dia"
            referencedColumns: ["dia_id"]
          },
          {
            foreignKeyName: "colegio_actividad_horario_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
        ]
      }
      colegio_coordinador: {
        Row: {
          col_id: number
          colcoor_id: number
          usu_id: number
        }
        Insert: {
          col_id: number
          colcoor_id?: number
          usu_id: number
        }
        Update: {
          col_id?: number
          colcoor_id?: number
          usu_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "colegio_coordinador_col_id_fkey"
            columns: ["col_id"]
            isOneToOne: false
            referencedRelation: "colegio"
            referencedColumns: ["col_id"]
          },
          {
            foreignKeyName: "colegio_coordinador_usu_id_fkey"
            columns: ["usu_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      dia: {
        Row: {
          dia_id: number
          dia_nombre: string
        }
        Insert: {
          dia_id?: number
          dia_nombre: string
        }
        Update: {
          dia_id?: number
          dia_nombre?: string
        }
        Relationships: []
      }
      encuesta: {
        Row: {
          encu_creador: number
          encu_descripcion: string | null
          encu_fecha_creacion: string
          encu_fecha_modificacion: string | null
          encu_id: number
          encu_titulo: string
          est_id: number
        }
        Insert: {
          encu_creador: number
          encu_descripcion?: string | null
          encu_fecha_creacion?: string
          encu_fecha_modificacion?: string | null
          encu_id?: number
          encu_titulo: string
          est_id: number
        }
        Update: {
          encu_creador?: number
          encu_descripcion?: string | null
          encu_fecha_creacion?: string
          encu_fecha_modificacion?: string | null
          encu_id?: number
          encu_titulo?: string
          est_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "encuesta_encu_creador_fkey"
            columns: ["encu_creador"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
          {
            foreignKeyName: "encuesta_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
        ]
      }
      encuesta_pregunta: {
        Row: {
          encu_id: number
          encupreg_escala_max: number | null
          encupreg_escala_min: number | null
          encupreg_id: number
          encupreg_nota: string | null
          encupreg_orden: number
          encupreg_pregunta: string
          encutiporesp_id: number
        }
        Insert: {
          encu_id: number
          encupreg_escala_max?: number | null
          encupreg_escala_min?: number | null
          encupreg_id?: number
          encupreg_nota?: string | null
          encupreg_orden: number
          encupreg_pregunta: string
          encutiporesp_id: number
        }
        Update: {
          encu_id?: number
          encupreg_escala_max?: number | null
          encupreg_escala_min?: number | null
          encupreg_id?: number
          encupreg_nota?: string | null
          encupreg_orden?: number
          encupreg_pregunta?: string
          encutiporesp_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "encuesta_pregunta_encu_id_fkey"
            columns: ["encu_id"]
            isOneToOne: false
            referencedRelation: "encuesta"
            referencedColumns: ["encu_id"]
          },
          {
            foreignKeyName: "encuesta_pregunta_encutiporesp_id_fkey"
            columns: ["encutiporesp_id"]
            isOneToOne: false
            referencedRelation: "encuesta_tipo_respuesta"
            referencedColumns: ["encutiporesp_id"]
          },
        ]
      }
      encuesta_respondida: {
        Row: {
          encu_id: number
          encurespo_fecha_registro: string
          encurespo_id: number
          padre_id: number
        }
        Insert: {
          encu_id: number
          encurespo_fecha_registro?: string
          encurespo_id?: number
          padre_id: number
        }
        Update: {
          encu_id?: number
          encurespo_fecha_registro?: string
          encurespo_id?: number
          padre_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "encuesta_respondida_encu_id_fkey"
            columns: ["encu_id"]
            isOneToOne: false
            referencedRelation: "encuesta"
            referencedColumns: ["encu_id"]
          },
          {
            foreignKeyName: "encuesta_respondida_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "padre"
            referencedColumns: ["padre_id"]
          },
        ]
      }
      encuesta_respuesta: {
        Row: {
          encupreg_id: number
          encurespo_id: number
          encurespu_fecha: string | null
          encurespu_hora: string | null
          encurespu_id: number
          encurespu_num: number | null
          encurespu_sino: boolean | null
          encurespu_texto: string | null
        }
        Insert: {
          encupreg_id: number
          encurespo_id: number
          encurespu_fecha?: string | null
          encurespu_hora?: string | null
          encurespu_id?: number
          encurespu_num?: number | null
          encurespu_sino?: boolean | null
          encurespu_texto?: string | null
        }
        Update: {
          encupreg_id?: number
          encurespo_id?: number
          encurespu_fecha?: string | null
          encurespu_hora?: string | null
          encurespu_id?: number
          encurespu_num?: number | null
          encurespu_sino?: boolean | null
          encurespu_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encuesta_respuesta_encupreg_id_fkey"
            columns: ["encupreg_id"]
            isOneToOne: false
            referencedRelation: "encuesta_pregunta"
            referencedColumns: ["encupreg_id"]
          },
          {
            foreignKeyName: "encuesta_respuesta_encurespo_id_fkey"
            columns: ["encurespo_id"]
            isOneToOne: false
            referencedRelation: "encuesta_respondida"
            referencedColumns: ["encurespo_id"]
          },
        ]
      }
      encuesta_tipo_respuesta: {
        Row: {
          encutiporesp_id: number
          encutiporesp_nombre: string
        }
        Insert: {
          encutiporesp_id?: number
          encutiporesp_nombre: string
        }
        Update: {
          encutiporesp_id?: number
          encutiporesp_nombre?: string
        }
        Relationships: []
      }
      entrenador: {
        Row: {
          ent_cedula: string | null
          ent_fecha_creacion: string | null
          ent_fecha_modificacion: string | null
          ent_id: number
          est_id: number
        }
        Insert: {
          ent_cedula?: string | null
          ent_fecha_creacion?: string | null
          ent_fecha_modificacion?: string | null
          ent_id: number
          est_id?: number
        }
        Update: {
          ent_cedula?: string | null
          ent_fecha_creacion?: string | null
          ent_fecha_modificacion?: string | null
          ent_id?: number
          est_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "entrenador_ent_id_fkey"
            columns: ["ent_id"]
            isOneToOne: true
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
          {
            foreignKeyName: "entrenador_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
          {
            foreignKeyName: "fk_entrenador_usuario"
            columns: ["ent_id"]
            isOneToOne: true
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      entrenador_asignacion: {
        Row: {
          colacthor_id: number | null
          ent_id: number | null
          entasig_fecha_fin: string | null
          entasig_fecha_inicio: string
          entasig_id: number
          est_id: number
        }
        Insert: {
          colacthor_id?: number | null
          ent_id?: number | null
          entasig_fecha_fin?: string | null
          entasig_fecha_inicio: string
          entasig_id?: number
          est_id?: number
        }
        Update: {
          colacthor_id?: number | null
          ent_id?: number | null
          entasig_fecha_fin?: string | null
          entasig_fecha_inicio?: string
          entasig_id?: number
          est_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "entrenador_asignacion_colacthor_id_fkey"
            columns: ["colacthor_id"]
            isOneToOne: false
            referencedRelation: "colegio_actividad_horario"
            referencedColumns: ["colacthor_id"]
          },
          {
            foreignKeyName: "entrenador_asignacion_ent_id_fkey"
            columns: ["ent_id"]
            isOneToOne: false
            referencedRelation: "entrenador"
            referencedColumns: ["ent_id"]
          },
          {
            foreignKeyName: "entrenador_asignacion_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
        ]
      }
      entrenador_auxiliar: {
        Row: {
          ent_id: number | null
          entaux_id: number
          est_id: number | null
          rol_id: number | null
          usu_id: number | null
        }
        Insert: {
          ent_id?: number | null
          entaux_id?: number
          est_id?: number | null
          rol_id?: number | null
          usu_id?: number | null
        }
        Update: {
          ent_id?: number | null
          entaux_id?: number
          est_id?: number | null
          rol_id?: number | null
          usu_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entrenador_auxiliar_ent_id_fkey"
            columns: ["ent_id"]
            isOneToOne: false
            referencedRelation: "entrenador"
            referencedColumns: ["ent_id"]
          },
          {
            foreignKeyName: "entrenador_auxiliar_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
          {
            foreignKeyName: "entrenador_auxiliar_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "rol"
            referencedColumns: ["rol_id"]
          },
          {
            foreignKeyName: "entrenador_auxiliar_usu_id_fkey"
            columns: ["usu_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      estado: {
        Row: {
          est_id: number
          est_nombre: string
        }
        Insert: {
          est_id?: number
          est_nombre: string
        }
        Update: {
          est_id?: number
          est_nombre?: string
        }
        Relationships: []
      }
      evaluacion: {
        Row: {
          est_id: number
          eva_categoria: string | null
          eva_creador: number
          eva_descripcion: string | null
          eva_fecha_creacion: string
          eva_id: number
          eva_puntaje_total: number | null
          eva_titulo: string
        }
        Insert: {
          est_id?: number
          eva_categoria?: string | null
          eva_creador: number
          eva_descripcion?: string | null
          eva_fecha_creacion?: string
          eva_id?: number
          eva_puntaje_total?: number | null
          eva_titulo: string
        }
        Update: {
          est_id?: number
          eva_categoria?: string | null
          eva_creador?: number
          eva_descripcion?: string | null
          eva_fecha_creacion?: string
          eva_id?: number
          eva_puntaje_total?: number | null
          eva_titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluacion_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
          {
            foreignKeyName: "evaluacion_eva_creador_fkey"
            columns: ["eva_creador"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      evaluacion_asignacion: {
        Row: {
          colacthor_id: number
          est_id: number | null
          eva_id: number
          evaasig_id: number
        }
        Insert: {
          colacthor_id: number
          est_id?: number | null
          eva_id: number
          evaasig_id?: number
        }
        Update: {
          colacthor_id?: number
          est_id?: number | null
          eva_id?: number
          evaasig_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluacion_asignacion_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
          {
            foreignKeyName: "evaluacion_asignacion_eva_id_fkey"
            columns: ["eva_id"]
            isOneToOne: false
            referencedRelation: "evaluacion"
            referencedColumns: ["eva_id"]
          },
          {
            foreignKeyName: "evaluacion_disciplina_colacthor_id_fkey"
            columns: ["colacthor_id"]
            isOneToOne: false
            referencedRelation: "colegio_actividad_horario"
            referencedColumns: ["colacthor_id"]
          },
        ]
      }
      evaluacion_intento: {
        Row: {
          evaint_id: number
          evaint_intento: number
          evaint_logro: boolean | null
          evaint_mobak: number | null
          evaint_num: number | null
          evaint_puntaje_obtenido: number | null
          evaint_tiempo: number | null
          evaninopen_id: number | null
          evaparam_id: number
        }
        Insert: {
          evaint_id?: number
          evaint_intento: number
          evaint_logro?: boolean | null
          evaint_mobak?: number | null
          evaint_num?: number | null
          evaint_puntaje_obtenido?: number | null
          evaint_tiempo?: number | null
          evaninopen_id?: number | null
          evaparam_id: number
        }
        Update: {
          evaint_id?: number
          evaint_intento?: number
          evaint_logro?: boolean | null
          evaint_mobak?: number | null
          evaint_num?: number | null
          evaint_puntaje_obtenido?: number | null
          evaint_tiempo?: number | null
          evaninopen_id?: number | null
          evaparam_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluacion_intento_evaninopen_id_fkey"
            columns: ["evaninopen_id"]
            isOneToOne: false
            referencedRelation: "evaluacion_nino_pendiente"
            referencedColumns: ["evaninopen_id"]
          },
          {
            foreignKeyName: "evaluacion_intento_evaparam_id_fkey"
            columns: ["evaparam_id"]
            isOneToOne: false
            referencedRelation: "evaluacion_parametro"
            referencedColumns: ["evaparam_id"]
          },
        ]
      }
      evaluacion_nino_pendiente: {
        Row: {
          est_id: number
          eva_id: number | null
          evaninopen_fecha_finalizacion: string | null
          evaninopen_id: number
          ninoasig_id: number
          usu_id_registrador: number | null
        }
        Insert: {
          est_id?: number
          eva_id?: number | null
          evaninopen_fecha_finalizacion?: string | null
          evaninopen_id?: number
          ninoasig_id: number
          usu_id_registrador?: number | null
        }
        Update: {
          est_id?: number
          eva_id?: number | null
          evaninopen_fecha_finalizacion?: string | null
          evaninopen_id?: number
          ninoasig_id?: number
          usu_id_registrador?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluacion_nino_pendiente_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
          {
            foreignKeyName: "evaluacion_nino_pendiente_eva_id_fkey"
            columns: ["eva_id"]
            isOneToOne: false
            referencedRelation: "evaluacion"
            referencedColumns: ["eva_id"]
          },
          {
            foreignKeyName: "evaluacion_nino_pendiente_ninoasig_id_fkey"
            columns: ["ninoasig_id"]
            isOneToOne: false
            referencedRelation: "nino_asignacion"
            referencedColumns: ["ninoasig_id"]
          },
          {
            foreignKeyName: "evaluacion_nino_pendiente_usu_id_registrador_fkey"
            columns: ["usu_id_registrador"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      evaluacion_parametro: {
        Row: {
          eva_id: number
          evaparam_escala_max: number | null
          evaparam_escala_min: number | null
          evaparam_id: number
          evaparam_intentos: number | null
          evaparam_nombre: string
          evaparam_nota: string | null
          evaparam_puntaje: number
          evatipometo_id: number | null
        }
        Insert: {
          eva_id: number
          evaparam_escala_max?: number | null
          evaparam_escala_min?: number | null
          evaparam_id?: number
          evaparam_intentos?: number | null
          evaparam_nombre: string
          evaparam_nota?: string | null
          evaparam_puntaje: number
          evatipometo_id?: number | null
        }
        Update: {
          eva_id?: number
          evaparam_escala_max?: number | null
          evaparam_escala_min?: number | null
          evaparam_id?: number
          evaparam_intentos?: number | null
          evaparam_nombre?: string
          evaparam_nota?: string | null
          evaparam_puntaje?: number
          evatipometo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluacion_parametro_eva_id_fkey"
            columns: ["eva_id"]
            isOneToOne: false
            referencedRelation: "evaluacion"
            referencedColumns: ["eva_id"]
          },
          {
            foreignKeyName: "evaluacion_parametro_evatipometo_id_fkey"
            columns: ["evatipometo_id"]
            isOneToOne: false
            referencedRelation: "evaluacion_tipo_metodo"
            referencedColumns: ["evatipometo_id"]
          },
        ]
      }
      evaluacion_tiempo_rangos: {
        Row: {
          evaparam_id: number
          evatieran_id: number
          evatieran_op_cero: string
          evatieran_op_full: string
          evatieran_tiempo_cero: number
          evatieran_tiempo_full: number
        }
        Insert: {
          evaparam_id: number
          evatieran_id?: number
          evatieran_op_cero: string
          evatieran_op_full: string
          evatieran_tiempo_cero: number
          evatieran_tiempo_full: number
        }
        Update: {
          evaparam_id?: number
          evatieran_id?: number
          evatieran_op_cero?: string
          evatieran_op_full?: string
          evatieran_tiempo_cero?: number
          evatieran_tiempo_full?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluacion_tiempo_rangos_evaparam_id_fkey"
            columns: ["evaparam_id"]
            isOneToOne: true
            referencedRelation: "evaluacion_parametro"
            referencedColumns: ["evaparam_id"]
          },
        ]
      }
      evaluacion_tipo_metodo: {
        Row: {
          evatipometo_id: number
          evatipometo_nombre: string
        }
        Insert: {
          evatipometo_id?: number
          evatipometo_nombre: string
        }
        Update: {
          evatipometo_id?: number
          evatipometo_nombre?: string
        }
        Relationships: []
      }
      nino: {
        Row: {
          catninograd_id: number | null
          col_id: number
          est_id: number | null
          nino_cedula: string | null
          nino_edad: number | null
          nino_fecha_creacion: string | null
          nino_fecha_modificacion: string | null
          nino_foto: string | null
          nino_id: number
          nino_info_salud: string | null
          nino_nombre: string
          nino_otra_info: string | null
          nino_toma_transporte: boolean | null
        }
        Insert: {
          catninograd_id?: number | null
          col_id: number
          est_id?: number | null
          nino_cedula?: string | null
          nino_edad?: number | null
          nino_fecha_creacion?: string | null
          nino_fecha_modificacion?: string | null
          nino_foto?: string | null
          nino_id?: number
          nino_info_salud?: string | null
          nino_nombre: string
          nino_otra_info?: string | null
          nino_toma_transporte?: boolean | null
        }
        Update: {
          catninograd_id?: number | null
          col_id?: number
          est_id?: number | null
          nino_cedula?: string | null
          nino_edad?: number | null
          nino_fecha_creacion?: string | null
          nino_fecha_modificacion?: string | null
          nino_foto?: string | null
          nino_id?: number
          nino_info_salud?: string | null
          nino_nombre?: string
          nino_otra_info?: string | null
          nino_toma_transporte?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "nino_catninograd_id_fkey"
            columns: ["catninograd_id"]
            isOneToOne: false
            referencedRelation: "categoria_nino_grado"
            referencedColumns: ["catninograd_id"]
          },
          {
            foreignKeyName: "nino_col_id_fkey"
            columns: ["col_id"]
            isOneToOne: false
            referencedRelation: "colegio"
            referencedColumns: ["col_id"]
          },
          {
            foreignKeyName: "nino_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
        ]
      }
      nino_asignacion: {
        Row: {
          colacthor_id: number
          est_id: number | null
          nino_id: number
          ninoasig_fecha_baja: string | null
          ninoasig_fecha_inscripcion: string
          ninoasig_id: number
        }
        Insert: {
          colacthor_id: number
          est_id?: number | null
          nino_id: number
          ninoasig_fecha_baja?: string | null
          ninoasig_fecha_inscripcion?: string
          ninoasig_id?: number
        }
        Update: {
          colacthor_id?: number
          est_id?: number | null
          nino_id?: number
          ninoasig_fecha_baja?: string | null
          ninoasig_fecha_inscripcion?: string
          ninoasig_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "nino_asignacion_colacthor_id_fkey"
            columns: ["colacthor_id"]
            isOneToOne: false
            referencedRelation: "colegio_actividad_horario"
            referencedColumns: ["colacthor_id"]
          },
          {
            foreignKeyName: "nino_asignacion_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
          {
            foreignKeyName: "nino_asignacion_nino_id_fkey"
            columns: ["nino_id"]
            isOneToOne: false
            referencedRelation: "nino"
            referencedColumns: ["nino_id"]
          },
        ]
      }
      nino_padre: {
        Row: {
          nino_id: number | null
          ninopadre_id: number
          padre_id: number | null
        }
        Insert: {
          nino_id?: number | null
          ninopadre_id?: number
          padre_id?: number | null
        }
        Update: {
          nino_id?: number | null
          ninopadre_id?: number
          padre_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nino_padre_nino_id_fkey"
            columns: ["nino_id"]
            isOneToOne: false
            referencedRelation: "nino"
            referencedColumns: ["nino_id"]
          },
          {
            foreignKeyName: "ninopadre_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "padre"
            referencedColumns: ["padre_id"]
          },
        ]
      }
      padre: {
        Row: {
          padre_fecha_creacion: string | null
          padre_fecha_modificacion: string | null
          padre_id: number
          padre_sector_residencia: string | null
          usu_id: number | null
        }
        Insert: {
          padre_fecha_creacion?: string | null
          padre_fecha_modificacion?: string | null
          padre_id?: number
          padre_sector_residencia?: string | null
          usu_id?: number | null
        }
        Update: {
          padre_fecha_creacion?: string | null
          padre_fecha_modificacion?: string | null
          padre_id?: number
          padre_sector_residencia?: string | null
          usu_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "padre_usu_id_fkey"
            columns: ["usu_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
      rol: {
        Row: {
          rol_descripcion: string | null
          rol_id: number
          rol_nombre: string
          rol_titulo: string
        }
        Insert: {
          rol_descripcion?: string | null
          rol_id?: never
          rol_nombre: string
          rol_titulo: string
        }
        Update: {
          rol_descripcion?: string | null
          rol_id?: never
          rol_nombre?: string
          rol_titulo?: string
        }
        Relationships: []
      }
      rol_permiso: {
        Row: {
          accion: string
          modulo: string
          rol_id: number
          rolper_id: number
        }
        Insert: {
          accion?: string
          modulo: string
          rol_id: number
          rolper_id?: number
        }
        Update: {
          accion?: string
          modulo?: string
          rol_id?: number
          rolper_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rol_permiso_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "rol"
            referencedColumns: ["rol_id"]
          },
        ]
      }
      usuario: {
        Row: {
          est_id: number
          usu_contrasena: string
          usu_correo: string
          usu_fecha_creacion: string | null
          usu_fecha_modificacion: string | null
          usu_foto: string | null
          usu_id: number
          usu_nombre: string
          usu_telefono: string | null
        }
        Insert: {
          est_id?: number
          usu_contrasena: string
          usu_correo: string
          usu_fecha_creacion?: string | null
          usu_fecha_modificacion?: string | null
          usu_foto?: string | null
          usu_id?: number
          usu_nombre: string
          usu_telefono?: string | null
        }
        Update: {
          est_id?: number
          usu_contrasena?: string
          usu_correo?: string
          usu_fecha_creacion?: string | null
          usu_fecha_modificacion?: string | null
          usu_foto?: string | null
          usu_id?: number
          usu_nombre?: string
          usu_telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuario_est_id_fkey"
            columns: ["est_id"]
            isOneToOne: false
            referencedRelation: "estado"
            referencedColumns: ["est_id"]
          },
        ]
      }
      usuario_rol: {
        Row: {
          rol_id: number
          usu_id: number
          usurol_id: number
        }
        Insert: {
          rol_id: number
          usu_id: number
          usurol_id?: number
        }
        Update: {
          rol_id?: number
          usu_id?: number
          usurol_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "usuario_rol_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "rol"
            referencedColumns: ["rol_id"]
          },
          {
            foreignKeyName: "usuario_rol_usu_id_fkey"
            columns: ["usu_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["usu_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_student_evaluation: {
        Args: { p_evaninopen_id: number }
        Returns: undefined
      }
      reactivate_nino_asignacion: {
        Args: { p_colacthor_id: number; p_nino_id: number }
        Returns: number
      }
      set_role_permissions: {
        Args: {
          p_action?: string
          p_actor_usu_id: number
          p_disable_modules?: string[]
          p_enable_modules?: string[]
          p_target_rol_id: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
