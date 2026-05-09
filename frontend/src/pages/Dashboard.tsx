import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Skeleton } from '../components/ui/components';
import { apiClient } from '../api/client';
import { Building2, Home, Activity, TrendingUp, Plus, ArrowRight, MessageSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

import { PropertyThumbnail } from '../components/PropertyThumbnail';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await apiClient.get('/properties/dashboard');
        setStats(response.data);
      } catch (err) {
        console.error('Failed to load dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const sparklineData1 = [{ v: 30 }, { v: 40 }, { v: 35 }, { v: 50 }, { v: 49 }, { v: 60 }, { v: 70 }, { v: 91 }];
  const sparklineData2 = [{ v: 20 }, { v: 25 }, { v: 35 }, { v: 30 }, { v: 45 }, { v: 55 }, { v: 65 }, { v: 80 }];
  const sparklineData3 = [{ v: 80 }, { v: 70 }, { v: 60 }, { v: 75 }, { v: 65 }, { v: 55 }, { v: 40 }, { v: 50 }];
  const sparklineData4 = [{ v: 10 }, { v: 15 }, { v: 12 }, { v: 20 }, { v: 18 }, { v: 25 }, { v: 30 }, { v: 35 }];

  const statCards = [
    { title: 'Total Properties', value: stats?.total_properties || 0, icon: Building2, trend: '+12.5%', trendIcon: ArrowUpRight, trendColor: 'text-emerald-500', data: sparklineData1 },
    { title: 'Portfolio Docs', value: stats?.total_documents || 0, icon: TrendingUp, trend: '+8.2%', trendIcon: ArrowUpRight, trendColor: 'text-emerald-500', data: sparklineData2 },
    { title: 'Active Deals', value: stats?.active_deals || 0, icon: Activity, trend: '-2.4%', trendIcon: ArrowDownRight, trendColor: 'text-rose-500', data: sparklineData3 },
    { title: 'Pending Review', value: stats?.pending_verification || 0, icon: Home, trend: '+18.1%', trendIcon: ArrowUpRight, trendColor: 'text-emerald-500', data: sparklineData4 }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full h-48 rounded-3xl overflow-hidden relative shadow-2xl mb-2 border border-border/50 flex justify-between items-start"
        style={{
          backgroundImage: 'url(/dashboard_banner.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 p-8 flex flex-col justify-center w-full md:w-2/3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] font-sans">LeaseLens Dashboard</h1>
          <p className="text-white/90 mt-2 font-medium max-w-xl text-lg drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]">
            Overview of your real estate portfolio, institutional analytics, and intelligent underwriting flows.
          </p>
        </div>
        <div className="relative z-10 p-8 ml-auto">
          <Button className="gap-2 shadow-lg shadow-primary/20 backdrop-blur-md bg-primary/90 hover:bg-primary text-primary-foreground border border-primary/50" onClick={() => navigate('/properties')}>
            <Plus className="w-4 h-4" /> Add Property
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="neu-flat border-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              <Card className="neu-flat border-none transition-all duration-300 hover:shadow-lg group cursor-default">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground font-mono uppercase">
                    {stat.title}
                  </CardTitle>
                  <div className="p-2.5 neu-pressed rounded-xl group-hover:bg-primary/5 transition-colors">
                    <stat.icon className="w-4 h-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-3xl font-extrabold tracking-tight">{stat.value}</div>
                      <p className={`text-xs mt-1.5 font-bold flex items-center gap-0.5 ${stat.trendColor}`}>
                        <stat.trendIcon className="w-3 h-3" /> {stat.trend} <span className="text-muted-foreground font-medium ml-1">vs last mo</span>
                      </p>
                    </div>
                    <div className="h-10 w-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stat.data}>
                          <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Featured Assets Section */}
      {!loading && stats?.top_properties?.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-black tracking-tight uppercase text-primary/80">Featured Portfolio Assets</h2>
              <p className="text-muted-foreground font-medium">Top performing institutional real estate in your portfolio.</p>
            </div>
            <Button variant="ghost" className="gap-2 font-bold hover:text-primary transition-all" onClick={() => navigate('/properties')}>
              View All Assets <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.top_properties.map((prop: any, idx: number) => (
              <motion.div
                key={prop.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="group cursor-pointer"
                onClick={() => navigate(`/properties/${prop.id}`)}
              >
                <Card className="overflow-hidden border-none neu-flat transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
                  <div className="aspect-video relative overflow-hidden rounded-t-xl">
                    <PropertyThumbnail photoUrls={prop.photo_urls || []} alt={prop.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute bottom-4 left-4 right-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-500 opacity-0 group-hover:opacity-100">
                      <p className="text-white font-bold text-lg leading-tight">{prop.name}</p>
                      <p className="text-white/70 text-xs font-medium">{prop.address}, {prop.city}</p>
                    </div>
                  </div>
                  <CardContent className="p-4 pt-4 flex justify-between items-center">
                    <div className="flex gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Units</span>
                        <span className="font-bold">{prop.unit_count}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Reports</span>
                        <span className="font-bold">{prop.deal_count || 0}</span>
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none neu-flat overflow-hidden">
          <CardHeader className="border-b-0 pb-4">
            <CardTitle className="text-base font-bold font-mono uppercase">Recent Intelligent Underwriting</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="flex gap-4">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/6" />
                    <Skeleton className="h-4 w-1/6" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-6 py-3.5">Document Name</th>
                      <th className="px-6 py-3.5">AI Category</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {stats?.recent_deals && stats.recent_deals.length > 0 ? (
                      stats.recent_deals.map((deal: any) => (
                        <tr key={deal.id} className="hover:bg-accent/30 transition-colors group cursor-pointer" onClick={() => navigate(`/properties`)}>
                          <td className="px-6 py-4 font-semibold">{deal.deal_name}</td>
                          <td className="px-6 py-4">
                             <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-2.5 py-1 rounded-full tracking-wider">Financial</span>
                          </td>
                          <td className="px-6 py-4">
                             <span className="flex items-center gap-1.5 capitalize font-medium">
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                                {deal.stage}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground font-medium">
                            {new Date(deal.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Activity className="w-8 h-8 text-muted-foreground/30" />
                            <p className="font-medium">No recent documents processed</p>
                            <p className="text-xs">Upload a rent roll to begin AI extraction.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none neu-flat overflow-hidden">
          <CardHeader className="border-b-0">
            <CardTitle className="text-base font-bold flex items-center gap-2 font-mono uppercase">
              <MessageSquare className="w-4 h-4 text-primary" /> Concierge Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-accent/50 text-sm border border-border/50 leading-relaxed">
                  <span className="font-bold text-primary">AI Concierge:</span>{' '}
                  All document extraction tasks are currently synchronized with the data room.
                </div>
                <Button variant="outline" className="w-full gap-2 font-semibold" onClick={() => navigate('/concierge')}>
                  Open Chat <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
