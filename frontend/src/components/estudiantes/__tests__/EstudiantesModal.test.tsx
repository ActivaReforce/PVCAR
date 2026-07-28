
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EstudiantesModal from '../EstudiantesModal';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/hooks/use-toast');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          data: [
            { catninograd_id: 1, catninograd_nombre: 'Grado 1' },
            { catninograd_id: 2, catninograd_nombre: 'Grado 2' }
          ],
          error: null
        }))
      }))
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'test-url' } }))
      }))
    }
  }
}));

vi.mock('../EstudianteBasicForm', () => ({
  default: ({ onInputChange }: any) => (
    <div data-testid="basic-form">
      <button 
        onClick={() => onInputChange('col_id', 1)}
        data-testid="set-colegio-btn"
      >
        Set Colegio
      </button>
      <button 
        onClick={() => onInputChange('nino_nombre', 'Test Student')}
        data-testid="set-nombre-btn"
      >
        Set Nombre
      </button>
    </div>
  )
}));

vi.mock('../EstudianteRepresentanteForm', () => ({
  default: ({ onPadreChange, selectedPadreId }: any) => (
    <div data-testid="representante-form">
      <button 
        onClick={() => onPadreChange(123)}
        data-testid="select-representative-btn"
      >
        Select Representative
      </button>
      <button 
        onClick={() => onPadreChange(null)}
        data-testid="clear-representative-btn"
      >
        Clear Representative
      </button>
      <div data-testid="selected-padre-id">{selectedPadreId}</div>
    </div>
  )
}));

const mockToast = {
  toast: vi.fn(),
  dismiss: vi.fn(),
  toasts: []
};
vi.mocked(useToast).mockReturnValue(mockToast);

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  estudiante: null,
  colegios: [
    { 
      col_id: 1, 
      col_nombre: 'Test School', 
      col_direccion: 'Test Address',
      col_fecha_creacion: '2024-01-01T00:00:00Z',
      col_fecha_modificacion: '2024-01-01T00:00:00Z',
      col_rep_email: 'test@school.com',
      col_rep_foto: null,
      col_rep_nombre: 'Test Rep',
      col_rep_telefono: '123-456-7890'
    }
  ],
  onSuccess: vi.fn()
};

describe('EstudiantesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TODO(Fase 10 — Estudiantes): test heredado roto (el mock de Supabase no cubre la
  // cadena de queries real del componente). Se reescribe al migrar el modulo al API.
  describe.skip('Grade dropdown sorting', () => {
    it('should fetch grades sorted by ID ascending', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      render(<EstudiantesModal {...defaultProps} />);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('categoria_nino_grado');
      });

      const mockChain = supabase.from('categoria_nino_grado');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      
      const selectChain = mockChain.select('*');
      expect(selectChain.order).toHaveBeenCalledWith('catninograd_id');
    });
  });

  describe('Button behavior in step 2', () => {
    beforeEach(async () => {
      render(<EstudiantesModal {...defaultProps} />);
      
      // Fill required fields and move to step 2
      fireEvent.click(screen.getByTestId('set-colegio-btn'));
      fireEvent.click(screen.getByTestId('set-nombre-btn'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Siguiente'));
      });
    });

    it('should show only "Skip & Save" button by default when no representative is selected', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('skip-and-save-btn')).toBeInTheDocument();
        expect(screen.queryByTestId('create-btn')).not.toBeInTheDocument();
      });
    });

    it('should hide "Skip & Save" and show "Create" when a representative is chosen', async () => {
      // Select a representative
      fireEvent.click(screen.getByTestId('select-representative-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('skip-and-save-btn')).not.toBeInTheDocument();
        expect(screen.getByTestId('create-btn')).toBeInTheDocument();
      });
    });

    it('should show "Skip & Save" again when representative is cleared', async () => {
      // First select a representative
      fireEvent.click(screen.getByTestId('select-representative-btn'));
      
      await waitFor(() => {
        expect(screen.getByTestId('create-btn')).toBeInTheDocument();
      });

      // Then clear the representative
      fireEvent.click(screen.getByTestId('clear-representative-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('skip-and-save-btn')).toBeInTheDocument();
        expect(screen.queryByTestId('create-btn')).not.toBeInTheDocument();
      });
    });

    it('should verify representative selection state is tracked correctly', async () => {
      // Initially no representative selected
      expect(screen.getByTestId('selected-padre-id')).toHaveTextContent('');

      // Select representative
      fireEvent.click(screen.getByTestId('select-representative-btn'));
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-padre-id')).toHaveTextContent('123');
      });

      // Clear representative
      fireEvent.click(screen.getByTestId('clear-representative-btn'));
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-padre-id')).toHaveTextContent('');
      });
    });
  });
});
