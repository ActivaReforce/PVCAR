import { describe, expect, it } from 'vitest';
import { filtrosSchema } from './reportes.schemas.js';

describe('filtrosSchema', () => {
  it('acepta el colegio como texto (URL) y como números (cuerpo de la exportación)', () => {
    expect(filtrosSchema.parse({ colegio: '3,5' }).colegio).toEqual([3, 5]);
    expect(filtrosSchema.parse({ colegio: [3, 5], estado: 2 }).colegio).toEqual([3, 5]);
    expect(filtrosSchema.parse({ colegio: 4 }).colegio).toEqual([4]);
  });
});
