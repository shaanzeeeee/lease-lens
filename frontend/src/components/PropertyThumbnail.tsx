import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { apiClient } from '../api/client';

export interface PropertyThumbnailProps {
  photoUrls: string[];
  alt: string;
  className?: string;
}

export function PropertyThumbnail({ photoUrls, alt, className }: PropertyThumbnailProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUrls || photoUrls.length === 0) return;
    
    let objectUrl: string | null = null;
    apiClient.get(photoUrls[currentIndex], { responseType: 'blob' })
      .then(response => {
        const blob = new Blob([response.data], { type: response.headers['content-type'] as string || 'image/jpeg' });
        objectUrl = window.URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(err => {
        console.error('Failed to load image', err);
        setSrc(null);
      });

    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrls, currentIndex]);

  useEffect(() => {
    if (!photoUrls || photoUrls.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev === photoUrls.length - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [photoUrls]);

  if (!photoUrls || photoUrls.length === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-muted/20 ${className}`}>
        <Building2 className="w-16 h-16 text-muted-foreground/20 group-hover:text-primary/20 transition-all duration-700 group-hover:scale-110" />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        {!src ? (
          <div key="loading" className="w-full h-full animate-pulse bg-muted/30 absolute inset-0"></div>
        ) : (
          <motion.img 
            key={src}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.6 }}
            src={src} 
            alt={alt} 
            className="w-full h-full object-cover" 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
