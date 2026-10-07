import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  valor: string[];
  onChange: (materiales: string[]) => void;
}

/**
 * Materiales que trae el alumno.
 *
 * La columna es `text[]` desde siempre, pero el formulario viejo la trataba
 * como una cadena separada por comas: hacía `split(', ')` al cargar y `join`
 * al guardar, así que "silla, mesa" y "silla,mesa" daban resultados distintos
 * y un material con coma dentro se partía en dos.
 *
 * Aquí cada material es un elemento y se ve como tal.
 */
const MaterialesInput = ({ valor, onChange }: Props) => {
  const [texto, setTexto] = useState('');

  const agregar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    if (!valor.some((m) => m.toLowerCase() === limpio.toLowerCase())) {
      onChange([...valor, limpio]);
    }
    setTexto('');
  };

  const quitar = (material: string) => onChange(valor.filter((m) => m !== material));

  return (
    <div className="space-y-2">
      <Label htmlFor="material-nuevo">Materiales que trae el alumno</Label>
      <div className="flex gap-2">
        <Input
          id="material-nuevo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter añade el material, no envía el formulario entero.
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder="Mandil, guitarra, silla…"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-11 flex-shrink-0"
          onClick={agregar}
          aria-label="Añadir material"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {valor.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {valor.map((material) => (
            <Badge key={material} variant="secondary" className="max-w-full gap-1 py-1 pl-2 pr-1">
              <span className="truncate">{material}</span>
              <button
                type="button"
                onClick={() => quitar(material)}
                className="rounded-sm p-0.5 hover:bg-background/60"
                aria-label={`Quitar ${material}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaterialesInput;
