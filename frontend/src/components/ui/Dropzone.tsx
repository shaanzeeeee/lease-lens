import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from './components';
import { apiClient } from '../../api/client';

interface DropzoneProps {
  propertyId: string;
  onUploadComplete?: () => void;
}

export function Dropzone({ propertyId, onUploadComplete }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setStatus('idle');
    
    const formData = new FormData();
    // Support multiple files if needed, but the backend usually expects one per request
    // or we loop through them. Let's do a loop for reliability.
    
    try {
      for (const file of files) {
        const data = new FormData();
        data.append('files', file);
        data.append('property_id', propertyId);
        await apiClient.post('/documents/upload', data);
      }
      setStatus('success');
      if (onUploadComplete) onUploadComplete();
      
      // Reset after success
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error('Upload failed', err);
      setStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

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
    handleUpload(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleUpload(files);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative group cursor-pointer border-2 border-dashed rounded-xl p-10 transition-all duration-300 text-center overflow-hidden',
        isDragActive 
          ? 'border-primary bg-primary/5 ring-4 ring-primary/10' 
          : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50',
        status === 'success' && 'border-green-500/50 bg-green-500/5',
        status === 'error' && 'border-destructive/50 bg-destructive/5'
      )}
      onClick={() => !isUploading && document.getElementById('dropzone-input')?.click()}
    >
      <input
        id="dropzone-input"
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
        disabled={isUploading}
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "p-4 rounded-full transition-all duration-500",
          isDragActive ? "scale-110 bg-primary/20" : "bg-primary/10",
          status === 'success' ? "bg-green-500/20 text-green-500" : "text-primary",
          status === 'error' ? "bg-destructive/20 text-destructive" : "text-primary"
        )}>
          {isUploading ? (
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle2 className="w-8 h-8 animate-in zoom-in" />
          ) : status === 'error' ? (
            <AlertCircle className="w-8 h-8 animate-in zoom-in" />
          ) : (
            <Upload className={cn("w-8 h-8 transition-transform", isDragActive && "translate-y-[-4px]")} />
          )}
        </div>
        
        <div>
          <p className="text-lg font-bold tracking-tight">
            {isUploading ? "Uploading to AI Pipeline..." : 
             status === 'success' ? "Ingestion Complete" :
             status === 'error' ? "Upload Failed" :
             "Drop documents for AI Extraction"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            {isUploading ? "Your documents are being indexed for RAG." : 
             status === 'success' ? "Documents are now being processed by GPT-4o." :
             status === 'error' ? "Please check file format and try again." :
             "Support for PDF, Images, and Excel."}
          </p>
        </div>
      </div>
      
      {isUploading && (
        <div className="absolute bottom-0 left-0 h-1 bg-primary animate-progress-indefinite w-full" />
      )}
    </div>
  );
}
