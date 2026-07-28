
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  initialImageUrl?: string | null;
  onImageChange: (file: File | null) => void;
  onImageRemove?: () => void;
  acceptedFileTypes?: string;
  className?: string;
  buttonText?: string;
  maxSizeMB?: number;
}

const ImageUpload = ({
  initialImageUrl,
  onImageChange,
  onImageRemove,
  acceptedFileTypes = "image/jpeg, image/png",
  className = "",
  buttonText = "Upload Image",
  maxSizeMB = 2,
}: ImageUploadProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl || null);
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // Check file type
    if (!file.type.match(/(jpeg|jpg|png)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please select a JPG or PNG image",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size using the maxSizeMB prop
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Image must be smaller than ${maxSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Pass file to parent component
    onImageChange(file);
  };
  
  const handleRemoveImage = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onImageChange(null);
    if (onImageRemove) onImageRemove();
  };
  
  const triggerFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };
  
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={acceptedFileTypes}
        className="hidden"
      />
      
      {previewUrl ? (
        <div 
          className="relative mb-3 cursor-pointer"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={triggerFileInput}
        >
          <img
            src={previewUrl}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-full border-4 border-[#FD5757] transition-opacity"
            style={{ opacity: isHovering ? 0.7 : 1 }}
          />
          {isHovering && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Upload className="text-white drop-shadow-md" size={24} />
            </div>
          )}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage();
            }}
            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
            aria-label="Remove image"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <Button 
          type="button"
          onClick={triggerFileInput}
          className="mb-3 bg-[#FD5757] hover:bg-[#E04747] text-white dark:text-white"
        >
          <Upload className="mr-2" size={18} />
          {buttonText}
        </Button>
      )}
    </div>
  );
};

export default ImageUpload;
