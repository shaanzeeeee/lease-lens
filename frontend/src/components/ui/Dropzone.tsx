import React, { useCallback, useState } from 'react';
import { Upload, File, X } from 'lucide-react';
import { cn } from './components';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
}

export function Dropzone({ onFilesSelected, isLoading }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative group cursor-pointer border-2 border-dashed rounded-xl p-10 transition-all duration-200 text-center',
        isDragActive 
          ? 'border-primary bg-primary/5 ring-4 ring-primary/10' 
          : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50'
      )}
      onClick={() => document.getElementById('dropzone-input')?.click()}
    >
      <input
        id="dropzone-input"
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "p-4 rounded-full bg-primary/10 text-primary transition-transform duration-300",
          isDragActive ? "scale-110" : "group-hover:scale-110"
        )}>
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight">
            {isLoading ? "Uploading..." : "Drop documents here to begin AI Extraction"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Support for PDF, Images, and Excel. Multiple files supported.
          </p>
        </div>
      </div>
    </div>
  );
}
