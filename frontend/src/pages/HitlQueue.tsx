import { useState, useEffect } from 'react';
import { FileWarning, CheckCircle, XCircle, ArrowRight, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, Button } from '../components/ui/components';
import { apiClient } from '../api/client';
import { useSearch } from '../context/SearchContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Document {
  id: number;
  original_filename: string;
  upload_date: string;
  status: string;
  ocr_confidence: number;
  ocr_text?: string;
  file_path: string;
}

export default function HitlQueue() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
   const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [editedText, setEditedText] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const { searchQuery } = useSearch();

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchQueue(searchQuery);
    }, 400); // Debounce

    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchQueue = async (searchStr = '') => {
    try {
      setLoading(true);
      // Documents endpoint returns PaginatedResponse { items: [...] }
      const response = await apiClient.get(`/documents/?status=needs_review&search=${searchStr}`);
      const docs = response.data.items || [];
      setDocuments(docs);
      if (docs.length > 0) {
        handleSelect(docs[0]);
      } else {
        setSelectedDoc(null);
      }
    } catch (err) {
      console.error('Failed to fetch HITL queue', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (doc: Document) => {
    setSelectedDoc(doc);
    setEditedText(doc.ocr_text || 'Loading OCR constraints...');
    
    try {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
      
      const response = await apiClient.get(`/documents/${doc.id}/file`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: response.headers['content-type'] as string || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      
      setPreviewBlob(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Failed to load document preview', err);
      setPreviewUrl(null);
      setPreviewBlob(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedDoc) return;
    try {
      await apiClient.put(`/documents/${selectedDoc.id}/verify`, {
        corrected_text: editedText
      });
      // Trigger pipeline processing after validation
      await apiClient.post(`/agents/process/${selectedDoc.id}`);
      
      const newDocs = documents.filter(d => d.id !== selectedDoc.id);
      setDocuments(newDocs);
      if (newDocs.length > 0) {
        handleSelect(newDocs[0]);
      } else {
        setSelectedDoc(null);
        setEditedText('');
      }
    } catch (err) {
      console.error('Approval failed', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verification Queue</h1>
          <p className="text-muted-foreground mt-1 text-sm">Human-in-the-Loop review for low-confidence OCR extractions.</p>
        </div>
        <div className="flex gap-2 items-center bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-sm font-semibold border border-destructive/20">
          <FileWarning className="w-4 h-4" /> {documents.length} Pending
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Document Queue Sidebar */}
        <Card className="w-80 shrink-0 flex flex-col overflow-hidden bg-card/60 backdrop-blur-xl border-border/50">
          <CardHeader className="py-4 border-b border-border/50 bg-muted/10">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Pending Review
              <span className="text-xs text-muted-foreground font-normal">Confidence</span>
            </CardTitle>
          </CardHeader>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            <AnimatePresence>
              {documents.length === 0 && (
                 <div className="text-center p-6 text-muted-foreground text-sm">
                   <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-50" />
                   Queue is empty. Everything is processed.
                 </div>
              )}
              {documents.map(doc => (
                <motion.button
                  key={doc.id}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  onClick={() => handleSelect(doc)}
                  className={`w-full text-left p-3 rounded-xl text-sm transition-all flex flex-col gap-2 border ${
                    selectedDoc?.id === doc.id 
                      ? 'bg-primary/10 border-primary/30 shadow-sm shadow-primary/5' 
                      : 'bg-transparent hover:bg-accent/50 border-transparent'
                  }`}
                >
                  <div className="truncate font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    {doc.original_filename}
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">ID: {doc.id}</span>
                    <span className={`font-bold ${
                      doc.ocr_confidence < 50 ? 'text-destructive' : 'text-orange-500'
                    }`}>
                      {doc.ocr_confidence}%
                    </span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </Card>

        {/* Editing/Review Area */}
        {selectedDoc ? (
          <Card className="flex-1 flex flex-col overflow-hidden bg-card/60 backdrop-blur-xl border-border/50">
            <div className="h-16 border-b border-border/50 bg-muted/20 flex items-center justify-between px-6 shrink-0">
               <div className="font-semibold text-sm flex items-center gap-2 text-foreground">
                 Analyzing: <span className="text-primary tracking-wide">{selectedDoc.original_filename}</span>
               </div>
               <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" className="text-destructive font-medium hover:bg-destructive/10 hover:text-destructive">
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button size="sm" onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none font-bold shadow-lg shadow-emerald-600/20">
                    <CheckCircle className="w-4 h-4 mr-2" /> Approve & Parse <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
               </div>
            </div>
            
            <div className="flex-1 flex min-h-0">
               {/* Left side: Rendered Image (Simulation) */}
               <div className="flex-1 border-r border-border/50 p-6 bg-accent/10 flex flex-col overflow-y-auto">
                 <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-4">Original Document Render</div>
                 <div className="flex-1 bg-white/5 border border-border/50 rounded-2xl shadow-inner flex items-center justify-center relative overflow-hidden">
                   {previewUrl ? (
                     previewBlob?.type?.startsWith('image/') ? (
                       <img src={previewUrl} alt="Document" className="max-w-full max-h-full object-contain" />
                     ) : (
                       <iframe src={previewUrl} className="w-full h-full border-none bg-white" title="Document Preview" />
                     )
                   ) : (
                     <div className="text-center z-10">
                       <FileText className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4 animate-pulse" />
                       <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest">
                         Loading Preview...
                       </p>
                     </div>
                   )}
                 </div>
               </div>

               {/* Right side: OCR Correction */}
               <div className="flex-1 flex flex-col p-6 bg-background/30">
                 <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-4 flex justify-between">
                   <span>Extracted OCR Text</span>
                   <span className="text-primary">Verify key fields before AI structuring</span>
                 </div>
                 <textarea 
                   className="flex-1 w-full p-6 rounded-2xl border border-border/50 bg-card/50 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono text-[13px] leading-relaxed resize-none shadow-inner text-foreground transition-all"
                   value={editedText}
                   onChange={(e) => setEditedText(e.target.value)}
                   spellCheck={false}
                 />
               </div>
            </div>
          </Card>
        ) : (
          <div className="flex-1 border rounded-xl border-dashed flex flex-col items-center justify-center text-muted-foreground bg-accent/10">
            <CheckCircle className="w-12 h-12 text-primary/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground">You're all caught up!</h3>
            <p className="text-sm mt-1">No documents require manual human verification at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
