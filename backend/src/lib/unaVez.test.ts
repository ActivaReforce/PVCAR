import { describe, expect, it, vi } from 'vitest';
import { claveValida, unaVez } from './unaVez.js';

describe('unaVez', () => {
  it('con la misma clave hace el trabajo una sola vez', async () => {
    const hacer = vi.fn(async () => ({ ins_id: 34 }));
    const a = await unaVez('clave-de-prueba-0001', hacer);
    const b = await unaVez('clave-de-prueba-0001', hacer);
    expect(hacer).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it('si el primero sigue en curso, el segundo lo espera', async () => {
    let soltar: (v: number) => void = () => {};
    const hacer = vi.fn(() => new Promise<number>((r) => (soltar = r)));
    const primero = unaVez('clave-de-prueba-0002', hacer);
    const segundo = unaVez('clave-de-prueba-0002', hacer);
    soltar(7);
    await expect(primero).resolves.toBe(7);
    await expect(segundo).resolves.toBe(7);
    expect(hacer).toHaveBeenCalledTimes(1);
  });

  it('si el primero falla, el reintento vuelve a probar', async () => {
    const hacer = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('falló'))
      .mockResolvedValueOnce('bien');
    await expect(unaVez('clave-de-prueba-0003', hacer)).rejects.toThrow('falló');
    await expect(unaVez('clave-de-prueba-0003', hacer)).resolves.toBe('bien');
    expect(hacer).toHaveBeenCalledTimes(2);
  });

  it('sin clave no recuerda nada', async () => {
    const hacer = vi.fn(async () => 1);
    await unaVez(null, hacer);
    await unaVez(null, hacer);
    expect(hacer).toHaveBeenCalledTimes(2);
  });

  it('solo acepta claves con forma de clave', () => {
    expect(claveValida('3f2b1c9e-8a7d-4e6f-9b0a-1c2d3e4f5a6b')).toBe(
      '3f2b1c9e-8a7d-4e6f-9b0a-1c2d3e4f5a6b',
    );
    expect(claveValida('corta')).toBeNull();
    expect(claveValida('con espacios y cosas raras <>')).toBeNull();
    expect(claveValida(undefined)).toBeNull();
  });
});
