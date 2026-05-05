import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BrainCircuit, FileText, Activity } from 'lucide-react';
import { cn } from './ui/components';
import { AuthenticatedImage } from './AuthenticatedImage';

interface LivePipelineToastProps {
  activeDocs: {
    id: number;
    original_filename?: string;
    ai_stage?: string;
    file_type?: string;
  }[];
}

const STAGE_MAPPING: Record<string, { text: string; progress: number }> = {
  'ocr': { text: 'Agent 1: Extracting Raw Text (OCR)', progress: 10 },
  'ai_pipeline': { text: 'Agent Pipeline Initializing...', progress: 20 },
  'intake': { text: 'Agent 2: Classifying Document', progress: 30 },
  'extraction': { text: 'Agent 3: Extracting Financials', progress: 50 },
  'validation': { text: 'Agent 4: Validating Data Consistency', progress: 70 },
  'underwriting': { text: 'Agent 5: Underwriting Risk & Metrics', progress: 85 },
  'reporting': { text: 'Agent 6: Generating Executive Summary', progress: 95 },
};

export function LivePipelineToast({ activeDocs }: LivePipelineToastProps) {
  if (activeDocs.length === 0) return null;

  const isMultiple = activeDocs.length > 1;

  // Aggregate info
  const overallProgress = Math.round(
    activeDocs.reduce((acc, doc) => acc + (STAGE_MAPPING[doc.ai_stage || 'ocr']?.progress || 5), 0) / activeDocs.length
  );
  
  const currentStageText = isMultiple 
    ? `Verifying ${activeDocs.length} Documents`
    : STAGE_MAPPING[activeDocs[0].ai_stage || 'ocr']?.text || 'Processing Document...';

  const doc = activeDocs[0];
  const isImage = !isMultiple && ['jpg', 'jpeg', 'png', 'webp', 'tiff'].includes(doc.file_type?.toLowerCase() || '');

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <AnimatePresence>
        <motion.div
          key="pipeline-toast"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
          className="bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl w-96 overflow-hidden relative"
        >
          {/* Animated background pulse */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent opacity-50 animate-pulse" />
          
          <div className="relative z-10 flex gap-4">
            {/* Thumbnail / Icon Section */}
            <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center relative">
              {isMultiple ? (
                <div className="flex flex-col items-center justify-center text-zinc-500">
                  <Activity className="w-8 h-8 text-emerald-500" />
                  <span className="text-[10px] uppercase font-bold mt-1 text-emerald-500">{activeDocs.length} FILES</span>
                </div>
              ) : isImage ? (
                <AuthenticatedImage 
                  docId={doc.id} 
                  alt="Thumbnail" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-500">
                  <FileText className="w-8 h-8" />
                  <span className="text-[8px] uppercase font-bold mt-1">{doc.file_type || 'DOC'}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-1 right-1">
                <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-emerald-500/20 p-1 rounded">
                  <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-white truncate">
                  Live AI Pipeline
                </h4>
              </div>
              
              <p className="text-xs text-zinc-400 truncate mb-3">
                {isMultiple ? `Batch processing ${activeDocs.length} items` : (doc.original_filename || `Document #${doc.id}`)}
              </p>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-emerald-400 font-bold uppercase tracking-wider truncate mr-2">
                    {currentStageText}
                  </span>
                  <span className="text-zinc-500 font-mono shrink-0">{isMultiple ? `${overallProgress}% Avg` : `${overallProgress}%`}</span>
                </div>
                
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
