import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Building2, Loader2, ChevronDown, MessageSquare, Sparkles, Trash2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Card } from '../components/ui/components';
import { apiClient } from '../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp?: string;
}

export default function Concierge() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello. I am your Investment Concierge. How can I assist you in analyzing your portfolio today? I can answer questions about NOI, exact clauses in lease agreements, or provide insights into your Cap Rates.',
      sources: [],
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await apiClient.get('/properties/');
        const data = res.data;
        // Robustly handle different response formats
        const items = data?.items || (Array.isArray(data) ? data : []);
        setProperties(items);
        
        // Auto-select if there's only one property
        if (items.length === 1) {
          setSelectedPropertyId(items[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch properties', err);
        setProperties([]);
      }
    };
    fetchProperties();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/chat/', {
        message: input,
        property_id: selectedPropertyId
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        sources: response.data.sources,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please check your connection or try again later.',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hello. I am your Investment Concierge. How can I assist you in analyzing your portfolio today?',
        sources: [],
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Investment Concierge</h1>
          </div>
          <p className="text-muted-foreground text-sm">AI-powered insights for your real estate portfolio</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Building2 className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <select
              className="pl-10 pr-10 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer min-w-[200px]"
              value={selectedPropertyId || ''}
              onChange={(e) => setSelectedPropertyId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All Properties (General)</option>
              {Array.isArray(properties) && properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={clearChat}
            className="rounded-xl border-border/50 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20 transition-all"
            title="Clear Chat"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-xl bg-card/50 backdrop-blur-sm rounded-2xl relative">
        {/* Messages Container */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-1 ${
                    msg.role === 'assistant' 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                  </div>
                  
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-2xl shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-background border border-border/50'
                    }`}>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="border-collapse border border-border/50 w-full" {...props} /></div>,
                            th: ({node, ...props}) => <th className="border border-border/50 p-2 bg-muted/50 font-bold text-left" {...props} />,
                            td: ({node, ...props}) => <td className="border border-border/50 p-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-4 space-y-1 my-2" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal ml-4 space-y-1 my-2" {...props} />,
                            p: ({node, ...props}) => <p className="mb-0 last:mb-0" {...props} />,
                            code: ({node, inline, ...props}: any) => 
                              inline 
                                ? <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                                : <code className="block bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    
                    {msg.timestamp && (
                      <span className="text-[10px] text-muted-foreground mt-1.5 px-1 font-medium">
                        {msg.timestamp}
                      </span>
                    )}

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.sources.map((source, idx) => (
                          <div 
                            key={idx}
                            className="text-[10px] bg-muted/50 hover:bg-muted border border-border/50 px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 group"
                          >
                            <Building2 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="max-w-[120px] truncate">{source.filename}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                <Bot size={18} />
              </div>
              <div className="flex gap-1 items-center bg-muted/30 px-4 py-2 rounded-2xl">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-background/50 border-t border-border/50 backdrop-blur-md">
          <div className="relative max-w-4xl mx-auto flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={selectedPropertyId ? "Ask a question about this property..." : "Ask a general question about your portfolio..."}
              className="flex-1 bg-background border-border/50 rounded-xl h-12 pr-12 focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
              disabled={isLoading}
            />
            <Button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="rounded-xl h-12 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-3 uppercase tracking-widest font-semibold opacity-50">
            Powered by Abelam Deal Intelligence Agent
          </p>
        </div>
      </Card>
    </div>
  );
}
