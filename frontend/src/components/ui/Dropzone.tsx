import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from './components';
import { apiClient } from '../../api/client';

interface DropzoneProps {
  propertyId: string;
  category?: string;
  onUploadComplete?: () => void;
}

export function Dropzone({ propertyId, category, onUploadComplete }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleUpload = async (filesToUpload: { file: File, path: string }[]) => {
    if (filesToUpload.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setStatus('idle');
    
    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, path } = filesToUpload[i];
        const data = new FormData();
        data.append('files', file);
        data.append('property_id', propertyId);
        
        let fileCategory = category;
        let fileSubcategory = null;

        // If path is provided (from folder drag/drop), try to derive category/subcategory
        if (path) {
          const parts = path.split('/').filter(Boolean);
          // e.g. path="expenses/School_Tax/Invoice.pdf"
          // parts = ["expenses", "School_Tax", "Invoice.pdf"]
          if (parts.length > 1) {
            fileCategory = parts[0];
          }
          if (parts.length > 2) {
            fileSubcategory = parts[1];
          }
        }

        if (fileCategory) {
          data.append('category', fileCategory);
        }
        if (fileSubcategory) {
          data.append('subcategory', fileSubcategory);
        }
        
        await apiClient.post('/documents/upload', data, {
          onUploadProgress: (progressEvent) => {
            const fileProgress = progressEvent.total ? progressEvent.loaded / progressEvent.total : 0;
            const overallProgress = Math.round(((i + fileProgress) / filesToUpload.length) * 100);
            setUploadProgress(overallProgress);
          }
        });
      }
      setStatus('success');
      setUploadProgress(100);
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

  const getFilesFromEntry = async (entry: any, path: string = ''): Promise<{file: File, path: string}[]> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          resolve([{ file, path: path ? `${path}/${file.name}` : file.name }]);
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries: any[]) => {
          const promises = entries.map(e => getFilesFromEntry(e, path ? `${path}/${entry.name}` : entry.name));
          const results = await Promise.all(promises);
          resolve(results.flat());
        });
      });
    }
    return [];
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    
    const items = e.dataTransfer.items;
    let filesToUpload: {file: File, path: string}[] = [];
    
    if (items) {
      const promises = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          promises.push(getFilesFromEntry(item));
        }
      }
      const results = await Promise.all(promises);
      filesToUpload = results.flat();
    } else {
      const files = Array.from(e.dataTransfer.files);
      filesToUpload = files.map(file => ({ file, path: file.name }));
    }
    
    handleUpload(filesToUpload);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleUpload(files.map(file => ({ file, path: file.webkitRelativePath || file.name })));
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
    >
      <input
        id="dropzone-input"
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.xlsx,.xls,.csv,application/pdf,image/jpeg,image/png,image/tiff,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        onChange={handleFileInput}
        disabled={isUploading}
      />
      <input
        id="dropzone-input-folder"
        type="file"
        multiple
        className="hidden"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        onChange={handleFileInput}
        disabled={isUploading}
      />
      
      <div 
        className="flex flex-col items-center gap-4 cursor-pointer"
        onClick={() => !isUploading && document.getElementById('dropzone-input')?.click()}
      >
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
            {isUploading ? "Uploading..." : 
             status === 'success' ? "Upload Complete" :
             status === 'error' ? "Upload Failed" :
             category === 'photo' ? "Drop property photos here" :
             "Drop documents for AI Extraction"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            {isUploading ? "Your files are being processed." : 
             status === 'success' ? (category === 'photo' ? "Photos added to gallery." : "Documents are now being processed by GPT-4o.") :
             status === 'error' ? "Please check file format and try again." :
             category === 'photo' ? "Support for JPG, PNG, TIFF." :
             "Support for PDF, Images, and Excel."}
          </p>
          {!isUploading && status === 'idle' && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('dropzone-input')?.click();
                }}
              >
                Upload Files
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('dropzone-input-folder')?.click();
                }}
              >
                Upload Folder
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {isUploading && (
        <div className="absolute bottom-0 left-0 h-1.5 bg-muted/30 w-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out" 
            style={{ width: `${uploadProgress}%` }} 
          />
        </div>
      )}
    </div>
  );
}
