import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, ArrowRight, MapPin, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '../components/ui/components';
import { apiClient } from '../api/client';
import { useSearch } from '../context/SearchContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Properties() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProperty, setNewProperty] = useState({
    name: '',
    address: '',
    city: '',
    province_state: '',
    postal_code: '',
    property_type: 'multi-family',
    unit_count: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { searchQuery } = useSearch();

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProperties(searchQuery);
    }, 400); // Debounce

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchProperties = async (searchStr = '') => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/properties/?search=${searchStr}`);
      setProperties(response.data.items || []);
    } catch (err) {
      console.error('Failed to load properties', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/properties/', newProperty);
      setIsModalOpen(false);
      setNewProperty({
        name: '',
        address: '',
        city: '',
        province_state: '',
        postal_code: '',
        property_type: 'multi-family',
        unit_count: 0
      });
      fetchProperties(searchQuery);
    } catch (err) {
      console.error('Failed to create property', err);
    } finally {
      setIsSubmitting(false);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground mt-1">Manage physical assets and underlying due diligence documents.</p>
        </div>
        <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" /> Add Asset
        </Button>
      </div>

      {properties.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center flex flex-col items-center bg-muted/10">
          <Building2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            {searchQuery ? 'No matches found' : 'No properties found'}
          </h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery 
              ? `We couldn't find any results for "${searchQuery}".`
              : "You haven't added any real estate assets to your ledger yet."}
          </p>
          {!searchQuery && <Button className="mt-6" onClick={() => setIsModalOpen(true)}>Create your first property</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop, idx) => (
            <motion.div 
              key={prop.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="hover:border-primary/50 transition-colors group cursor-pointer overflow-hidden flex flex-col h-full shadow-sm" onClick={() => navigate(`/properties/${prop.id}`)}>
                <div className="h-32 bg-accent/30 border-b flex items-center justify-center relative overflow-hidden group-hover:bg-primary/5 transition-colors">
                  <Building2 className="w-12 h-12 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
                </div>
                <CardHeader className="pb-2 flex-grow">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">{prop.name}</CardTitle>
                    <span className="text-[10px] uppercase font-bold bg-secondary px-2 py-1 rounded text-secondary-foreground shrink-0 ml-2">{prop.property_type}</span>
                  </div>
                  <p className="text-muted-foreground text-sm flex items-start gap-1.5 mt-2">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{prop.address}, {prop.city}</span>
                  </p>
                </CardHeader>
                <CardContent className="pt-2 flex justify-between items-center text-sm font-medium border-t mt-4 py-4 bg-muted/10">
                    <span className="text-muted-foreground">{prop.unit_count} Units</span>
                    <span className="flex items-center text-primary group-hover:text-primary/80">Manage <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Asset Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold">Add New Property</h2>
                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <form onSubmit={handleCreateProperty} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Property Name</label>
                  <Input 
                    required 
                    placeholder="e.g. Waterfront Plaza" 
                    value={newProperty.name}
                    onChange={(e) => setNewProperty({...newProperty, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Address</label>
                    <Input 
                      placeholder="Street address" 
                      value={newProperty.address}
                      onChange={(e) => setNewProperty({...newProperty, address: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <Input 
                      placeholder="City" 
                      value={newProperty.city}
                      onChange={(e) => setNewProperty({...newProperty, city: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Province/State</label>
                    <Input 
                      placeholder="QC / ON / NY" 
                      value={newProperty.province_state}
                      onChange={(e) => setNewProperty({...newProperty, province_state: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Postal Code</label>
                    <Input 
                      placeholder="H1H 1H1" 
                      value={newProperty.postal_code}
                      onChange={(e) => setNewProperty({...newProperty, postal_code: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Property Type</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newProperty.property_type}
                      onChange={(e) => setNewProperty({...newProperty, property_type: e.target.value})}
                    >
                      <option value="multi-family">Multi-family</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="retail">Retail</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unit Count</label>
                    <Input 
                      type="number" 
                      value={newProperty.unit_count}
                      onChange={(e) => setNewProperty({...newProperty, unit_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Property'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
