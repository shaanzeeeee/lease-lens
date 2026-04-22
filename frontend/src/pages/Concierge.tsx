import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Building2, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Card } from '../components/ui/components';
import { apiClient } from '../api/client';

interface Source {
  doc_id: number;
  filename: string;
  score: number;
  snippet: string;
  page: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

interface Property {
  id: number;
  name: string;
  address: string;
}

export default function Concierge() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello. I am your Investment Concierge. How can I assist you in analyzing your portfolio today? I can answer questions about NOI, exact clauses in lease agreements, or provide insights into your Cap Rates.',
      sources: []
    }
  ]);
  const [inputStr, setInputStr] = useState('');
   const [isTyping, setIsTyping] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileBlob, setSelectedFileBlob] = useState<Blob | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch available properties on mount
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await apiClient.get('/properties/');
        const items = res.data.items || res.data || [];
        setProperties(items);
      } catch (err) {
        console.error('Failed to fetch properties', err);
      }
    };
    fetchProperties();
  }, []);

  useEffect(() => {
    return () => {
      if (selectedFileUrl) window.URL.revokeObjectURL(selectedFileUrl);
    };
  }, [selectedFileUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputStr.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputStr };
    setMessages(prev => [...prev, userMsg]);
    setInputStr('');
    setIsTyping(true);

    try {
      const res = await apiClient.post('/chat/', {
        message: userMsg.content,
        property_id: selectedPropertyId, // scoped to selected property (null = all)
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.response,
        sources: res.data.sources
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an error querying the vector store. Please try again or check connection.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleViewFile = async (docId: number) => {
    try {
      if (selectedFileUrl) window.URL.revokeObjectURL(selectedFileUrl);
      
      const response = await apiClient.get(`/documents/${docId}/file`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: response.headers['content-type'] as string || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      
      setSelectedFileBlob(blob);
      setSelectedFileUrl(url);
    } catch (err) {
      console.error('Failed to load file preview', err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investment Concierge</h1>
          <p className="text-muted-foreground mt-1">Chat securely with your LangGraph agents and Pinecone RAG store.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card border border-primary/10 px-4 py-2 rounded-xl shadow-sm">
          <Building2 className="w-4 h-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Context Scoping</span>
            <select 
              value={selectedPropertyId || ''} 
              onChange={(e) => setSelectedPropertyId(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent border-none text-sm font-medium focus:ring-0 p-0 pr-8 appearance-none cursor-pointer"
              style={{ backgroundImage: 'none' }}
            >
              <option value="">All Properties (Global)</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-[-24px] pointer-events-none" />
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-primary/10 shadow-lg">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-accent/10">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border text-foreground'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-primary" />}
                </div>

                <div className={`flex flex-col gap-2 min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed max-w-[90%] shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-card border rounded-tl-sm'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 w-full max-w-[90%]">
                      {msg.sources.map((src, i) => (
                        <div 
                          key={i} 
                          onClick={() => handleViewFile(src.doc_id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background border rounded-md text-xs text-muted-foreground w-full group hover:border-primary/30 transition-colors cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                          <span className="truncate font-medium">{src.filename}</span>
                          <span className="bg-accent px-1.5 py-0.5 rounded text-[10px] ml-auto">P.{src.page}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-4xl mx-auto">
              <div className="shrink-0 h-10 w-10 rounded-xl bg-card border flex items-center justify-center shadow-sm">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
              <div className="px-5 py-4 rounded-2xl bg-card border rounded-tl-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-primary/80 animate-bounce [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} className="h-px" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-card border-t shrink-0">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center">
            <Input
              value={inputStr}
              onChange={(e) => setInputStr(e.target.value)}
              placeholder="Ask about NOI, lease details, or upload errors..."
              className="pr-14 h-14 rounded-full bg-accent/30 focus-visible:ring-primary/30 text-base"
              disabled={isTyping}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputStr.trim() || isTyping}
              className="absolute right-2 h-10 w-10 rounded-full"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </form>
          <div className="text-center mt-3">
             <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">Abelam AI can make mistakes. Verify critical figures in original documents.</p>
          </div>
        </div>
      </Card>

      {/* File Preview Modal */}
      {selectedFileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedFileUrl(null)}>
          <div className="bg-background rounded-xl overflow-hidden shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold flex items-center gap-2 text-lg">
                <Bot className="w-5 h-5 text-primary" /> Document Source Preview
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
    </div>
  );
}
