import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Skeleton, Modal } from '../components/ui/components';
import { apiClient } from '../api/client';
import { 
  Building2, MapPin, FileText, 
  Upload, CheckCircle2, AlertCircle, 
  Search, ExternalLink, Calculator,
  TrendingUp, Wallet, ArrowUpRight,
  Filter, LayoutGrid, List, Trash2, Loader2, MessageSquare, Send, X, Image,
  Folder, ChevronRight, ChevronLeft, Download, FileSpreadsheet,
  Edit3, Check, X as CloseIcon
} from 'lucide-react';
import { Dropzone } from '../components/ui/Dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const formatLabel = (str: string) => {
  if (!str) return '';
  if (str === 'Uncategorized') return 'Uncategorized';
  return str
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

function AuthenticatedImage({ docId, alt, className }: { docId: number, alt: string, className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    apiClient.get(`/documents/${docId}/file`, { responseType: 'blob' })
      .then(response => {
        const blob = new Blob([response.data], { type: response.headers['content-type'] as string || 'image/jpeg' });
        objectUrl = window.URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(err => console.error('Failed to load image', err));

    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [docId]);

  if (!src) return <div className={`animate-pulse bg-muted/50 ${className}`}></div>;
  return <img src={src} alt={alt} className={className} />;
}

export default function PropertyDetail() {
  const { id } = useParams();
  const [property, setProperty] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 9;
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDeal, setPreviewDeal] = useState<any>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [editableDealData, setEditableDealData] = useState<any>({});
  const [propertySummary, setPropertySummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [processingDocs, setProcessingDocs] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('Explorer');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [fileViewMode, setFileViewMode] = useState<'list' | 'grid'>('list');
  // Keep a ref always in sync so fetchData can restore the path after refresh
  const currentPathRef = useRef<string[]>([]);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);

  // Pro-Forma States
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [rentGrowth, setRentGrowth] = useState(3);
  const [vacancyRate, setVacancyRate] = useState(5);
  const [capexPerUnit, setCapexPerUnit] = useState(250);

  // Copilot States
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [apartments, setApartments] = useState<any[]>([]);
  const [apartmentsLoading, setApartmentsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Rename/Delete States
  const [renamingDocId, setRenamingDocId] = useState<number | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadChatHistory = async () => {
    try {
      const res = await apiClient.get(`/chat/history?property_id=${id}&page_size=10`);
      const history = res.data.messages.flatMap((m: any) => [
        { role: 'user', content: m.message },
        { role: 'assistant', content: m.response }
      ]);
      setChatMessages(history);
    } catch (err) {
      console.error('Failed to load chat history', err);
    }
  };

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setChatMessages([]); // Reset chat when switching properties
      try {
        // Fetch property first as it's critical
        const propRes = await apiClient.get(`/properties/${id}`);
        setProperty(propRes.data);
        
        // Fetch others in parallel but handle errors individually
        const [docsRes, dealsRes, apartmentsRes] = await Promise.allSettled([
          apiClient.get(`/documents/?property_id=${id}&page_size=1000`),
          apiClient.get(`/deals/?property_id=${id}`),
          apiClient.get(`/properties/${id}/apartments`)
        ]);
        
        if (docsRes.status === 'fulfilled') {
          setDocuments(docsRes.value.data.items);
          // totalPages will be handled client-side for Explorer
        } else {
          console.error('Failed to fetch documents', docsRes.reason);
        }
        
        if (dealsRes.status === 'fulfilled') {
          setDeals(dealsRes.value.data.items);
        } else {
          console.error('Failed to fetch deals', dealsRes.reason);
        }

        if (apartmentsRes.status === 'fulfilled') {
          setApartments(apartmentsRes.value.data);
        } else {
          console.error('Failed to fetch apartments', apartmentsRes.reason);
        }
      } catch (err) {
        console.error('Failed to fetch property details', err);
        setError('Property not found or server error');
      } finally {
        setLoading(false);
        // ── Restore the current folder path after refresh ──
        // This prevents the folder structure from resetting to root when
        // new documents are uploaded or the pipeline completes.
        setCurrentPath(currentPathRef.current);
      }
    };

  useEffect(() => {
    fetchData();
    
    // WebSocket connection for real-time pipeline updates
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    const wsBase = API_BASE.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/agents/ws/pipeline/${id}`;
    
    console.log("Connecting to WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("WebSocket connected successfully");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    
    ws.onclose = () => {
      console.log("WebSocket connection closed. Reconnecting in 5s...");
      setTimeout(() => {
        // This will trigger the effect again if we used a ref for the socket
        // but for now, we'll just let the next navigation or refresh handle it
        // OR we can just reload the page if it's critical.
      }, 5000);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Pipeline status update received:", data);
        
        // Optimistic UI update
        setDocuments(prevDocs => 
          prevDocs.map(doc => 
            doc.id === data.document_id 
              ? { ...doc, status: data.status, ai_stage: data.stage } 
              : doc
          )
        );
        
        // Clear processing state if complete, failed, or needs review
        if (data.status === 'verified' || data.status === 'failed' || data.status === 'needs_review') {
          setProcessingDocs(prev => {
            const next = { ...prev };
            delete next[data.document_id];
            return next;
          });
          
          if (data.status === 'failed' && data.error) {
            console.error(`Pipeline failure for doc ${data.document_id}: ${data.error}`);
            // We could show a global error toast here
          }

          // Refresh the data to get the new deal or review status
          fetchData();
        }
      } catch (e) {
        console.error("Error parsing WebSocket message", e);
      }
    };
    
    return () => {
      ws.close();
    };
  }, [id]); // No longer depends on currentPage as it's client-side

  useEffect(() => {
    if (isCopilotOpen && id) {
      loadChatHistory();
    }
  }, [isCopilotOpen, id]);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        apiClient.get(`/documents/?property_id=${id}&search=${encodeURIComponent(searchQuery.trim())}&page_size=100`)
          .then(res => {
            setSearchResults(res.data.items);
          })
          .catch(err => console.error('Search failed:', err))
          .finally(() => setIsSearching(false));
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery, id]);

  useEffect(() => {
    return () => {
      if (selectedFileUrl) window.URL.revokeObjectURL(selectedFileUrl);
    };
  }, [selectedFileUrl]);

  const handleUploadComplete = () => {
    fetchData();
  };

  const handleViewDocument = async (doc: any, reviewMode: boolean = false) => {
    setPreviewDoc(doc);
    setIsReviewMode(reviewMode);
    
    const associatedDeal = deals.find(d => d.document_id === doc.id);
    setPreviewDeal(associatedDeal || null);
    
    if (reviewMode) {
      if (associatedDeal) {
        setEditableDealData({
          gross_revenue: associatedDeal.gross_revenue || '',
          operating_expenses: associatedDeal.operating_expenses || '',
          noi: associatedDeal.noi || '',
          cap_rate: associatedDeal.cap_rate || ''
        });
      } else if (doc.extracted_data) {
        setEditableDealData({
          gross_revenue: doc.extracted_data.gross_revenue || '',
          operating_expenses: doc.extracted_data.operating_expenses || '',
          noi: doc.extracted_data.noi || '',
          cap_rate: doc.extracted_data.cap_rate || ''
        });
      } else {
        setEditableDealData({ gross_revenue: '', operating_expenses: '', noi: '', cap_rate: '' });
      }
    }

    setIsPreviewOpen(true);
    setPreviewLoading(true);
    try {
      if (selectedFileUrl) window.URL.revokeObjectURL(selectedFileUrl);
      
      const response = await apiClient.get(`/documents/${doc.id}/file`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] as string || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      setSelectedFileUrl(url);
    } catch (err) {
      console.error('Failed to load document preview', err);
      setSelectedFileUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    console.log(`[DELETE] Attempting to delete document: ${docId}`);
    setIsActionLoading(true);
    try {
      await apiClient.delete(`/documents/${docId}`);
      console.log(`[DELETE] Successfully deleted document: ${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      setDeletingId(null);
    } catch (err) {
      console.error('[DELETE] Failed to delete document', err);
      alert('Failed to delete document');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRenameFile = async (docId: number) => {
    if (!renameValue.trim()) return;
    setIsRenaming(true);
    try {
      await apiClient.patch(`/documents/${docId}`, { original_filename: renameValue.trim() });
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, original_filename: renameValue.trim() } : d));
      setRenamingDocId(null);
      setRenameValue('');
    } catch (err) {
      console.error('Failed to rename file', err);
      alert('Failed to rename file');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRenameFolder = async (oldName: string) => {
    if (!renameValue.trim()) return;
    setIsRenaming(true);
    const oldPath = [...currentPath, oldName].join('/');
    const newPath = [...currentPath, renameValue.trim()].join('/');
    
    console.log(`[RENAME] Folder from "${oldPath}" to "${newPath}"`, {
      property_id: Number(id),
      old_path: oldPath,
      new_path: newPath
    });
    
    try {
      await apiClient.post('/documents/folders/rename', {
        property_id: Number(id),
        old_path: oldPath,
        new_path: newPath
      });
      
      // Update all documents that were in or under this folder
      setDocuments(prev => prev.map(doc => {
        const partsOld = oldPath.split('/');
        const catOld = partsOld[0];
        const subcatOld = partsOld[1];
        const partsNew = newPath.split('/');
        const catNew = partsNew[0];
        const subcatNew = partsNew[1];

        if (doc.relative_path) {
          const docPath = doc.relative_path;
          if (docPath === oldPath) {
            return { ...doc, relative_path: newPath };
          }
          if (docPath.startsWith(oldPath + '/')) {
            return { ...doc, relative_path: docPath.replace(oldPath + '/', newPath + '/') };
          }
        } else {
          // Virtual folder match
          if (partsOld.length === 1 && doc.category === catOld) {
            return { ...doc, category: catNew };
          }
          if (partsOld.length === 2 && doc.category === catOld && doc.subcategory === subcatOld) {
            return { ...doc, category: catNew, subcategory: subcatNew };
          }
        }
        return doc;
      }));
      
      setRenamingFolder(null);
      setRenameValue('');
    } catch (err) {
      console.error('Failed to rename folder', err);
      alert('Failed to rename folder');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    const fullPath = [...currentPath, folderName].join('/');
    console.log(`[DELETE] Attempting to delete folder: ${fullPath}`);
    setIsActionLoading(true);
    try {
      await apiClient.post('/documents/folders/delete', {
        property_id: Number(id),
        path: fullPath
      });
      console.log(`[DELETE] Successfully deleted folder: ${fullPath}`);
      
      // Remove all documents that were in or under this folder
      setDocuments(prev => prev.filter(doc => {
        const parts = fullPath.split('/');
        const cat = parts[0];
        const subcat = parts[1];

        if (doc.relative_path) {
          const docPath = doc.relative_path;
          return docPath !== fullPath && !docPath.startsWith(fullPath + '/');
        } else {
          // Virtual folder check
          if (parts.length === 1 && doc.category === cat) return false;
          if (parts.length === 2 && doc.category === cat && doc.subcategory === subcat) return false;
        }
        return true;
      }));
      setDeletingId(null);
    } catch (err) {
      console.error('[DELETE] Failed to delete folder', err);
      alert('Failed to delete folder');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVerifyOverride = async () => {
    if (!previewDoc) return;
    try {
      await apiClient.put(`/documents/${previewDoc.id}/approve`);
      setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, status: 'verified' } : d));
      setIsPreviewOpen(false);
      fetchData(); // Refresh everything
    } catch (err) {
      console.error('Failed to override', err);
      alert('Failed to save manual overrides.');
    }
  };

  const handleRunPipeline = async (docId: number) => {
    setProcessingDocs(prev => ({ ...prev, [docId]: true }));
    try {
      await apiClient.post(`/agents/process/${docId}`);
      // Polling is removed; we rely on WebSockets now for state updates.
    } catch (err) {
      console.error('Failed to start pipeline', err);
      alert('Failed to start AI pipeline');
      setProcessingDocs(prev => ({ ...prev, [docId]: false }));
    }
  };

  const handleFetchSummary = async () => {
    setIsSummaryOpen(true);
    setSummaryLoading(true);
    try {
      const response = await apiClient.get(`/properties/${id}/summary`);
      setPropertySummary(response.data);
    } catch (err) {
      console.error('Failed to fetch summary', err);
      setError('Failed to fetch property summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await apiClient.post('/chat/', {
        message: userMsg,
        property_id: Number(id),
        history: chatMessages
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExportZip = async () => {
    if (!id) return;
    setIsExporting(true);
    try {
      const response = await apiClient.get(`/properties/${id}/export-zip`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use property name from Content-Disposition if available, otherwise fallback
      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : `${property?.name || 'Property'}_Documents.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to export documents. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };



  const latestDeal = deals.length > 0 ? deals[0] : null;

  const institutionalStats = [
    { 
      label: 'Market Cap Rate', 
      value: latestDeal?.cap_rate ? `${latestDeal.cap_rate}%` : 'N/A', 
      icon: TrendingUp, 
      color: 'text-primary' 
    },
    { 
      label: 'Projected NOI', 
      value: latestDeal?.noi ? `$${latestDeal.noi.toLocaleString()}` : 'N/A', 
      icon: Calculator, 
      color: 'text-green-500' 
    },
    { 
      label: 'Asset Value', 
      value: latestDeal?.purchase_price ? `$${(latestDeal.purchase_price / 1000000).toFixed(1)}M` : 'N/A', 
      icon: Wallet, 
      color: 'text-blue-500' 
    },
    { 
      label: 'Unit Count', 
      value: property?.unit_count || 0, 
      icon: Building2, 
      color: 'text-orange-500' 
    }
  ];

  const nonPhotoDocs = documents.filter(doc => !(doc.category === 'photo' || ['jpg', 'jpeg', 'png', 'tiff'].includes(doc.file_type?.toLowerCase() || '')));
  

  const getExplorerItems = () => {
    if (activeTab !== 'Explorer') return { folders: [], files: [] };
    
    if (searchQuery.trim().length > 1) {
      return {
        folders: [],
        files: searchResults.filter(doc => !(doc.category === 'photo' || ['jpg', 'jpeg', 'png', 'tiff'].includes(doc.file_type?.toLowerCase() || '')))
      };
    }

    // Filter documents by the current path
    const filteredDocs = nonPhotoDocs.filter(doc => {
      const docPath = doc.relative_path 
        ? doc.relative_path.split('/').filter(Boolean) 
        : [doc.category, doc.subcategory].filter(Boolean);
      
      if (currentPath.length > docPath.length) return false;
      for (let i = 0; i < currentPath.length; i++) {
        // Case-insensitive comparison for robustness
        if (currentPath[i].toLowerCase() !== docPath[i].toLowerCase()) return false;
      }
      return true;
    });

    const folders = new Set<string>();
    const files: any[] = [];

    filteredDocs.forEach(doc => {
      // For relative_path, the parts include the filename at the end.
      // For category/subcategory, they are just folder names.
      const docPath = doc.relative_path 
        ? doc.relative_path.split('/').filter(Boolean) 
        : [doc.category, doc.subcategory].filter(Boolean);
      
      const isDeep = doc.relative_path 
        ? docPath.length > currentPath.length + 1 // If there's at least one more folder before the filename
        : docPath.length > currentPath.length;    // For category/subcategory, anything deeper is a folder
      
      if (isDeep) {
        folders.add(docPath[currentPath.length]);
      } else if (doc.relative_path && docPath.length === currentPath.length + 1) {
        // It's a file at this level (the last part is the filename)
        files.push(doc);
      } else if (!doc.relative_path && docPath.length === currentPath.length) {
        // It's a file at this level (no more subfolders/subcategories)
        files.push(doc);
      }
    });

    return {
      folders: Array.from(folders).sort(),
      files
    };
  };

  const { folders: currentFolders, files: currentFiles } = getExplorerItems();

  // Client-side pagination logic for Explorer
  const combinedExplorerItems = [...currentFolders.map(f => ({ isFolder: true, name: f })), ...currentFiles.map(f => ({ ...f, isFolder: false }))];
  const explorerTotalPages = Math.ceil(combinedExplorerItems.length / pageSize) || 1;
  const explorerPageItems = combinedExplorerItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  
  const displayedFolders = explorerPageItems.filter(i => i.isFolder).map(i => i.name);
  const displayedFiles = explorerPageItems.filter(i => !i.isFolder);

  const photoDocuments = documents.filter(doc => 
    doc.category === 'photo' || ['jpg', 'jpeg', 'png', 'tiff'].includes(doc.file_type?.toLowerCase() || '')
  );

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="lg:col-span-2 h-[600px] rounded-2xl" />
          <Skeleton className="h-[600px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="p-6 bg-destructive/10 rounded-full">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Property Not Found</h2>
        <p className="text-muted-foreground">The asset you're looking for doesn't exist or you don't have access.</p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1800px] mx-auto pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold tracking-tight">{property.name}</h1>
            <Badge variant="success" className="h-6 px-3">Active</Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-lg">
            <MapPin className="w-5 h-5 text-primary" />
            {property.address}, {property.city}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-11 px-5 border-border/50 font-bold hover:bg-muted/50 active:scale-95 transition-all" onClick={() => window.history.back()}>
            Back to Portfolio
          </Button>
          <Button variant="outline" className="h-11 px-5 border-border/50 font-bold hover:bg-muted/50 active:scale-95 transition-all" onClick={handleFetchSummary}>
            <LayoutGrid className="w-4 h-4 mr-2" /> Overview
          </Button>
          <Button
            variant="outline"
            className="h-11 px-5 border-border/50 font-bold hover:bg-muted/50 hover:text-primary active:scale-95 transition-all"
            onClick={handleExportZip}
            disabled={isExporting}
            title="Download all documents as ZIP"
          >
            {isExporting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting...</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Export ZIP</>
            )}
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {institutionalStats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-border/40 bg-card/40 backdrop-blur-md hover:border-primary/50 hover:-translate-y-1 hover:shadow-xl shadow-primary/5 transition-all duration-300 overflow-hidden group cursor-default">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-xl bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <div className="text-3xl font-black mt-1 tracking-tight">{stat.value}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-2xl bg-card/40 backdrop-blur-xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/10 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-bold">Data Room Explorer</CardTitle>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-border/50">
                  <Button 
                    variant={fileViewMode === 'grid' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="h-7 w-7 p-0"
                    onClick={() => setFileViewMode('grid')}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant={fileViewMode === 'list' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="h-7 w-7 p-0"
                    onClick={() => setFileViewMode('list')}
                  >
                    <List className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="relative">
                  {isSearching ? (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary animate-spin" />
                  ) : (
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <input 
                    placeholder="Search docs or contents..." 
                    className="bg-muted/50 border border-border/50 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 w-64" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <div className="border-b border-border/50 bg-muted/5 px-8 flex overflow-x-auto no-scrollbar gap-2 pt-2">
              {['Explorer', 'Rent Roll'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); if (tab === 'Explorer') { setCurrentPath([]); setCurrentPage(1); } }}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {activeTab === 'Explorer' && !searchQuery && (
              <div className="flex items-center gap-3 px-8 py-4 bg-muted/10 border-b border-border/50 text-sm font-bold overflow-x-auto no-scrollbar shadow-inner">
                <button 
                  onClick={() => { setCurrentPath([]); setCurrentPage(1); }} 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                    currentPath.length === 0 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Folder className={`w-4 h-4 ${currentPath.length === 0 ? 'text-primary' : 'text-muted-foreground'}`} /> 
                  Root
                </button>
                {currentPath.map((folder, idx) => (
                  <React.Fragment key={`${folder}-${idx}`}>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    <button 
                      onClick={() => { setCurrentPath(currentPath.slice(0, idx + 1)); setCurrentPage(1); }}
                      className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                        idx === currentPath.length - 1
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {formatLabel(folder)}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
            <CardContent className="p-0">
              <AnimatePresence mode="wait">
                {activeTab === 'Rent Roll' ? (
                  <motion.div 
                    key="rent-roll"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="overflow-x-auto p-4"
                  >
                    <table className="w-full text-sm text-left border-collapse relative">
                      <thead className="bg-muted/40 text-[10px] uppercase tracking-widest font-black text-muted-foreground sticky top-0 backdrop-blur-md z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3">Tenant</th>
                          <th className="px-4 py-3">Start Date</th>
                          <th className="px-4 py-3">End Date</th>
                          <th className="px-4 py-3 text-right">Rent ($)</th>
                          <th className="px-4 py-3 text-right">Market Rent ($)</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {apartments.length > 0 ? (
                          apartments.map((row) => {
                            const marketRent = row.monthly_rent ? row.monthly_rent * 1.1 : 0; // Derived market rent (mocked for now)
                            const isBelowMarket = row.monthly_rent < marketRent && row.monthly_rent > 0;
                            return (
                              <tr key={row.id} className="even:bg-muted/20 hover:bg-primary/10 transition-colors border-l-2 border-transparent hover:border-primary">
                                <td className="px-4 py-3 font-bold">{row.unit_number}</td>
                                <td className="px-4 py-3 text-muted-foreground">{row.tenant_name || 'Vacant'}</td>
                                <td className="px-4 py-3 text-muted-foreground">{row.lease_start ? new Date(row.lease_start).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-3 font-bold">{row.lease_end ? new Date(row.lease_end).toLocaleDateString() : '-'}</td>
                                <td className={`px-4 py-3 text-right font-bold tabular-nums font-mono ${isBelowMarket ? 'text-orange-500' : ''}`}>
                                  ${row.monthly_rent?.toLocaleString() || '0'}
                                </td>
                                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums font-mono">
                                  ${marketRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {row.monthly_rent === 0 || !row.monthly_rent ? (
                                    <Badge variant="destructive" className="text-[10px] uppercase">Vacant</Badge>
                                  ) : isBelowMarket ? (
                                    <Badge variant="warning" className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px] uppercase">Below Market</Badge>
                                  ) : (
                                    <Badge variant="success" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] uppercase">Stable</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground font-semibold">
                              No apartment data available. Process lease documents to populate this table.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </motion.div>
                ) : fileViewMode === 'list' ? (
                  <motion.div 
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="overflow-x-auto"
                  >
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-muted/20 text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                        <tr>
                          <th className="px-8 py-4">Filename</th>
                          <th className="px-8 py-4">AI Extraction</th>
                          <th className="px-8 py-4">Confidence</th>
                          <th className="px-8 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {displayedFolders.length > 0 || displayedFiles.length > 0 ? (
                          <>
                            {displayedFolders.map((folder) => (
                              <tr key={folder} className="hover:bg-primary/10 transition-colors group cursor-pointer border-l-2 border-transparent hover:border-primary" onClick={() => { if (!renamingFolder) { setCurrentPath([...currentPath, folder]); setCurrentPage(1); } }}>
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                      <Folder className="w-5 h-5 text-primary" />
                                    </div>
                                    {renamingFolder === folder ? (
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          className="bg-background border border-primary/50 rounded px-2 py-1 text-sm font-bold w-48 focus:outline-none ring-1 ring-primary/20"
                                          value={renameValue}
                                          onChange={(e) => setRenameValue(e.target.value)}
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameFolder(folder);
                                            if (e.key === 'Escape') setRenamingFolder(null);
                                          }}
                                        />
                                        <Button size="sm" className="h-8 w-8 p-0" onClick={() => handleRenameFolder(folder)} disabled={isRenaming}>
                                          {isRenaming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setRenamingFolder(null)}>
                                          <CloseIcon className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="font-bold text-foreground">{formatLabel(folder)}</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-2 text-muted-foreground italic text-[10px] font-medium uppercase tracking-tight">
                                    <Folder className="w-3 h-3" />
                                    <span>Sub-Folder Set</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground border-border/50">Structure</Badge>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {deletingId === folder ? (
                                      <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1" onClick={(e) => e.stopPropagation()}>
                                        <Button 
                                          variant="destructive" 
                                          size="sm" 
                                          className="h-7 px-2 text-[10px] font-black uppercase"
                                          disabled={isActionLoading}
                                          onClick={() => handleDeleteFolder(folder)}
                                        >
                                          {isActionLoading ? "..." : "Delete"}
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-7 px-2 text-[10px] font-black uppercase"
                                          onClick={() => setDeletingId(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        {!renamingFolder && (
                                          <>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setRenamingFolder(folder);
                                                setRenameValue(folder);
                                              }}
                                            >
                                              <Edit3 className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeletingId(folder);
                                              }}
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {displayedFiles.length === 0 && displayedFolders.length === 0 && searchQuery && !isSearching && (
                              <tr>
                                <td colSpan={4} className="px-8 py-12 text-center text-muted-foreground">
                                  No documents found matching "{searchQuery}". Try a different keyword.
                                </td>
                              </tr>
                            )}
                            {displayedFiles.map((doc) => (
                              <tr key={doc.id} className="hover:bg-primary/10 transition-colors group cursor-pointer border-l-2 border-transparent hover:border-primary">
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors"
                                      onClick={() => handleViewDocument(doc)}
                                    >
                                      {['xlsx','xls','csv'].includes(doc.file_type?.toLowerCase() || '') ? (
                                        <FileSpreadsheet className="w-5 h-5 text-green-500 group-hover:text-green-400 transition-colors" />
                                      ) : (
                                        <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                      )}
                                    </div>
                                    <div>
                                      {renamingDocId === doc.id ? (
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            className="bg-background border border-primary/50 rounded px-2 py-1 text-sm font-bold w-48 focus:outline-none ring-1 ring-primary/20"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleRenameFile(doc.id);
                                              if (e.key === 'Escape') setRenamingDocId(null);
                                            }}
                                          />
                                          <Button size="sm" className="h-8 w-8 p-0" onClick={() => handleRenameFile(doc.id)} disabled={isRenaming}>
                                            {isRenaming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setRenamingDocId(null)}>
                                            <CloseIcon className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="font-bold text-foreground">{doc.original_filename}</div>
                                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                                            {formatLabel(doc.category) || 'Root'} • {Math.round(doc.file_size / 1024)} KB
                                          </div>
                                        </>
                                      )}
                                      {doc.status === 'failed' && doc.error_message && (
                                        <div className="text-[10px] text-destructive font-medium mt-1 max-w-[200px] truncate" title={doc.error_message}>
                                          Error: {doc.error_message}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                   <div className="flex items-center gap-2">
                                     <CheckCircle2 className="w-4 h-4 text-green-500" />
                                     <span className="font-bold text-xs uppercase tracking-tight">Structured Deal</span>
                                   </div>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex flex-col gap-1.5 w-24">
                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                      <span>Match</span>
                                      <span>{Math.round(doc.ocr_confidence)}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-green-500" 
                                        style={{ width: `${doc.ocr_confidence}%` }} 
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {!renamingDocId && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRenamingDocId(doc.id);
                                          setRenameValue(doc.original_filename);
                                        }}
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button 
                                      variant={doc.status === 'needs_review' ? 'destructive' : 'outline'} 
                                      size="sm" 
                                      className="h-8 border-border/50 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95 disabled:opacity-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (doc.status === 'needs_review') {
                                          handleViewDocument(doc, true);
                                        } else {
                                          handleRunPipeline(doc.id);
                                        }
                                      }}
                                      disabled={processingDocs[doc.id] || doc.status === 'processing'}
                                    >
                                      {processingDocs[doc.id] || doc.status === 'processing' ? (
                                        <>Processing <Loader2 className="w-3 h-3 ml-1.5 animate-spin" /></>
                                      ) : doc.status === 'needs_review' ? (
                                        <>Review <AlertCircle className="w-3 h-3 ml-1.5" /></>
                                      ) : doc.status === 'failed' ? (
                                        <>Failed (Retry) <AlertCircle className="w-3 h-3 ml-1.5" /></>
                                      ) : doc.status === 'verified' ? (
                                        <>Verified <CheckCircle2 className="w-3 h-3 ml-1.5" /></>
                                      ) : (
                                        <>Verify <ExternalLink className="w-3 h-3 ml-1.5" /></>
                                      )}
                                    </Button>
                                    {deletingId === doc.id ? (
                                      <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1" onClick={(e) => e.stopPropagation()}>
                                        <Button 
                                          variant="destructive" 
                                          size="sm" 
                                          className="h-8 px-3 text-[10px] font-black uppercase"
                                          disabled={isActionLoading}
                                          onClick={() => handleDeleteDocument(doc.id)}
                                        >
                                          {isActionLoading ? "..." : "Delete"}
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 px-3 text-[10px] font-black uppercase"
                                          onClick={() => setDeletingId(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-8 w-8 border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all active:scale-95 opacity-0 group-hover:opacity-100"
                                        onClick={(e) => { e.stopPropagation(); setDeletingId(doc.id); }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </>
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-8 py-20 text-center text-muted-foreground font-semibold">
                              No documents match your filter criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
                  >
                    {displayedFolders.length > 0 || displayedFiles.length > 0 ? (
                      <>
                        {displayedFolders.map(folder => (
                          <Card key={folder} className="bg-muted/20 border-border/50 hover:border-primary/40 transition-all group relative overflow-hidden cursor-pointer" onClick={() => { setCurrentPath([...currentPath, folder]); setCurrentPage(1); }}>
                            <CardContent className="p-6">
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                                <Folder className="w-6 h-6 text-primary" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="font-bold text-sm truncate pr-8">{formatLabel(folder)}</h4>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">Directory</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {displayedFiles.map((doc) => (
                          <Card key={doc.id} className="bg-muted/20 border-border/50 hover:border-primary/40 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3">
                              <Badge variant="success" className="text-[8px] px-1.5 h-4">Verified</Badge>
                            </div>
                            <CardContent className="p-6">
                              <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                                <FileText className="w-6 h-6 text-primary" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="font-bold text-sm truncate pr-8">{doc.original_filename}</h4>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">{formatLabel(doc.category) || 'Root'}</p>
                              </div>
                              <div className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center">
                                <div className="text-[10px] font-bold text-muted-foreground">{Math.round(doc.file_size / 1024)} KB</div>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-[10px] font-black uppercase tracking-widest hover:text-primary p-0 active:scale-95 transition-transform"
                                    onClick={() => handleViewDocument(doc, doc.status === 'needs_review')}
                                  >
                                    View <ExternalLink className="w-3 h-3 ml-1" />
                                  </Button>
                                    {deletingId === doc.id ? (
                                      <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1">
                                        <Button 
                                          variant="destructive" 
                                          size="sm" 
                                          className="h-7 px-2 text-[10px] font-black uppercase"
                                          disabled={isActionLoading}
                                          onClick={() => handleDeleteDocument(doc.id)}
                                        >
                                          {isActionLoading ? "..." : "Delete"}
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-7 px-2 text-[10px] font-black uppercase"
                                          onClick={() => setDeletingId(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 text-[10px] font-black uppercase tracking-widest hover:text-destructive p-0"
                                        onClick={() => setDeletingId(doc.id)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    ) : (
                      <div className="col-span-full py-12 text-center text-muted-foreground font-semibold">
                        No documents match your filter criteria.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {activeTab === 'Explorer' && explorerTotalPages > 1 && (
                <div className="px-8 py-4 border-t border-border/50 flex items-center justify-between bg-muted/5">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Showing page <span className="text-primary">{currentPage}</span> of <span className="text-primary">{explorerTotalPages}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0 border-border/50 hover:bg-primary/10 transition-colors"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: explorerTotalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        // Only show first 3, last 1, and current if it's in the middle
                        const shouldShow = pageNum === 1 || pageNum === explorerTotalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);
                        
                        if (!shouldShow) {
                          if (pageNum === 2 || pageNum === explorerTotalPages - 1) {
                            return <span key={i} className="text-muted-foreground text-[10px] px-1">...</span>;
                          }
                          return null;
                        }

                        return (
                          <Button
                            key={i}
                            variant={currentPage === pageNum ? "default" : "ghost"}
                            size="sm"
                            className="h-8 w-8 p-0 text-[10px] font-black"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0 border-border/50 hover:bg-primary/10 transition-colors"
                      onClick={() => setCurrentPage(prev => Math.min(explorerTotalPages, prev + 1))}
                      disabled={currentPage === explorerTotalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-card/40 backdrop-blur-xl overflow-hidden mt-8">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/10 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Image className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-bold">Property Gallery</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="mb-8">
                <Dropzone propertyId={id!} category="photo" onUploadComplete={handleUploadComplete} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {photoDocuments.length > 0 ? (
                  photoDocuments.map((doc) => (
                    <div key={doc.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                      <AuthenticatedImage 
                        docId={doc.id} 
                        alt={doc.original_filename} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <p className="text-white text-xs font-bold truncate">{doc.original_filename}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-7 text-[10px] w-full active:scale-95 transition-transform"
                            onClick={() => handleViewDocument(doc)}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="h-7 w-7 p-0 active:scale-95 transition-transform"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center text-muted-foreground font-semibold bg-muted/10 rounded-xl border border-dashed border-border/50">
                    No photos uploaded yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-2xl bg-gradient-to-br from-primary/5 to-card/50 backdrop-blur-xl">
            <CardHeader className="px-6 py-5 border-b border-border/50">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" /> Asset Intake
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Dropzone propertyId={id!} onUploadComplete={handleUploadComplete} />
              <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-2">Institutional Tip</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload combined rent rolls or individual leases. Our AI will automatically split and categorize them.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl bg-card/40 backdrop-blur-xl overflow-hidden">
            <CardHeader className="px-6 py-5 border-b border-border/50 bg-muted/10">
              <CardTitle className="text-lg font-bold">Extraction Health</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {[
                { 
                  label: 'Financial Verification', 
                  status: documents.some(d => d.category === 'financial' && d.status === 'verified') ? 'verified' : 'pending',
                  count: documents.filter(d => d.category === 'financial').length 
                },
                { 
                  label: 'Lease Abstracts', 
                  status: documents.some(d => d.category === 'lease' && d.status === 'verified') ? 'verified' : 'pending',
                  count: documents.filter(d => d.category === 'lease').length 
                },
                { 
                  label: 'Technical DD', 
                  status: documents.some(d => d.category === 'due_diligence' && d.status === 'verified') ? 'verified' : 'pending',
                  count: documents.filter(d => d.category === 'due_diligence').length 
                }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black">{item.count} items processed</span>
                  </div>
                  <Badge 
                    variant={item.status === 'verified' ? 'success' : item.status === 'warning' ? 'destructive' : 'secondary'} 
                    className="text-[10px] font-bold"
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        title={previewDoc?.original_filename || 'Document Preview'}
        size={(previewDeal || isReviewMode) ? "full" : "xl"}
      >
        <div className={`grid gap-6 h-[70vh] ${(previewDeal || isReviewMode) ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          <div className="w-full h-full bg-background rounded-xl border flex items-center justify-center overflow-hidden">
            {previewLoading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading Institutional Data...</p>
              </div>
            ) : ['xlsx','xls','csv'].includes(previewDoc?.file_type?.toLowerCase() || '') ? (
              // Excel/CSV: browser cannot render these in an iframe — offer download instead
              <div className="text-center p-8 space-y-4">
                <div className="w-20 h-20 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-10 h-10 text-green-500" />
                </div>
                <div>
                  <p className="font-bold text-lg">{previewDoc?.original_filename}</p>
                  <p className="text-sm text-muted-foreground mt-1">Spreadsheet files cannot be previewed inline.</p>
                  <p className="text-xs text-muted-foreground">The file has been ingested and indexed for AI analysis.</p>
                </div>
                <Button
                  onClick={() => window.open(`/api/documents/${previewDoc?.id}/file`, '_blank')}
                  className="mt-4"
                >
                  <Download className="w-4 h-4 mr-2" /> Download File
                </Button>
              </div>
            ) : selectedFileUrl ? (
              <iframe 
                src={selectedFileUrl} 
                className="w-full h-full border-none" 
                title="Document Preview" 
              />
            ) : (
              <div className="text-center p-8">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <p className="font-bold">Failed to load preview</p>
                <p className="text-sm text-muted-foreground mt-1">Please try downloading the file instead.</p>
              </div>
            )}
          </div>

          {(previewDeal || isReviewMode) && (
            <div className="w-full h-full overflow-y-auto pr-2 flex flex-col gap-6">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-1 text-foreground">
                  {isReviewMode ? 'Human-In-The-Loop Review' : 'AI Extracted Deal Metrics'}
                </h3>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                  {isReviewMode ? 'Validate and override AI extractions below.' : 'Structured data from document analysis.'}
                </p>
              </div>

              {isReviewMode ? (
                <div className="space-y-4 flex-1">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">Gross Revenue ($)</label>
                      <input 
                        type="number" 
                        value={editableDealData.gross_revenue || ''} 
                        onChange={e => setEditableDealData({...editableDealData, gross_revenue: e.target.value})}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">Operating Expenses ($)</label>
                      <input 
                        type="number" 
                        value={editableDealData.operating_expenses || ''} 
                        onChange={e => setEditableDealData({...editableDealData, operating_expenses: e.target.value})}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">NOI ($)</label>
                      <input 
                        type="number" 
                        value={editableDealData.noi || ''} 
                        onChange={e => setEditableDealData({...editableDealData, noi: e.target.value})}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground">Cap Rate (%)</label>
                      <input 
                        type="number" 
                        value={editableDealData.cap_rate || ''} 
                        onChange={e => setEditableDealData({...editableDealData, cap_rate: e.target.value})}
                        className="w-full bg-muted/30 border border-border/50 rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">NOI</div>
                    <div className="text-lg font-bold">${previewDeal?.noi?.toLocaleString() || 'N/A'}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">Cap Rate</div>
                    <div className="text-lg font-bold">{previewDeal?.cap_rate ? `${previewDeal.cap_rate}%` : 'N/A'}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">Gross Revenue</div>
                    <div className="text-lg font-bold">${previewDeal?.gross_revenue?.toLocaleString() || 'N/A'}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">Opex</div>
                    <div className="text-lg font-bold">${previewDeal?.operating_expenses?.toLocaleString() || 'N/A'}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border/50">
          <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
          <Button variant="outline" onClick={() => window.open(selectedFileUrl!, '_blank')}>
            Open in New Tab
          </Button>
          {isReviewMode && (
            <Button onClick={handleVerifyOverride} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest text-[10px]">
              Save & Verify
            </Button>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        title={`Institutional Overview: ${property.name}`}
        size="full"
      >
        <div className="space-y-6">
          {summaryLoading ? (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Synthesizing Property Intelligence...</p>
            </div>
          ) : propertySummary ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Assumption Controls */}
              <div className="lg:col-span-1 p-6 rounded-2xl bg-muted/20 border border-border/50 space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> Live Pro-Forma Modeling
                </h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <label className="text-muted-foreground uppercase tracking-widest">Rent Growth</label>
                      <span className="text-primary">{rentGrowth}%</span>
                    </div>
                    <input type="range" min="0" max="10" value={rentGrowth} onChange={e => setRentGrowth(Number(e.target.value))} className="w-full accent-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <label className="text-muted-foreground uppercase tracking-widest">Vacancy Rate</label>
                      <span className="text-primary">{vacancyRate}%</span>
                    </div>
                    <input type="range" min="0" max="20" value={vacancyRate} onChange={e => setVacancyRate(Number(e.target.value))} className="w-full accent-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <label className="text-muted-foreground uppercase tracking-widest">CapEx / Unit</label>
                      <span className="text-primary">${capexPerUnit}</span>
                    </div>
                    <input type="range" min="0" max="2000" step="50" value={capexPerUnit} onChange={e => setCapexPerUnit(Number(e.target.value))} className="w-full accent-primary" />
                  </div>
                </div>
                <div className="pt-6 border-t border-border/50">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> AI Overview
                  </h4>
                  <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap line-clamp-6 hover:line-clamp-none transition-all">
                    {propertySummary.combined_summary}
                  </p>
                </div>
              </div>

              {/* Right Column: Charts & Stats */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Current NOI', value: propertySummary.deal_metrics?.noi ? `$${propertySummary.deal_metrics.noi.toLocaleString()}` : 'N/A' },
                    { label: 'Cap Rate', value: propertySummary.deal_metrics?.cap_rate ? `${propertySummary.deal_metrics.cap_rate}%` : 'N/A' },
                    { label: 'Y5 Proj NOI', value: propertySummary.deal_metrics?.noi ? `$${Math.round(propertySummary.deal_metrics.noi * Math.pow(1 + (rentGrowth/100), 5)).toLocaleString()}` : 'N/A' },
                    { label: 'Cash-on-Cash', value: propertySummary.deal_metrics?.cash_on_cash ? `${propertySummary.deal_metrics.cash_on_cash}%` : 'N/A' }
                  ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">{stat.label}</div>
                      <div className="text-lg font-bold">{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div className="p-6 rounded-2xl bg-card border border-border/50">
                  <h4 className="text-xs font-black uppercase tracking-widest text-foreground mb-4">5-Year NOI Projection</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={Array.from({length: 5}).map((_, i) => ({
                        year: `Year ${i+1}`,
                        noi: propertySummary.deal_metrics?.noi ? Math.round(propertySummary.deal_metrics.noi * Math.pow(1 + (rentGrowth/100), i) - ((vacancyRate/100) * propertySummary.deal_metrics.noi) - (capexPerUnit * (property?.unit_count || 0))) : 0
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis dataKey="year" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} width={50} />
                        <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)'}} />
                        <Line type="monotone" dataKey="noi" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="font-bold text-lg">Analysis Unavailable</p>
              <p className="text-sm text-muted-foreground">Run the AI pipeline on documents to generate insights.</p>
            </div>
          )}
          
          <div className="flex justify-end pt-4 border-t border-border/30">
            <Button onClick={() => setIsSummaryOpen(false)}>Close Overview</Button>
          </div>
        </div>
      </Modal>

      {/* Copilot FAB */}
      <button 
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform z-40"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Copilot Sidebar */}
      <AnimatePresence>
        {isCopilotOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
              onClick={() => setIsCopilotOpen(false)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed top-0 right-0 h-full w-full max-w-2xl bg-card border-l border-border/50 z-50 shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Property Copilot</h3>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">RAG Context: {property?.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsCopilotOpen(false)} className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                    <MessageSquare className="w-12 h-12 text-muted-foreground" />
                    <p className="text-sm font-bold">Ask anything about this property.</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">The Copilot has read all verified documents in the Data Room.</p>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] rounded-2xl p-4 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 border border-border/50'}`}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="border-collapse border border-border/50 w-full text-xs" {...props} /></div>,
                            th: ({node, ...props}) => <th className="border border-border/50 p-2 bg-muted/50 font-bold" {...props} />,
                            td: ({node, ...props}) => <td className="border border-border/50 p-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-4 space-y-1 my-2" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal ml-4 space-y-1 my-2" {...props} />,
                            h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-4 mb-2" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-md font-bold mt-3 mb-1" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 border border-border/50 rounded-2xl p-4 text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Analyzing documents...
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border/50 bg-background">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }}
                  className="flex gap-2"
                >
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about leases, financials..." 
                    className="flex-1 bg-muted/30 border border-border/50 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Button type="submit" disabled={!chatInput.trim() || chatLoading} className="w-10 h-10 rounded-xl p-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
