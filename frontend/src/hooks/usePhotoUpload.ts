
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";

export const usePhotoUpload = (initialPhotoUrl?: string | null) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCleared, setPhotoCleared] = useState(false);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    // Transparent compression before upload
    let toUpload = file;
    try {
      toUpload = await compressImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        initialQuality: 0.8,
        useWebWorker: true,
      });
    } catch (compressionError) {
      console.warn("⚠️ Image compression failed, proceeding with original file:", compressionError);
    }

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Perform the upload
      const uploadResult = await supabase.storage
        .from('usufoto')
        .upload(filePath, toUpload);

      if (uploadResult.error) {
        console.error("❌ Upload failed:", uploadResult.error);
        throw uploadResult.error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('usufoto')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("💥 Upload error caught:", error);
      return null;
    }
  };

  const deleteOldPhoto = async (photoUrl: string): Promise<boolean> => {
    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = fileName;
      
      // Perform the deletion
      const deleteResult = await supabase.storage
        .from('usufoto')
        .remove([filePath]);

      if (deleteResult.error) {
        console.error("❌ Delete failed:", deleteResult.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("💥 Delete error caught:", error);
      return false;
    }
  };

  // Custom photo change handler to track clearing
  const handlePhotoChange = (file: File | null) => {
    setPhotoFile(file);
    if (file === null && initialPhotoUrl) {
      setPhotoCleared(true);
    } else {
      setPhotoCleared(false);
    }
  };

  return {
    photoFile,
    photoCleared,
    uploadPhoto,
    deleteOldPhoto,
    handlePhotoChange,
  };
};
