import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui/components';
import { apiClient } from '../api/client';
import { Building2, Home, Activity, TrendingUp, Plus } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    { title: 'Total Properties', value: stats?.total_properties || 0, icon: Building2, trend: '+2 this month' },
    { title: 'Portfolio Docs', value: stats?.total_documents || 0, icon: TrendingUp, trend: '98% indexed' },
    { title: 'Active Deals', value: stats?.active_deals || 0, icon: Activity, trend: 'In underwriting' },
    { title: 'Pending Review', value: stats?.pending_verification || 0, icon: Home, trend: 'Verification queue' }
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Institutional Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your real estate portfolio and recent underwriting activities.</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/properties')}>
          <Plus className="w-4 h-4" /> Add Property
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="p-2 bg-primary/10 rounded-lg">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Intelligent Structuring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3 font-medium">Document Name</th>
                    <th className="px-6 py-3 font-medium">AI Category</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats?.recent_deals && stats.recent_deals.length > 0 ? (
                    stats.recent_deals.map((deal: any) => (
                      <tr key={deal.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{deal.deal_name}</td>
                        <td className="px-6 py-4">
                           <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">Financial</span>
                        </td>
                        <td className="px-6 py-4">
                           <span className="flex items-center gap-1.5 capitalize">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              {deal.stage}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(deal.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        No recent documents processed. Upload a rent roll to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Concierge Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-lg bg-accent/50 text-sm border border-border/50">
                <span className="font-semibold text-primary">AI Concierge:</span> You have a new notification regarding the NOI mismatch in "Evaluation Fonciere.pdf".
              </div>
              <Button variant="outline" className="w-full">Open Chat</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
