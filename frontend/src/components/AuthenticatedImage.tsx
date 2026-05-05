import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface AuthenticatedImageProps {
  docId: number;
  alt: string;
  className?: string;
}

export function AuthenticatedImage({ docId, alt, className }: AuthenticatedImageProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    apiClient.get(`/documents/${docId}/file`, { responseType: 'blob' })
      .then(response => {
        const contentType = response.headers['content-type'] as string || 'image/jpeg';
        // Only attempt to render if it's an image
        if (contentType.startsWith('image/')) {
          const blob = new Blob([response.data], { type: contentType });
          objectUrl = window.URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      })
      .catch(err => console.error('Failed to load image', err));

    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [docId]);

  if (!src) return <div className={`animate-pulse bg-muted/50 ${className}`}></div>;
  return <img src={src} alt={alt} className={className} />;
}
