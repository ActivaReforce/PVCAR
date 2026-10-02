/**
 * Pinta un texto legal con las mismas reglas que el PDF del contrato:
 * párrafos separados por línea en blanco y "# " como subtítulo. Así lo que el
 * representante lee en pantalla es lo mismo que queda en su contrato.
 *
 * Texto plano a propósito: nada de HTML ni markdown completo, que obligaría a
 * sanear lo que escribe el admin.
 */
const TextoLegal = ({ texto }: { texto: string }) => (
  <div className="space-y-3 text-sm leading-relaxed">
    {texto
      .split(/\n\s*\n/)
      .map((bloque) => bloque.trim())
      .filter(Boolean)
      .map((bloque, i) =>
        bloque.startsWith('# ') ? (
          <h4 key={i} className="pt-1 font-semibold">
            {bloque.slice(2)}
          </h4>
        ) : (
          <p key={i} className="whitespace-pre-line text-justify">
            {bloque}
          </p>
        ),
      )}
  </div>
);

export default TextoLegal;
