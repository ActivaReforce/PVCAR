import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { porcentaje, type Asistencia } from '@/api/tablero';

interface Props {
  titulo: string;
  asistencia: Asistencia;
}

const ESTADOS = [
  { clave: 'presente' as const, etiqueta: 'Presente', color: 'text-emerald-700 dark:text-emerald-400' },
  { clave: 'ausente' as const, etiqueta: 'Ausente', color: 'text-rose-700 dark:text-rose-400' },
  { clave: 'tarde' as const, etiqueta: 'Tarde', color: 'text-amber-700 dark:text-amber-400' },
  { clave: 'justificado' as const, etiqueta: 'Justificado', color: 'text-sky-700 dark:text-sky-400' },
];

/**
 * Los cuatro porcentajes de asistencia de un periodo.
 *
 * Lo que cambia respecto al tablero viejo no es cómo se ve, es de dónde salen:
 * allí se descargaban las 13 202 filas de `asistencia_nino` y se contaban en
 * el navegador, en cada carga y cada 60 segundos. Aquí llegan agregadas.
 *
 * Y **se dice sobre cuántos registros son**. Un 100 % de asistencia sobre 4
 * marcas no significa lo mismo que sobre 3 000, y el tablero viejo enseñaba
 * los dos casos exactamente igual.
 */
const TarjetaAsistencia = ({ titulo, asistencia }: Props) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base">{titulo}</CardTitle>
    </CardHeader>
    <CardContent>
      {asistencia.total === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No hay asistencia registrada en este periodo.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ESTADOS.map(({ clave, etiqueta, color }) => (
              <div key={clave}>
                <div className={`text-2xl font-semibold ${color}`}>
                  {porcentaje(asistencia, clave)}%
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {etiqueta} · {asistencia[clave]}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sobre <strong>{asistencia.total}</strong> registro
            {asistencia.total === 1 ? '' : 's'} del periodo.
          </p>
        </>
      )}
    </CardContent>
  </Card>
);

export default TarjetaAsistencia;
