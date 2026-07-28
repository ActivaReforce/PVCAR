
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import ImageUpload from "@/components/ImageUpload";
import CoordinatorMultiSelect from "./CoordinatorMultiSelect";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";

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

const colegioSchema = z.object({
  col_nombre: z.string().min(1, "Nombre es requerido"),
  col_direccion: z.string().min(1, "Dirección es requerida"),
  col_rep_nombre: z.string().optional().nullable(),
  col_rep_telefono: z.string().optional().nullable(),
  col_rep_email: z.string().email("Email inválido").optional().nullable(),
});

type ColegioFormValues = z.infer<typeof colegioSchema>;

interface SchoolFormProps {
  school?: Colegio | null;
  onSubmit: (values: ColegioFormValues, imageFile: File | null, coordinatorIds: number[]) => Promise<void>;
  onCancel: () => void;
}

const SchoolForm = ({
  school,
  onSubmit,
  onCancel
}: SchoolFormProps) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedCoordinators, setSelectedCoordinators] = useState<number[]>(
    school?.coordinators?.map(c => c.usu_id) || []
  );
  
  const form = useForm<ColegioFormValues>({
    resolver: zodResolver(colegioSchema),
    defaultValues: {
      col_nombre: school?.col_nombre || "",
      col_direccion: school?.col_direccion || "",
      col_rep_nombre: school?.col_rep_nombre || "",
      col_rep_telefono: school?.col_rep_telefono || "",
      col_rep_email: school?.col_rep_email || "",
    }
  });
  
  const handleSubmit = async (values: ColegioFormValues) => {
    await onSubmit(values, imageFile, selectedCoordinators);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="col_nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre *</FormLabel>
              <FormControl>
                <Input placeholder="Nombre del colegio" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="col_direccion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección *</FormLabel>
              <FormControl>
                <Input placeholder="Dirección del colegio" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <CoordinatorMultiSelect
          selectedCoordinators={selectedCoordinators}
          onCoordinatorsChange={setSelectedCoordinators}
          excludeSchoolId={school?.col_id}
        />

        <FormField
          control={form.control}
          name="col_rep_nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Contacto/Autoridad</FormLabel>
              <FormControl>
                <Input placeholder="Nombre del contacto/autoridad del colegio" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <Label>Foto del Contacto/Autoridad</Label>
          <div className="mt-2">
            <ImageUpload
              initialImageUrl={school?.col_rep_foto || null}
              onImageChange={setImageFile}
              acceptedFileTypes="image/jpeg, image/png, image/webp"
              buttonText="Subir Foto"
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="col_rep_telefono"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono del Contacto/Autoridad</FormLabel>
              <FormControl>
                <Input placeholder="Teléfono" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="col_rep_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email del Contacto/Autoridad *</FormLabel>
              <FormControl>
                <Input placeholder="Email" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="flex justify-end gap-2 pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit">
            {school ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

export default SchoolForm;
