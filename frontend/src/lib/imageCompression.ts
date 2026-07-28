import imageCompression from 'browser-image-compression';

export type CompressionOptions = {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  initialQuality?: number;
  useWebWorker?: boolean;
};

// Transparently compress image files for upload
// Defaults: ~1MB max, 800px max dimension, quality 0.8
export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  const defaultOptions: CompressionOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 800,
    initialQuality: 0.8,
    useWebWorker: true,
  };

  try {
    const compressed = await imageCompression(file, {
      ...(defaultOptions as any),
      ...(options as any),
    });

    // Ensure we return a File instance; library already returns File
    return compressed as File;
  } catch (err) {
    console.warn('compressImage failed, falling back to original file:', err);
    return file; // Fallback to original if compression fails
  }
};
