
import React from 'react';
import SchoolCard from './SchoolCard';

interface Colegio {
  col_id: number;
  col_nombre: string;
  col_direccion: string;
  col_rep_nombre?: string | null;
  col_rep_foto?: string | null;
  col_rep_telefono?: string | null;
  col_rep_email?: string | null;
  coordinators?: Array<{
    usu_id: number;
    usu_nombre: string;
  }>;
}

interface SchoolCardGridProps {
  schools: Colegio[];
  onEdit: (school: Colegio) => void;
  onDelete: (school: Colegio) => void;
}

const SchoolCardGrid: React.FC<SchoolCardGridProps> = ({ schools, onEdit, onDelete }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {schools.map((school, index) => (
        <SchoolCard
          key={school.col_id}
          school={school}
          onEdit={onEdit}
          onDelete={onDelete}
          index={index}
        />
      ))}
    </div>
  );
};

export default SchoolCardGrid;
