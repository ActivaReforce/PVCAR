
import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface AttendanceRowActionsProps {
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  onUndo: () => void;
}

const AttendanceRowActions = React.memo(({
  hasChanges,
  isSaving,
  onSave,
  onUndo
}: AttendanceRowActionsProps) => {
  if (!hasChanges) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onSave}
        disabled={isSaving}
        className="h-7 w-7 p-0"
        title="Guardar cambios"
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onUndo}
        disabled={isSaving}
        className="h-7 w-7 p-0"
        title="Deshacer cambios"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
});

AttendanceRowActions.displayName = 'AttendanceRowActions';

export default AttendanceRowActions;
