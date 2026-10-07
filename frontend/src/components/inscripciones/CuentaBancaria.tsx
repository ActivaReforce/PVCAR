import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfigInscripciones, useGuardarCuentaBancaria } from '@/hooks/useInscripciones';
import TarjetaConfig from '@/components/inscripciones/TarjetaConfig';

/**
 * A dónde se transfiere el pago (pedido del cliente, 2026-10-05). Texto
 * libre, con saltos de línea, tal cual sale en el paso Pago del formulario
 * público, debajo del total.
 */
const CuentaBancaria = () => {
  const config = useConfigInscripciones();
  const guardar = useGuardarCuentaBancaria();
  const { hasPermission } = usePermissions();
  const [texto, setTexto] = useState('');

  const guardado = config.data?.cuenta_bancaria ?? '';
  useEffect(() => {
    setTexto(guardado);
  }, [guardado]);

  if (!config.data) return null;

  return (
    <TarjetaConfig
      titulo="Cuenta bancaria"
      descripcion="La cuenta a la que los representantes transfieren el pago. Sale en el paso Pago del formulario, tal cual la escribas aquí."
    >
      {hasPermission('inscripciones', 'editar') ? (
        <div className="max-w-xl space-y-1.5">
          <Label htmlFor="cuenta-bancaria">Datos de la cuenta</Label>
          <Textarea
            id="cuenta-bancaria"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={2000}
            rows={6}
            placeholder={'Banco\nTipo y número de cuenta\nTitular y RUC\nCorreo para enviar el comprobante'}
          />
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm">{guardado || 'Sin datos.'}</p>
      )}
      <ConditionalAction module="inscripciones" action="editar">
        <Button
          className="h-11 sm:h-10"
          disabled={texto.trim() === guardado.trim() || guardar.isPending}
          onClick={() => guardar.mutate(texto)}
        >
          <Save className="mr-2 h-4 w-4" />
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </ConditionalAction>
    </TarjetaConfig>
  );
};

export default CuentaBancaria;
