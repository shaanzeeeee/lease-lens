import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Skeleton } from '../components/ui/components';
import { apiClient } from '../api/client';
import { Building2, Home, Activity, TrendingUp, Plus, ArrowRight, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

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

  const statCards = [
    { title: 'Total Properties', value: stats?.total_properties || 0, icon: Building2, trend: '+2 this month', color: 'primary' },
    { title: 'Portfolio Docs', value: stats?.total_documents || 0, icon: TrendingUp, trend: '98% indexed', color: 'blue-500' },
    { title: 'Active Deals', value: stats?.active_deals || 0, icon: Activity, trend: 'In underwriting', color: 'green-500' },
    { title: 'Pending Review', value: stats?.pending_verification || 0, icon: Home, trend: 'Verification queue', color: 'orange-500' }
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Institutional Dashboard</h1>
          <p className="text-muted-foreground mt-1 font-medium">Overview of your real estate portfolio and recent underwriting activities.</p>
        </div>
        <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => navigate('/properties')}>
          <Plus className="w-4 h-4" /> Add Property
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="bg-card/50 backdrop-blur-sm border-primary/10">
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
              <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group cursor-default">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/15 transition-colors">
                    <stat.icon className="w-4 h-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold tracking-tight">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1.5 font-semibold">{stat.trend}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base font-bold">Recent Intelligent Structuring</CardTitle>
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

        <Card className="border-none shadow-xl bg-gradient-to-br from-primary/5 to-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="text-base font-bold flex items-center gap-2">
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
                  You have a new notification regarding the NOI mismatch in "Evaluation Fonciere.pdf".
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
