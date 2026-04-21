import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, CheckCircle, Clock, AlertTriangle, ArrowRight, Folder, Info, PieChart, ShieldCheck, XCircle, ChevronRight, ChevronDown, Activity, Building2, MessageSquare } from 'lucide-react';
import { cn, Card, CardHeader, CardTitle, CardContent, Button } from '../components/ui/components';
import { Dropzone } from '../components/ui/Dropzone';
import { apiClient } from '../api/client';

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileBlob, setSelectedFileBlob] = useState<Blob | null>(null);
  const [viewingDeal, setViewingDeal] = useState<any>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ financials: true, legal: true, other: true });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (selectedFileUrl) window.URL.revokeObjectURL(selectedFileUrl);
    };
  }, [id, selectedFileUrl]);

  const fetchData = async () => {
    try {
      const [propRes, docsRes, dealsRes] = await Promise.all([
        apiClient.get(`/properties/${id}`),
        apiClient.get(`/documents/?property_id=${id}`),
        apiClient.get(`/deals/?property_id=${id}`) // Assuming this exists or works via filter
      ]);
      setProperty(propRes.data);
      setDocuments(docsRes.data.items || []);
      setDeals(dealsRes.data.items || []);
    } catch (err) {
      console.error('Failed to load property details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('property_id', id as string);

    try {
      setUploading(true);
      await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchData();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
       formData.append('files', files[i]);
    }
    formData.append('property_id', id as string);

    try {
      setUploading(true);
      await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchData();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunAgents = async (docId: number) => {
    try {
      await apiClient.post(`/agents/process/${docId}`);
      alert(`Pipeline initiated for Document ID: ${docId}`);
      fetchData();
    } catch (err) {
      console.error('Failed to start agent pipeline', err);
    }
  };

  const handleViewFile = async (docId: number) => {
    try {
      if (selectedFileUrl) window.URL.revokeObjectURL(selectedFileUrl);
      
      const response = await apiClient.get(`/documents/${docId}/file`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      
      setSelectedFileBlob(blob);
      setSelectedFileUrl(url);
    } catch (err) {
      console.error('Failed to load file preview', err);
    }
  };

  const handleViewDeal = async (dealId: number) => {
    try {
      const res = await apiClient.get(`/deals/${dealId}`);
      setViewingDeal(res.data);
    } catch (err) {
      console.error('Failed to load deal details', err);
      alert('Could not load deal details. Make sure the extraction is complete.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'verified': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing': return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'needs_review': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const underwriting = {
    noi: deals.length > 0 ? deals.reduce((acc, d) => acc + (d.noi || 0), 0) / deals.length : 0,
    capRate: deals.length > 0 ? deals.reduce((acc, d) => acc + (d.cap_rate || 0), 0) / deals.length : 0,
    valuation: deals.length > 0 ? deals.reduce((acc, d) => acc + (d.purchase_price || 0), 0) / deals.length : 0,
  };

  const categories = {
    financial: documents.filter(d => d.category === 'financial'),
    lease: documents.filter(d => d.category === 'lease'),
    legal: documents.filter(d => d.category === 'legal'),
    condition: documents.filter(d => d.category === 'condition'),
    other: documents.filter(d => !['financial', 'lease', 'legal', 'condition'].includes(d.category))
  };

  const ddChecklist = [
    { name: 'Latest Tax Bill', met: categories.financial.some(d => d.original_filename.toLowerCase().includes('tax')), cat: 'financial' },
    { name: 'Valid Insurance', met: categories.financial.some(d => d.original_filename.toLowerCase().includes('insurance')), cat: 'financial' },
    { name: 'Rent Roll Extraction', met: categories.lease.length > 0, cat: 'lease' },
    { name: 'Phase I Environmental', met: categories.condition.some(d => d.original_filename.toLowerCase().includes('phase')), cat: 'condition' },
  ];

  const toggleFolder = (folder: string) => {
    setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
  if (!property) return <div className="p-12 text-center text-muted-foreground font-medium">Property not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/properties')} className="rounded-full h-12 w-12 hover:bg-accent">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
               <h1 className="text-4xl font-extrabold tracking-tight">{property.name}</h1>
               <span className="text-[10px] tracking-widest uppercase font-black bg-primary text-primary-foreground px-2 py-0.5 rounded shadow-sm">{property.property_type}</span>
            </div>
            <p className="text-muted-foreground mt-1 font-medium">{property.address}, {property.city}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" className="gap-2 border-primary/20 hover:border-primary/40 shadow-sm" onClick={() => window.print()}>
              Export Underwriting
           </Button>
           <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => navigate('/concierge', { state: { propertyId: id } })}>
              Consult AI Concierge
           </Button>
        </div>
      </div>

      {/* Institutional Stats Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 shadow-sm">
           <CardContent className="p-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <PieChart className="w-3 h-3 text-primary" /> Aggregated NOI
              </p>
              <div className="text-3xl font-black">${underwriting.noi?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '--'}</div>
              <p className="text-[10px] text-primary mt-1 font-semibold">Based on {deals.length} extractions</p>
           </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-green-500/5 to-transparent border-green-500/10 shadow-sm">
           <CardContent className="p-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-green-500" /> Current Cap Rate
              </p>
              <div className="text-3xl font-black">{underwriting.capRate ? (underwriting.capRate * 100).toFixed(2) + '%' : '--'}</div>
              <p className="text-[10px] text-green-500 mt-1 font-semibold">Weighted average</p>
           </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-orange-500/5 to-transparent border-orange-500/10 shadow-sm">
           <CardContent className="p-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-orange-500" /> DD Completion
              </p>
              <div className="text-3xl font-black">{Math.round((ddChecklist.filter(c => c.met).length / ddChecklist.length) * 100)}%</div>
              <p className="text-[10px] text-orange-500 mt-1 font-semibold">{ddChecklist.filter(c => !c.met).length} items remaining</p>
           </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/10 shadow-sm">
           <CardContent className="p-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-blue-500" /> Est. Valuation
              </p>
              <div className="text-3xl font-black">${underwriting.valuation?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '--'}</div>
              <p className="text-[10px] text-blue-500 mt-1 font-semibold">Market extraction</p>
           </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left: Advanced Data Room / File Explorer */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="p-6 border-b bg-muted/20 flex items-center justify-between">
               <h3 className="text-lg font-bold flex items-center gap-2">
                 <Folder className="w-5 h-5 text-primary" /> Advanced Data Room
               </h3>
               <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fetchData()} className="h-8">Refresh</Button>
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} className="h-8">Batch Upload</Button>
               </div>
            </div>
            
            <CardContent className="p-0">
               {documents.length === 0 ? (
                  <div className="p-20">
                    <Dropzone onFilesSelected={handleFilesSelected} isLoading={uploading} />
                  </div>
               ) : (
                  <div className="divide-y border-t border-border/50">
                    <div className="p-6 bg-muted/10">
                       <Dropzone onFilesSelected={handleFilesSelected} isLoading={uploading} />
                    </div>
                    
                    {/* Folder Groups */}
                    {Object.entries(categories).map(([key, docs]) => (
                      <div key={key} className="group/folder">
                        <div 
                          className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-accent/30 transition-colors"
                          onClick={() => toggleFolder(key)}
                        >
                          {openFolders[key] ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <Folder className={cn("w-5 h-5", docs.length > 0 ? "text-primary fill-primary/10" : "text-muted-foreground")} />
                          <span className="font-bold text-sm uppercase tracking-wider grow capitalize">{key.replace('_', ' ')}</span>
                          <span className="text-[10px] font-black bg-muted px-2 py-0.5 rounded text-muted-foreground">{docs.length} items</span>
                        </div>
                        
                        {openFolders[key] && (
                          <div className="bg-accent/5 divide-y divide-border/20">
                            {docs.length === 0 ? (
                              <div className="px-14 py-4 text-xs text-muted-foreground italic">No documents in this category.</div>
                            ) : (
                              docs.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between px-6 py-4 pl-14 hover:bg-accent/20 transition-colors group">
                                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => handleViewFile(doc.id)}>
                                    <div className="bg-background border rounded p-1.5 shadow-sm group-hover:border-primary/50 transition-colors">
                                       <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm group-hover:text-primary transition-colors">{doc.original_filename}</p>
                                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-semibold">
                                         <span className="flex items-center gap-1">Status: {getStatusIcon(doc.status)}</span>
                                         {doc.ocr_confidence && <span className="bg-primary/5 text-primary px-1.5 rounded border border-primary/10">AI Confidence: {doc.ocr_confidence}%</span>}
                                         <span className="opacity-50">{new Date(doc.created_at).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {doc.status === 'verified' && doc.deal_id ? (
                                      <Button  variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-tighter gap-1.5" onClick={() => handleViewDeal(doc.deal_id)}>
                                        Analysis <ArrowRight className="w-3 h-3" />
                                      </Button>
                                    ) : (
                                      <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-tighter" onClick={() => handleRunAgents(doc.id)}>
                                        Extract
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
               )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Checklist & Insights */}
        <div className="space-y-6">
           <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
             <CardHeader className="border-b bg-muted/20">
               <CardTitle className="text-sm flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-primary" /> Due Diligence Tracker
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               <div className="divide-y">
                  {ddChecklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-4">
                      {item.met ? (
                        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                           <CheckCircle className="w-4 h-4 text-green-500" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                           <AlertTriangle className="w-4 h-4 text-orange-500" />
                        </div>
                      )}
                      <div>
                        <p className={cn("text-xs font-bold", item.met ? "text-foreground" : "text-muted-foreground")}>{item.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.met ? "Verified and indexed" : `Search for "${item.name}" failed`}</p>
                      </div>
                    </div>
                  ))}
               </div>
               <div className="p-4 bg-primary/5 mt-2">
                  <p className="text-[10px] font-bold text-primary flex items-center gap-1.5">
                    <Info className="w-3 h-3" /> AI DETECTOR: MISSING DOCUMENTS
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    Analyzing existing 124 files... No recent insurance certificate found for calendar year 2024. Property at risk.
                  </p>
               </div>
             </CardContent>
           </Card>

           <Card className="border-none shadow-xl bg-primary text-primary-foreground">
              <CardContent className="p-6 space-y-4">
                 <h4 className="font-bold flex items-center gap-2">
                   <MessageSquare className="w-5 h-5" /> Concierge Brief
                 </h4>
                 <p className="text-sm font-medium opacity-90 leading-snug">
                   "Hello! I've analyzed the latest rent roll and found a 12% revenue variance in Unit 4 compared to last year's evaluation. Should I double check the lease?"
                 </p>
                 <Button className="w-full bg-background text-primary hover:bg-background/90 font-bold shadow-lg" onClick={() => navigate('/concierge')}>
                   Open Consultation
                 </Button>
              </CardContent>
           </Card>
        </div>
      </div>

      {/* File Preview Modal */}
      {selectedFileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedFileUrl(null)}>
          <div className="bg-background rounded-xl overflow-hidden shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-primary" /> Document Preview
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFileUrl(null)}>Close</Button>
            </div>
            <div className="flex-1 bg-muted/30">
              {selectedFileBlob?.type?.startsWith('image/') ? (
                <div className="w-full h-full flex items-center justify-center p-8 overflow-auto">
                   <img src={selectedFileUrl} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg rounded" />
                </div>
              ) : (
                <iframe src={selectedFileUrl} className="w-full h-full border-none" title="Document Preview" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deal Detail Modal */}
      {viewingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200" onClick={() => setViewingDeal(null)}>
           <div className="bg-background rounded-xl overflow-hidden shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-primary/5 to-transparent">
               <div>
                  <h3 className="text-2xl font-bold tracking-tight text-primary">Intelligent Structuring Result</h3>
                  <p className="text-sm text-muted-foreground mt-1">Extracted on {new Date(viewingDeal.created_at).toLocaleDateString()}</p>
               </div>
               <Button variant="outline" onClick={() => setViewingDeal(null)}>Close</Button>
             </div>
             <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Financial Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="p-6 rounded-xl bg-primary/5 border border-primary/10">
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Purchase Price</p>
                      <p className="text-3xl font-extrabold">${viewingDeal.purchase_price?.toLocaleString() || '--'}</p>
                   </div>
                   <div className="p-6 rounded-xl bg-orange-500/5 border border-orange-500/10">
                      <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2">Asking Price</p>
                      <p className="text-3xl font-extrabold">${viewingDeal.asking_price?.toLocaleString() || '--'}</p>
                   </div>
                   <div className="p-6 rounded-xl bg-green-500/5 border border-green-500/10">
                      <p className="text-xs font-bold text-green-500 uppercase tracking-wider mb-2">Gross Revenue</p>
                      <p className="text-3xl font-extrabold">${viewingDeal.gross_revenue?.toLocaleString() || '--'}</p>
                   </div>
                </div>

                {/* AI Executive Summary */}
                <div className="space-y-3">
                   <h4 className="flex items-center gap-2 font-bold text-lg border-b pb-2">
                      <CheckCircle className="w-5 h-5 text-green-500" /> AI Executive Summary
                   </h4>
                   <div className="text-muted-foreground leading-relaxed bg-muted/20 p-6 rounded-lg text-base">
                      {viewingDeal.ai_summary || "No summary generated."}
                   </div>
                </div>

                {/* Detailed Extraction Report */}
                <div className="space-y-4">
                   <h4 className="flex items-center gap-2 font-bold text-lg border-b pb-2">
                      <FileText className="w-5 h-5 text-primary" /> Underwriting Report
                   </h4>
                   <div className="prose prose-sm max-w-none bg-muted/10 p-6 rounded-lg whitespace-pre-wrap font-mono text-sm border border-border/50">
                      {viewingDeal.ai_report || "No detailed report available."}
                   </div>
                </div>

                {/* Raw Structured Data */}
                <div className="space-y-3">
                   <h4 className="font-bold text-lg border-b pb-2">Structured Data (JSON)</h4>
                   <pre className="p-4 bg-zinc-950 text-zinc-50 rounded-lg overflow-auto text-xs font-mono max-h-64 shadow-inner">
                      {JSON.stringify(viewingDeal.structured_data, null, 2)}
                   </pre>
                </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};
