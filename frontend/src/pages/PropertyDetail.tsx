import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Skeleton, Modal } from '../components/ui/components';
import { apiClient } from '../api/client';
import { 
  Building2, MapPin, FileText, 
  Upload, CheckCircle2, AlertCircle, 
  Search, ExternalLink, Calculator,
  TrendingUp, Wallet, ArrowUpRight,
  Filter, LayoutGrid, List, Trash2, Loader2
} from 'lucide-react';
import { Dropzone } from '../components/ui/Dropzone';
import { motion, AnimatePresence } from 'framer-motion';

export default function PropertyDetail() {
  const { id } = useParams();
  const [property, setProperty] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [propertySummary, setPropertySummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [processingDocs, setProcessingDocs] = useState<Record<number, boolean>>({});


    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch property first as it's critical
        const propRes = await apiClient.get(`/properties/${id}`);
        setProperty(propRes.data);
        
        // Fetch others in parallel but handle errors individually
        const [docsRes, dealsRes] = await Promise.allSettled([
          apiClient.get(`/documents/?property_id=${id}`),
          apiClient.get(`/deals/?property_id=${id}`)
        ]);
        
        if (docsRes.status === 'fulfilled') {
          setDocuments(docsRes.value.data.items);
        } else {
          console.error('Failed to fetch documents', docsRes.reason);
        }
        
        if (dealsRes.status === 'fulfilled') {
          setDeals(dealsRes.value.data.items);
        } else {
          console.error('Failed to fetch deals', dealsRes.reason);
        }
      } catch (err) {
        console.error('Failed to fetch property details', err);
        setError('Property not found or server error');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    return () => {
      if (selectedFileUrl) window.URL.revokeObjectURL(selectedFileUrl);
    };
  }, [selectedFileUrl]);

  const handleUploadComplete = () => {
    fetchData();
  };

  const handleViewDocument = async (doc: any) => {
    setPreviewDoc(doc);
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
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await apiClient.delete(`/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      console.error('Failed to delete document', err);
      alert('Failed to delete document');
    }
  };

  const handleRunPipeline = async (docId: number) => {
    setProcessingDocs(prev => ({ ...prev, [docId]: true }));
    try {
      await apiClient.post(`/agents/process/${docId}`);
      // Poll for status or just refresh after a delay
      setTimeout(() => {
        fetchData();
        setProcessingDocs(prev => ({ ...prev, [docId]: false }));
      }, 3000);
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

  const [fileViewMode, setFileViewMode] = useState<'list' | 'grid'>('list');

  const institutionalStats = [
    { label: 'Market Cap Rate', value: '5.2%', icon: TrendingUp, color: 'text-primary' },
    { label: 'Projected NOI', value: '$242,500', icon: Calculator, color: 'text-green-500' },
    { label: 'Asset Value', value: '$4.6M', icon: Wallet, color: 'text-blue-500' },
    { label: 'Unit Count', value: property?.unit_count || 0, icon: Building2, color: 'text-orange-500' }
  ];

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
          <Button variant="outline" className="h-11 px-5 border-border/50 font-bold hover:bg-muted/50" onClick={() => window.history.back()}>
            Back to Portfolio
          </Button>
          <Button variant="outline" className="h-11 px-5 border-border/50 font-bold hover:bg-muted/50" onClick={handleFetchSummary}>
            <LayoutGrid className="w-4 h-4 mr-2" /> Overview
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
            <Card className="border-border/40 bg-card/40 backdrop-blur-md hover:border-primary/30 transition-all overflow-hidden group">
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input placeholder="Filter docs..." className="bg-muted/50 border border-border/50 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Filter className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <AnimatePresence mode="wait">
                {fileViewMode === 'list' ? (
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
                        {documents.length > 0 ? (
                          documents.map((doc) => (
                            <tr key={doc.id} className="hover:bg-primary/5 transition-colors group cursor-pointer">
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors"
                                    onClick={() => handleViewDocument(doc)}
                                  >
                                    <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                  </div>
                                  <div>
                                    <div className="font-bold text-foreground">{doc.original_filename}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{doc.category} • {Math.round(doc.file_size / 1024)} KB</div>
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
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 border-border/50 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                                    onClick={() => handleRunPipeline(doc.id)}
                                    disabled={processingDocs[doc.id] || doc.status === 'processing'}
                                  >
                                    {processingDocs[doc.id] || doc.status === 'processing' ? (
                                      <>Processing <Loader2 className="w-3 h-3 ml-1.5 animate-spin" /></>
                                    ) : (
                                      <>Verify <ExternalLink className="w-3 h-3 ml-1.5" /></>
                                    )}
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all"
                                    onClick={() => handleDeleteDocument(doc.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-8 py-20 text-center text-muted-foreground font-semibold">
                              No documents ingested for this asset.
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
                    {documents.length > 0 ? (
                      documents.map((doc) => (
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
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">{doc.category}</p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center">
                              <div className="text-[10px] font-bold text-muted-foreground">{Math.round(doc.file_size / 1024)} KB</div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 text-[10px] font-black uppercase tracking-widest hover:text-primary p-0"
                                  onClick={() => handleViewDocument(doc)}
                                >
                                  View <ExternalLink className="w-3 h-3 ml-1" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 text-[10px] font-black uppercase tracking-widest hover:text-destructive p-0"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-full py-12 text-center text-muted-foreground font-semibold">
                        No documents ingested for this asset.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
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
                { label: 'Financial Verification', status: 'verified', count: 12 },
                { label: 'Lease Abstracts', status: 'pending', count: 4 },
                { label: 'Technical DD', status: 'warning', count: 2 }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black">{item.count} items processed</span>
                  </div>
                  <Badge variant={item.status === 'verified' ? 'success' : item.status === 'warning' ? 'destructive' : 'secondary'} className="text-[10px] font-bold">
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
        size="xl"
      >
        <div className="w-full h-[70vh] bg-background rounded-xl border flex items-center justify-center overflow-hidden">
          {previewLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading Institutional Data...</p>
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
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
          <Button onClick={() => window.open(selectedFileUrl!, '_blank')}>
            Open in New Tab
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        title={`Institutional Overview: ${property.name}`}
        size="lg"
      >
        <div className="space-y-6">
          {summaryLoading ? (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Synthesizing Property Intelligence...</p>
            </div>
          ) : propertySummary ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'NOI', value: propertySummary.deal_metrics?.noi ? `$${propertySummary.deal_metrics.noi.toLocaleString()}` : 'N/A' },
                  { label: 'Cap Rate', value: propertySummary.deal_metrics?.cap_rate ? `${propertySummary.deal_metrics.cap_rate}%` : 'N/A' },
                  { label: 'Docs', value: propertySummary.document_count },
                  { label: 'Cash-on-Cash', value: propertySummary.deal_metrics?.cash_on_cash ? `${propertySummary.deal_metrics.cash_on_cash}%` : 'N/A' }
                ].map((stat, i) => (
                  <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">{stat.label}</div>
                    <div className="text-lg font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Aggregated AI Intelligence
                </h4>
                <div className="prose prose-invert max-w-none">
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {propertySummary.combined_summary}
                  </p>
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
    </div>
  );
}
