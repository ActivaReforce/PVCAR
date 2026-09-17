import {
  Activity,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  School,
  Users,
  UsersRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { porcentaje } from '@/api/tablero';
import type {
  TableroCoordinador,
  TableroEntrenador,
  TableroGeneral,
  TableroRepresentante,
} from '@/api/tablero';
import TarjetaAsistencia from './TarjetaAsistencia';
import TarjetaCifra from './TarjetaCifra';

/**
 * Los cuatro paneles.
 *
 * Cada uno recibe ya los datos y solo los pinta: quién puede ver cuál y qué
 * cuentas se hacen es cosa del backend. En el sistema viejo cada panel traía
 * su propio hook con entre 9 y 14 consultas a Supabase, y el del representante
 * además cruzaba asistencias y evaluaciones en memoria.
 */

export const PanelGeneral = ({ datos }: { datos: TableroGeneral }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <TarjetaCifra titulo="Colegios" valor={datos.colegios} icono={School} a="/colegios" />
      <TarjetaCifra
        titulo="Usuarios activos"
        valor={datos.usuarios}
        icono={Users}
        a="/usuarios"
      />
      <TarjetaCifra
        titulo="Actividades"
        valor={datos.actividades}
        icono={Activity}
        a="/actividades"
      />
      <TarjetaCifra
        titulo="Disciplinas activas"
        valor={datos.disciplinas}
        icono={BookOpen}
        a="/disciplinas"
      />
      <TarjetaCifra
        titulo="Alumnos activos"
        valor={datos.estudiantes}
        icono={GraduationCap}
        a="/estudiantes"
      />
      <TarjetaCifra
        titulo="Evaluaciones activas"
        valor={datos.evaluaciones}
        icono={ClipboardList}
        a="/evaluaciones"
      />
      <TarjetaCifra
        titulo="Alumnos por evaluar"
        valor={datos.evaluacionesPendientes}
        icono={ClipboardList}
        a="/evaluaciones"
        avisa={datos.evaluacionesPendientes > 0}
      />
      <TarjetaCifra
        titulo="Encuestas publicadas"
        valor={datos.encuestasPublicadas}
        detalle={datos.encuestasPublicadas === 0 ? 'El módulo se estrena vacío' : undefined}
        icono={CalendarCheck}
      />
    </div>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <TarjetaAsistencia titulo="Asistencia de alumnos" asistencia={datos.asistenciaAlumnos} />
      <TarjetaAsistencia
        titulo="Asistencia de entrenadores"
        asistencia={datos.asistenciaEntrenadores}
      />
    </div>
  </div>
);

export const PanelCoordinador = ({ datos }: { datos: TableroCoordinador }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <TarjetaCifra titulo="Colegios a tu cargo" valor={datos.colegios.length} icono={School} />
      <TarjetaCifra
        titulo="Evaluaciones aplicándose"
        valor={datos.evaluacionesAsignadas}
        icono={ClipboardList}
        a="/evaluaciones"
      />
      <TarjetaCifra
        titulo="Alumnos por evaluar"
        valor={datos.evaluacionesPendientes}
        icono={ClipboardList}
        a="/evaluaciones"
        avisa={datos.evaluacionesPendientes > 0}
      />
    </div>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tus colegios</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {datos.colegios.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No tienes ningún colegio asignado todavía.
          </p>
        ) : (
          <ul className="divide-y">
            {datos.colegios.map((c) => (
              <li
                key={c.col_id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="truncate font-medium">{c.col_nombre}</span>
                <span className="flex flex-shrink-0 gap-4 text-sm text-muted-foreground">
                  <span>{c.disciplinas} disciplinas</span>
                  <span>{c.estudiantes} alumnos</span>
                  <span>{c.entrenadores} entrenadores</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <TarjetaAsistencia titulo="Asistencia de alumnos" asistencia={datos.asistenciaAlumnos} />
      <TarjetaAsistencia
        titulo="Asistencia de entrenadores"
        asistencia={datos.asistenciaEntrenadores}
      />
    </div>
  </div>
);

export const PanelEntrenador = ({ datos }: { datos: TableroEntrenador }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <TarjetaCifra
        titulo="Disciplinas que impartes"
        valor={datos.disciplinas.length}
        icono={BookOpen}
      />
      <TarjetaCifra titulo="Tus alumnos" valor={datos.estudiantes} icono={GraduationCap} />
      <TarjetaCifra
        titulo="Alumnos por evaluar"
        valor={datos.evaluacionesPendientes}
        icono={ClipboardList}
        a="/evaluaciones"
        avisa={datos.evaluacionesPendientes > 0}
      />
    </div>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tu semana</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {datos.disciplinas.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No tienes disciplinas asignadas ahora mismo.
          </p>
        ) : (
          <ul className="divide-y">
            {datos.disciplinas.map((d) => (
              <li
                key={d.colacthor_id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.act_nombre}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {d.col_nombre} · {d.dia_nombre} {d.hora ?? ''}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{d.alumnos} alumnos</span>
                  {d.pendientes > 0 && (
                    <Badge variant="secondary">{d.pendientes} por evaluar</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <TarjetaAsistencia
        titulo="Asistencia de tus alumnos"
        asistencia={datos.asistenciaAlumnos}
      />
      <TarjetaAsistencia titulo="Tu asistencia" asistencia={datos.miAsistencia} />
    </div>
  </div>
);

export const PanelRepresentante = ({ datos }: { datos: TableroRepresentante }) => (
  <div className="space-y-4">
    {datos.hijos.length === 0 && (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <UsersRound className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">No tienes representados registrados</p>
          <p className="mt-2 text-sm">
            Se atan desde la ficha del alumno, en la pantalla de Alumnos.
          </p>
        </CardContent>
      </Card>
    )}

    {datos.hijos.map((hijo) => (
      <Card key={hijo.nino_id}>
        <CardHeader className="pb-3">
          <CardTitle className="break-words text-base">
            {hijo.nino_nombre}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {hijo.col_nombre ?? ''} {hijo.catninograd_nombre ?? ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">Disciplinas</p>
            {hijo.disciplinas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin disciplinas activas.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hijo.disciplinas.map((d, i) => (
                  <Badge key={`${d.act_nombre}-${i}`} variant="secondary">
                    {d.act_nombre} · {d.dia_nombre} {d.hora ?? ''}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
                {porcentaje(hijo.asistencia, 'presente')}%
              </div>
              <div className="text-xs text-muted-foreground">
                Asistencia · {hijo.asistencia.total} clases
              </div>
            </div>
            <div>
              <div className="text-xl font-semibold text-rose-700 dark:text-rose-400">
                {hijo.asistencia.ausente}
              </div>
              <div className="text-xs text-muted-foreground">Ausencias</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{hijo.evaluacionesHechas}</div>
              <div className="text-xs text-muted-foreground">Evaluaciones hechas</div>
            </div>
            <div>
              <div
                className={`text-xl font-semibold ${
                  hijo.evaluacionesPendientes > 0
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-muted-foreground'
                }`}
              >
                {hijo.evaluacionesPendientes}
              </div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);
