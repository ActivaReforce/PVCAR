import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORICOS, COLOR, ESCALA_ASISTENCIA, MARCA } from './paleta';
import type { Grafica as DatosGrafica } from '@/api/reportes';

interface Props {
  grafica: DatosGrafica;
}

/** Ticks del eje con separador de miles; los porcentajes llevan su signo. */
const formatear = (valor: number, formato: 'porcentaje' | 'entero') =>
  formato === 'porcentaje' ? `${valor}%` : valor.toLocaleString('es-EC');

/** Un nombre largo se corta para el eje; el tooltip y la tabla lo dan entero. */
const corto = (texto: string, max = 22) =>
  texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;

/**
 * El color de una serie.
 *
 * Por **posición fija**, nunca reciclado y nunca por ranking: si un filtro deja
 * fuera una serie, las que quedan conservan su color. Un lector que aprendió
 * "Presente es el azul intenso" no puede encontrarse con que ahora es otro.
 */
function colorDe(indice: number, escala: string | undefined): string {
  if (escala === 'asistencia') {
    return ESCALA_ASISTENCIA[indice]?.color ?? COLOR.tinta;
  }
  return CATEGORICOS[indice] ?? COLOR.tinta;
}

/**
 * El tooltip.
 *
 * Nunca es la **única** forma de leer un valor —para eso están las etiquetas
 * directas y la vista de tabla—, pero es lo que hace que una gráfica en HTML
 * sea algo más que una imagen. El texto va en tintas del tema; la identidad la
 * lleva el cuadradito de color de al lado, nunca el color de la letra.
 */
interface FilaTooltip {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

function Tooltipito({
  active,
  payload,
  label,
  formato,
  total,
}: {
  active?: boolean;
  payload?: FilaTooltip[];
  label?: string;
  formato: 'porcentaje' | 'entero';
  /** En las apiladas al 100 %, el total de la fila para poder dar el %. */
  total?: (etiqueta: string) => number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const suma = label && total ? total(label) : 0;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      {payload.map((fila) => (
        <p key={fila.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-[2px]"
            style={{ backgroundColor: fila.color }}
          />
          <span className="flex-1">{fila.name}</span>
          <span className="font-medium tabular-nums text-popover-foreground">
            {suma > 0
              ? `${Math.round(((fila.value ?? 0) / suma) * 100)}% · ${fila.value}`
              : formatear(fila.value ?? 0, formato)}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Una gráfica del análisis.
 *
 * Un componente por **forma**, no por gráfica: el backend dice qué forma tiene,
 * qué columna es la etiqueta y cuáles son las series, y aquí se dibuja. Añadir
 * una gráfica es añadir una consulta en el backend y nada aquí.
 *
 * Lo que es igual en todas, y no es decoración:
 *
 * - **Marcas finas.** Barras de 24 px como mucho —lo que sobra del carril es
 *   aire—, líneas de 2 px, rejilla de un pelo y sólida, nunca a rayas.
 * - **Hueco de 2 px en color de superficie** entre segmentos que se tocan. Es
 *   un trazo del color del fondo, que es como se hace un hueco en SVG; no es un
 *   borde, que sería tinta que no son datos.
 * - **Leyenda siempre que haya dos o más series**, y ninguna cuando hay una: el
 *   título ya dice qué se está midiendo, y una caja con un solo cuadradito solo
 *   ocupa sitio.
 * - **Etiquetas directas con cuentagotas.** El valor en la punta de cada barra,
 *   y en una línea solo el último punto. Un número sobre cada dato es ruido y
 *   nadie lo lee.
 * - **Vista de tabla** en todas. Es la versión accesible y la prueba de que
 *   ningún valor depende de distinguir un color.
 *
 * Y lo que **nunca** hay: dos ejes verticales. Dos medidas de escalas distintas
 * son dos gráficas, no una con dos escalas inventadas.
 */
const Grafica = ({ grafica }: Props) => {
  const [verTabla, setVerTabla] = useState(false);

  const { forma, etiqueta, series, formato, escala, datos, nota } = grafica;
  const hayVariasSeries = series.length > 1;

  const totalDeFila = (valor: string): number => {
    const fila = datos.find((d) => String(d[etiqueta]) === valor);
    if (!fila) return 0;
    return series.reduce((suma, s) => suma + Number(fila[s.clave] ?? 0), 0);
  };

  /** Las horizontales crecen con el número de filas para que quepan los nombres. */
  const alto =
    forma === 'linea' || forma === 'histograma'
      ? 260
      : Math.max(200, datos.length * 34 + 40);

  const ejeComun = {
    stroke: COLOR.eje,
    tick: { fill: COLOR.tinta, fontSize: 12 },
    tickLine: false,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{grafica.titulo}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{grafica.descripcion}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={() => setVerTabla((v) => !v)}
            title={verTabla ? 'Ver la gráfica' : 'Ver los datos en tabla'}
            aria-label={verTabla ? 'Ver la gráfica' : 'Ver los datos en tabla'}
            aria-pressed={verTabla}
          >
            <Table2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {datos.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay datos con estos filtros.
          </p>
        )}

        {datos.length > 0 && verTabla && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1)}
                  </th>
                  {series.map((s) => (
                    <th
                      key={s.clave}
                      className="px-3 py-2 text-right font-medium text-muted-foreground"
                    >
                      {s.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {datos.map((fila, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{String(fila[etiqueta] ?? '')}</td>
                    {series.map((s) => (
                      <td key={s.clave} className="px-3 py-1.5 text-right tabular-nums">
                        {formatear(Number(fila[s.clave] ?? 0), formato)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {datos.length > 0 && !verTabla && (
          <>
            {/* La leyenda va fuera del SVG: así se lee en móvil y envuelve. */}
            {hayVariasSeries && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {series.map((s, i) => (
                  <li key={s.clave} className="flex items-center gap-1.5 text-sm">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-[2px]"
                      style={{ backgroundColor: colorDe(i, escala) }}
                    />
                    <span className="text-muted-foreground">{s.nombre}</span>
                  </li>
                ))}
              </ul>
            )}

            <ResponsiveContainer width="100%" height={alto}>
              {forma === 'linea' ? (
                <LineChart data={datos} margin={{ top: 8, right: 44, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={COLOR.rejilla} vertical={false} />
                  <XAxis dataKey={etiqueta} {...ejeComun} minTickGap={24} />
                  <YAxis
                    {...ejeComun}
                    width={46}
                    domain={formato === 'porcentaje' ? [0, 100] : undefined}
                    tickFormatter={(v: number) => formatear(v, formato)}
                  />
                  <Tooltip
                    content={<Tooltipito formato={formato} />}
                    cursor={{ stroke: COLOR.eje, strokeWidth: 1 }}
                  />
                  {series.map((s, i) => (
                    <Line
                      key={s.clave}
                      type="monotone"
                      dataKey={s.clave}
                      name={s.nombre}
                      stroke={colorDe(i, escala)}
                      strokeWidth={MARCA.lineaAncho}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      /* Anillo de 2 px en color de superficie: el punto sigue
                         legible aunque caiga encima de la línea. */
                      activeDot={{
                        r: MARCA.puntoRadio + 1,
                        stroke: COLOR.superficie,
                        strokeWidth: MARCA.hueco,
                      }}
                    />
                  ))}
                </LineChart>
              ) : forma === 'histograma' ? (
                <BarChart data={datos} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={COLOR.rejilla} vertical={false} />
                  <XAxis dataKey={etiqueta} {...ejeComun} interval={0} fontSize={11} />
                  <YAxis
                    {...ejeComun}
                    width={46}
                    tickFormatter={(v: number) => formatear(v, formato)}
                  />
                  <Tooltip
                    content={<Tooltipito formato={formato} />}
                    cursor={{ fill: COLOR.rejilla, fillOpacity: 0.4 }}
                  />
                  <Bar
                    dataKey={series[0]!.clave}
                    name={series[0]!.nombre}
                    fill={colorDe(0, escala)}
                    maxBarSize={MARCA.grosorBarra}
                    radius={MARCA.radioBarra}
                    /* Los tramos se tocan: el hueco los separa. */
                    stroke={COLOR.superficie}
                    strokeWidth={MARCA.hueco}
                  />
                </BarChart>
              ) : (
                <BarChart
                  data={datos}
                  layout="vertical"
                  stackOffset={forma === 'apilada100' ? 'expand' : undefined}
                  margin={{ top: 4, right: 52, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke={COLOR.rejilla} horizontal={false} />
                  <XAxis
                    type="number"
                    {...ejeComun}
                    domain={forma === 'apilada100' ? [0, 1] : undefined}
                    tickFormatter={(v: number) =>
                      forma === 'apilada100'
                        ? `${Math.round(v * 100)}%`
                        : formatear(v, formato)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey={etiqueta}
                    {...ejeComun}
                    width={140}
                    tickFormatter={(v: string) => corto(String(v))}
                  />
                  <Tooltip
                    content={
                      <Tooltipito
                        formato={formato}
                        total={forma === 'apilada100' ? totalDeFila : undefined}
                      />
                    }
                    cursor={{ fill: COLOR.rejilla, fillOpacity: 0.4 }}
                  />
                  {series.map((s, i) => (
                    <Bar
                      key={s.clave}
                      dataKey={s.clave}
                      name={s.nombre}
                      stackId={forma === 'apilada100' ? 'una' : undefined}
                      fill={colorDe(i, escala)}
                      maxBarSize={MARCA.grosorBarra}
                      radius={forma === 'apilada100' ? undefined : MARCA.radioBarraH}
                      stroke={COLOR.superficie}
                      strokeWidth={MARCA.hueco}
                      /* Etiqueta directa en la punta, solo cuando hay una
                         sola serie: en una apilada no hay punta libre y el
                         número se saldría o quedaría cortado. */
                      label={
                        hayVariasSeries
                          ? undefined
                          : {
                              position: 'right',
                              fill: COLOR.tinta,
                              fontSize: 12,
                              formatter: (v: number) => formatear(v, formato),
                            }
                      }
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </>
        )}

        {nota && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
            {nota}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default Grafica;
