import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PanelCoordinador,
  PanelEntrenador,
  PanelGeneral,
  PanelRepresentante,
} from '@/components/tablero/Paneles';
import Grafica from '@/components/graficas/Grafica';
import { useTablero } from '@/hooks/useTablero';
import type {
  TableroCoordinador,
  TableroEntrenador,
  TableroGeneral,
  TableroId,
  TableroRepresentante,
} from '@/api/tablero';

const enLetras = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Tablero.
 *
 * Dos cosas que el sistema viejo no tenía y que el cliente marcó como errores:
 *
 * 1. **Pestañas.** Quien tiene dos roles ve los dos tableros. Antes una cadena
 *    de `if` se quedaba con el primero, así que un coordinador que además
 *    entrena no llegaba nunca a ver sus propias disciplinas.
 * 2. **El periodo, dicho.** Las cifras de asistencia son de un rango concreto
 *    que se ve y se puede cambiar. Antes eran el histórico completo desde 2025
 *    sin que nada lo indicara.
 *
 * Los inventarios —cuántos colegios, cuántos alumnos— son de hoy y no dependen
 * del periodo. Está escrito en pantalla para que nadie tenga que suponerlo.
 */
const Dashboard = () => {
  const [rol, setRol] = useState<TableroId | undefined>(undefined);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const tablero = useTablero(rol, desde || undefined, hasta || undefined);
  const datos = tablero.data;

  if (tablero.isLoading && !datos) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando tablero...</div>
      </div>
    );
  }

  if (tablero.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudo cargar el tablero: {(tablero.error as Error).message}
        </p>
      </div>
    );
  }

  const disponibles = datos?.disponibles ?? [];
  const actual = datos?.actual ?? null;
  const periodo = datos?.periodo;
  const tendencia = datos?.tendencia ?? [];

  return (
    <div className="container mx-auto min-w-0 max-w-7xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Tablero</h1>
        {periodo && (
          <p className="mt-1 text-sm text-muted-foreground">
            Asistencia del <strong>{enLetras(periodo.desde)}</strong> al{' '}
            <strong>{enLetras(periodo.hasta)}</strong>. Los totales de colegios, alumnos y
            disciplinas son de hoy.
          </p>
        )}
      </div>

      {disponibles.length > 1 && (
        <Tabs value={actual ?? undefined} onValueChange={(v) => setRol(v as TableroId)}>
          <TabsList className="w-full sm:w-auto">
            {disponibles.map((d) => (
              <TabsTrigger key={d.id} value={d.id} className="flex-1 sm:flex-none">
                {d.titulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:max-w-lg">
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input
            id="desde"
            type="date"
            value={desde || (periodo?.desde ?? '')}
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
            className="h-11 sm:h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input
            id="hasta"
            type="date"
            value={hasta || (periodo?.hasta ?? '')}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="h-11 sm:h-10"
          />
        </div>
      </div>

      {(desde || hasta) && (
        <Button
          variant="ghost"
          className="h-11 sm:h-10"
          onClick={() => {
            setDesde('');
            setHasta('');
          }}
        >
          <CalendarRange className="mr-2 h-4 w-4" />
          Volver a los últimos 30 días
        </Button>
      )}

      {/*
        Sin tablero propio no se inventa nada. El sistema viejo enseñaba aquí
        un panel de reserva con cifras escritas a mano en el código.
      */}
      {disponibles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg">Tu rol no tiene un tablero propio</p>
            <p className="mt-2 text-sm">
              Usa el menú lateral para entrar a los módulos a los que tengas acceso.
            </p>
          </CardContent>
        </Card>
      )}

      {/*
        La tendencia. Es lo que el tablero viejo no decía: no "cuánta
        asistencia hay" sino si sube o baja. Se reusa el mismo componente de
        gráfica de los reportes, así que los ejes, el tooltip y la vista de
        tabla son exactamente los mismos.
      */}
      {tendencia.length > 1 && (
        <Grafica
          grafica={{
            id: 'tendencia-asistencia',
            titulo: 'Asistencia en el tiempo',
            descripcion: 'Porcentaje de alumnos presentes en cada fecha del periodo.',
            forma: 'linea',
            etiqueta: 'fecha',
            series: [{ clave: 'tasa', nombre: '% presentes' }],
            formato: 'porcentaje',
            nota: 'Cada punto es una fecha con clases. Los días sin registros no aparecen.',
            datos: tendencia as unknown as Array<Record<string, unknown>>,
          }}
        />
      )}

      {actual === 'general' && datos?.datos && (
        <PanelGeneral datos={datos.datos as TableroGeneral} />
      )}
      {actual === 'coordinador' && datos?.datos && (
        <PanelCoordinador datos={datos.datos as TableroCoordinador} />
      )}
      {actual === 'entrenador' && datos?.datos && (
        <PanelEntrenador datos={datos.datos as TableroEntrenador} />
      )}
      {actual === 'representante' && datos?.datos && (
        <PanelRepresentante datos={datos.datos as TableroRepresentante} />
      )}
    </div>
  );
};

export default Dashboard;
