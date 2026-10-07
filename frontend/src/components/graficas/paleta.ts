/**
 * La paleta de las gráficas, y por qué es la que es.
 *
 * ===========================================================================
 * Nada de esto se eligió a ojo
 * ===========================================================================
 *
 * Los colores salen de una paleta de referencia y **se validaron con un script**
 * contra las dos superficies reales de la aplicación —`#ffffff` en claro y
 * `#24272e` (el token `--card`) en oscuro— midiendo cuatro cosas: que el tono
 * caiga en la banda de luminosidad de su fondo, que tenga color suficiente para
 * no leerse gris, que los pares contiguos se distingan **bajo daltonismo**
 * (ΔE ≥ 8 en OKLab ×100) y con visión normal (ΔE ≥ 15), y el contraste contra
 * la superficie.
 *
 * ===========================================================================
 * El hallazgo que cambió el diseño: verde y ámbar no pueden convivir
 * ===========================================================================
 *
 * El primer intento fue el obvio: Presente verde, Tarde ámbar, Justificado
 * azul, Ausente rojo — los mismos colores que los botones de pasar lista.
 * Al medirlo:
 *
 *   · El ámbar brillante (`#fab219`) separa bien del verde (ΔE 11.3) pero tiene
 *     **1.83:1 de contraste sobre blanco**: un relleno casi invisible.
 *   · Al oscurecerlo para que se vea (`#c98500`, `#b87d00`, `#a87400`) el
 *     contraste se arregla y **la separación con el verde se desploma a ΔE 3.0,
 *     2.6 y 2.0** — un protán o un deután no distingue "Presente" de "Tarde".
 *   · Y verde contra rojo, los dos estados que más importan, mide **ΔE 4.1**
 *     bajo deuteranopía. Es el choque rojo/verde de manual.
 *
 * No hay paso intermedio que salve las dos cosas: sobre blanco, verde y ámbar
 * son incompatibles.
 *
 * ===========================================================================
 * La solución: la asistencia no es identidad, es una escala ordenada
 * ===========================================================================
 *
 * Presente → Tarde → Justificado → Ausente no son cuatro categorías sueltas:
 * son una escala de "vino" a "no vino". Para eso la forma correcta no es una
 * paleta categórica sino una **divergente**: dos polos que se leen como
 * opuestos y un neutro en medio.
 *
 *   Presente     azul intenso   polo positivo
 *   Tarde        azul claro     positivo débil
 *   Justificado  gris neutro    ni bueno ni malo: faltó, pero está justificado
 *   Ausente      rojo           polo negativo
 *
 * Azul ↔ rojo es el par divergente validado (uno frío, uno cálido), y el gris
 * del medio se lee como "nada". Así desaparece el choque rojo/verde: los dos
 * estados que más importan quedan en los extremos y separados por dos tramos.
 *
 * Medido, con la lista de pares contiguos que es la que aplica a una barra
 * apilada: **claro ΔE 9.7 daltónico / 16.8 visión normal; oscuro ΔE 9.7 / 16.8**.
 * Pasa en los dos modos.
 *
 * ===========================================================================
 * Por qué los botones de pasar lista siguen en verde
 * ===========================================================================
 *
 * Porque un botón no es una marca de datos. "Verde = Presente" en un control
 * es una convención que el entrenador ya tiene en el dedo, y cambiarla para
 * que cuadre con una gráfica sería empeorar la herramienta para mejorar el
 * informe. La gráfica, en cambio, siempre lleva leyenda y tabla, así que nadie
 * tiene que emparejar colores entre las dos pantallas.
 *
 * ===========================================================================
 * Lo que queda obligado
 * ===========================================================================
 *
 * Dos colores quedan por debajo de 3:1 contra su superficie —el azul claro de
 * "Tarde" en modo claro (2.11) y el verde azulado de la serie 3 (2.82)—. La
 * regla para eso es **relieve**: la gráfica no puede depender solo del color.
 * Por eso todas llevan leyenda, etiquetas directas en los valores que importan
 * y **una vista de tabla**, que además es la versión accesible de cualquier
 * gráfica.
 */

/** Los roles, como variables CSS: el tema los cambia sin que la gráfica se entere. */
export const COLOR = {
  superficie: 'var(--graf-superficie)',
  serie1: 'var(--graf-serie-1)',
  serie2: 'var(--graf-serie-2)',
  serie3: 'var(--graf-serie-3)',
  rejilla: 'var(--graf-rejilla)',
  eje: 'var(--graf-eje)',
  tinta: 'var(--graf-tinta)',
} as const;

/** Los cuatro estados, en orden de la escala. El orden es el de la pila. */
export const ESCALA_ASISTENCIA = [
  { clave: 'presente', nombre: 'Presente', color: 'var(--graf-presente)' },
  { clave: 'tarde', nombre: 'Tarde', color: 'var(--graf-tarde)' },
  { clave: 'justificado', nombre: 'Justificado', color: 'var(--graf-justificado)' },
  { clave: 'ausente', nombre: 'Ausente', color: 'var(--graf-ausente)' },
] as const;

/**
 * Los tres tonos categóricos, **en orden fijo**.
 *
 * Se asignan por posición y nunca se reciclan: si una gráfica necesitara un
 * cuarto, la respuesta no es inventar un tono —bajo daltonismo sería
 * indistinguible de otro— sino agrupar la cola en "Otros" o partir en varias
 * gráficas. Y el color sigue a la entidad, no a su puesto en el ranking: al
 * filtrar, quien sobrevive conserva el suyo.
 */
export const CATEGORICOS = [COLOR.serie1, COLOR.serie2, COLOR.serie3] as const;

/** Specs de las marcas. Fijas en todas las gráficas: la única que grita son los datos. */
export const MARCA = {
  /** La barra nunca llena su carril; lo que sobra es aire. */
  grosorBarra: 24,
  /** Redondeo solo en la punta, cuadrado en la base. */
  radioBarra: [4, 4, 0, 0] as [number, number, number, number],
  radioBarraH: [0, 4, 4, 0] as [number, number, number, number],
  lineaAncho: 2,
  puntoRadio: 4,
  /** Hueco de 2 px en color de superficie entre segmentos que se tocan. */
  hueco: 2,
} as const;
