import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Skeleton, Modal, Input } from '../components/ui/components';
import { apiClient } from '../api/client';
import { Building2, Plus, MapPin, Layers, Search, SlidersHorizontal, Pencil, Trash2, List, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Properties() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', address: '', city: '', unit_count: 0 });
  
  const navigate = useNavigate();

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/properties/');
      setProperties(response.data.items);
    } catch (err) {
      console.error('Failed to fetch properties', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleOpenModal = (property: any = null) => {
    if (property) {
      setEditingProperty(property);
      setFormData({
        name: property.name,
        address: property.address || '',
        city: property.city || '',
        unit_count: property.unit_count || 0
      });
    } else {
      setEditingProperty(null);
      setFormData({ name: '', address: '', city: '', unit_count: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingProperty) {
        await apiClient.put(`/properties/${editingProperty.id}`, formData);
      } else {
        await apiClient.post('/properties/', formData);
      }
      setIsModalOpen(false);
      fetchProperties();
    } catch (err) {
      console.error('Failed to save property', err);
    }
  };

  const handleDelete = async () => {
    if (!propertyToDelete) return;
    try {
      await apiClient.delete(`/properties/${propertyToDelete.id}`);
      setIsDeleteOpen(false);
      setPropertyToDelete(null);
      fetchProperties();
    } catch (err) {
      console.error('Failed to delete property', err);
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 text-nowrap">Institutional Portfolio</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Manage and underwrite your real estate assets with AI-driven insights.</p>
        </div>
        <Button 
          className="gap-2 h-12 px-6 text-base font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95" 
          onClick={() => handleOpenModal()}
        >
          <Plus className="w-5 h-5" /> New Acquisition
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 py-2">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search assets by name, address, or city..." 
              className="w-full pl-10 pr-4 py-3 bg-muted/30 border border-border/50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none shadow-sm focus:shadow-md"
            />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/30 p-1 rounded-xl border border-border/50">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'} 
              size="sm" 
              className="h-9 px-3 rounded-lg"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4 mr-2" /> Grid
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="sm" 
              className="h-9 px-3 rounded-lg"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-2" /> List
            </Button>
          </div>
          <Button variant="outline" className="gap-2 h-11 px-5 font-semibold border-border/50 hover:bg-muted/50">
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div 
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx} className="border-border/40 bg-card/40 overflow-hidden">
                   <div className="aspect-[16/9] w-full bg-muted/20 animate-pulse" />
                   <CardHeader className="p-6">
                     <Skeleton className="h-6 w-3/4 mb-2" />
                     <Skeleton className="h-4 w-1/2" />
                   </CardHeader>
                   <CardContent className="p-6 pt-0 space-y-4">
                     <div className="flex gap-4">
                       <Skeleton className="h-8 w-20 rounded-full" />
                       <Skeleton className="h-8 w-24 rounded-full" />
                     </div>
                   </CardContent>
                </Card>
              ))
            ) : (
              properties.map((property, idx) => (
                <motion.div
                  key={property.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.5, ease: "easeOut" }}
                  className="h-full group relative"
                >
                  <Card 
                    className="h-full flex flex-col border-border/40 hover:border-primary/40 bg-card/60 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="aspect-[16/9] bg-muted/20 relative overflow-hidden flex items-center justify-center group-hover:bg-muted/30 transition-colors">
                      <Building2 className="w-16 h-16 text-muted-foreground/20 group-hover:text-primary/20 transition-all duration-700 group-hover:scale-110" />
                      <div className="absolute top-4 right-4 flex gap-2">
                        <Badge variant={property.status === 'active' ? 'success' : 'secondary'} className="px-3 py-1 font-bold text-[10px] tracking-widest uppercase">
                          {property.status}
                        </Badge>
                      </div>
                      
                      {/* Action Buttons Overlay */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px]">
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="rounded-full h-12 w-12 shadow-lg hover:bg-primary hover:text-white transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(property);
                          }}
                        >
                          <Pencil className="w-5 h-5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="destructive" 
                          className="rounded-full h-12 w-12 shadow-lg transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPropertyToDelete(property);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>

                    <CardHeader className="p-6">
                      <CardTitle className="text-2xl font-bold tracking-tight group-hover:text-primary transition-colors duration-300">
                        {property.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 text-muted-foreground mt-2 font-semibold">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="text-sm truncate">{property.address || 'No address provided'}, {property.city}</span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 pt-0 mt-auto">
                      <div className="flex items-center gap-4 text-muted-foreground font-bold">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40">
                          <Layers className="w-4 h-4 text-primary" />
                          <span className="text-xs uppercase tracking-wider">{property.unit_count} Units</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40 ml-auto group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                          <span className="text-xs uppercase tracking-widest">Details</span>
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border border-border/50 rounded-2xl overflow-hidden bg-card/40 backdrop-blur-md shadow-xl"
          >
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 backdrop-blur-md z-10 shadow-sm bg-muted/40">
                <tr className="border-b border-border/50">
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Property Asset</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Location</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-center">Units</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {properties.map((property) => (
                  <tr 
                    key={property.id} 
                    className="even:bg-muted/10 hover:bg-primary/10 transition-colors group cursor-pointer border-l-2 border-transparent hover:border-primary"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <Building2 className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <span className="font-bold text-lg">{property.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">
                      {property.address}, {property.city}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="secondary" className="font-bold">{property.unit_count}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={property.status === 'active' ? 'success' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                        {property.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(property);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPropertyToDelete(property);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProperty ? "Edit Asset Details" : "Register New Acquisition"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Asset Name</label>
            <Input 
              placeholder="e.g. Skyline Towers" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="bg-muted/20 border-border/50 h-12"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">City</label>
              <Input 
                placeholder="e.g. Montreal" 
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                className="bg-muted/20 border-border/50 h-12"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Unit Count</label>
              <Input 
                type="number" 
                placeholder="0" 
                value={formData.unit_count}
                onChange={(e) => setFormData({...formData, unit_count: parseInt(e.target.value) || 0})}
                className="bg-muted/20 border-border/50 h-12"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Primary Address</label>
            <Input 
              placeholder="123 Financial Way" 
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="bg-muted/20 border-border/50 h-12"
            />
          </div>
          <div className="pt-4 flex gap-3">
            <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button className="flex-1 h-12 font-bold shadow-lg shadow-primary/20" onClick={handleSave}>
              {editingProperty ? "Update Asset" : "Finalize Acquisition"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal 
        isOpen={isDeleteOpen} 
        onClose={() => setIsDeleteOpen(false)} 
        title="Confirm Asset Deletion"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex gap-3 items-start">
            <Trash2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">Irreversible Action</p>
              <p className="opacity-80 mt-1 leading-relaxed">
                Deleting <strong>{propertyToDelete?.name}</strong> will permanently remove all associated documents, units, and extracted financial data.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1 h-12 font-bold" onClick={handleDelete}>Delete Permanently</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
