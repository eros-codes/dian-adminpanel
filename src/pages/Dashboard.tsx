import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import StatsCard from '@/components/Dashboard/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart, 
  DollarSign, 
  Plus,
  Package,
  Users,
  FolderTree,
  TrendingUp,
  Loader2,
  AlertCircle,
  Image,
  BarChart,
  MessageSquare
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { formatCurrency, formatNumberLocale } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Fetch dashboard stats
  const { 
    data: dashboardStats,
    isLoading: statsLoading,
    isError: statsError 
  } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      console.log('Fetching dashboard stats...');
      const result = await apiService.getDashboardStats();
      console.log('Dashboard API response:', result);
      return result;
    },
    retry: 2,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent orders (fallback data for charts if metrics unavailable)
  const { 
    data: ordersData, 
    isLoading: ordersLoading, 
    isError: ordersError 
  } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: () => apiService.getOrders({ take : 30 }),
    retry: 2,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch monthly metrics for dashboard (orders, revenue, returns) current vs previous month
  const { data: monthlyMetrics } = useQuery({
    queryKey: ['admin', 'metrics-monthly'],
    queryFn: () => apiService.getMonthlyMetrics(),
    retry: 2,
    refetchInterval: 30000,
  });

  // Fetch comments for summary widget
  const { data: commentsSummary } = useQuery({
    queryKey: ['admin', 'comments', 'all-summary'],
    queryFn: async () => {
      const res = await apiService.getAllComments();
      return res;
    },
    retry: 2,
    refetchInterval: 30000,
  });

  const buildSalesData = (orders: Array<{ createdAt?: string | Date; totalAmount?: number }>, locale: 'fa' | 'en') => {
    const buckets = new Map<string, number>();
    for (const o of orders) {
      if (!o.createdAt) continue;
      const d = new Date(o.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      buckets.set(key, (buckets.get(key) || 0) + (o.totalAmount || 0));
    }
    const entries = Array.from(buckets.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    // Keep last 14 days for readability
    const sliced = entries.slice(-14);
    return sliced.map(([key, amount]) => ({
      date: new Date(key).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US'),
      amount,
    }));
  };

  // Loading component
  if (ordersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('navigation.dashboard')}</h1>
            <p className="text-muted-foreground">{t('dashboard.overview')}</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error component
  if (ordersError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('navigation.dashboard')}</h1>
            <p className="text-muted-foreground">{t('dashboard.overview')}</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-muted-foreground">{t('dashboard.loadError')}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              {t('common.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats (exclude CANCELLED everywhere)
  // Lightweight runtime type for orders used in dashboard widgets
  type DashboardOrder = { id: string; status?: string | null; totalAmount?: number; userName?: string | null; userId?: string | null };
  const recentOrders = (ordersData?.data ?? []) as DashboardOrder[];
  const recentOrdersVisible = recentOrders.filter((o) => ((o.status ?? '') as string).toUpperCase() !== 'CANCELLED');
  const totalOrdersFallback = recentOrdersVisible.length;
  const totalRevenueFallback = recentOrdersVisible.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const locale = i18n.language === 'fa' ? 'fa' : 'en';
  const salesData = buildSalesData(recentOrdersVisible, locale);

  // Helper to build trend from metrics
  const buildTrend = (current: number, previous: number) => {
    if (previous <= 0) {
      if (current <= 0) return { value: 0, isPositive: true };
      return { value: 100, isPositive: true };
    }
    const delta = ((current - previous) / previous) * 100;
    const rounded = Math.round(delta);
    return { value: Math.abs(rounded), isPositive: delta >= 0 };
  };

  const ordersValue = monthlyMetrics?.orders?.current ?? totalOrdersFallback;
  const ordersTrend = monthlyMetrics?.orders
    ? buildTrend(monthlyMetrics.orders.current ?? 0, monthlyMetrics.orders.previous ?? 0)
    : undefined;

  const revenueValueRaw = monthlyMetrics?.revenue?.current ?? totalRevenueFallback;
  const revenueTrend = monthlyMetrics?.revenue
    ? buildTrend(monthlyMetrics.revenue.current ?? 0, monthlyMetrics.revenue.previous ?? 0)
    : undefined;

  console.log('Full Dashboard Response:', JSON.stringify(dashboardStats, null, 2));

  // Build comments total count
  type AdminComment = { id: string; adminReply?: string | null; isReplied?: boolean };
  const commentsList: AdminComment[] = Array.isArray(commentsSummary)
    ? (commentsSummary as AdminComment[])
    : ((commentsSummary as any)?.data ?? (commentsSummary as any)?.items ?? []);
  const totalComments = commentsList.length;

  // Loading state
  if (statsLoading || ordersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('navigation.dashboard')}</h1>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (statsError || ordersError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('navigation.dashboard')}</h1>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-destructive">Error loading dashboard data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('navigation.dashboard')}</h1>
          <p className="text-muted-foreground">{t('dashboard.overview')}</p>
        </div>
        <div className="flex gap-2">
          <Button className="w-full sm:w-auto" onClick={() => navigate('/products')}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('products.addProduct')}</span>
            <span className="sm:hidden">{t('products.addProduct')}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('common.orders')}
          value={ordersValue}
          icon={ShoppingCart}
          trend={ordersTrend}
          className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20"
        />
        <StatsCard
          title={t('common.revenue')}
          value={formatCurrency(revenueValueRaw, locale)}
          icon={DollarSign}
          trend={revenueTrend}
          className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20"
        />
        <div onClick={() => navigate('/comments')} className="cursor-pointer">
          <StatsCard
            title={t('navigation.comments')}
            value={totalComments}
            icon={MessageSquare}
            className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20"
          />
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Sales Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('dashboard.salesChart')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={(value) => `${formatNumberLocale(Math.round((value as number) / 1_000_000), locale)}${locale === 'fa' ? 'م' : 'M'}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value, locale), t('common.revenue')]}
                    labelStyle={{ color: '#666' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    dot={{ fill: '#2563eb', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentOrders')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrdersVisible.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('dashboard.noOrders')}</p>
                </div>
              ) : (
                // Show only the five most recent orders in the dashboard widget
                recentOrdersVisible.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex-1">
                      <div className="font-medium">#{order.id}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.userName || order.userId || t('dashboard.unknownUser')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {formatCurrency(order.totalAmount ?? 0, locale)}
                      </div>
                        <Badge className={(() => {
                        const s = String(order.status ?? '').toUpperCase();
                        switch (s) {
                          case 'PENDING':
                            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
                          case 'CONFIRMED':
                            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
                          case 'SHIPPED':
                            return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
                          case 'DELIVERED':
                            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
                          case 'CANCELLED':
                            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
                          default:
                            return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
                        }
                      })()}>
                        {(() => {
                          const statusKey = String(order.status ?? '').toLowerCase();
                          return statusKey ? t(`orders.${statusKey}`) : t('orders.unknown');
                        })()}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate('/products')}>
              <Package className="h-6 w-6" />
              <span>{t('products.addProduct')}</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate('/categories')}>
              <FolderTree className="h-6 w-6" />
              <span>{t('navigation.categories')}</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate('/orders')}>
              <ShoppingCart className="h-6 w-6" />
              <span>{t('dashboard.viewOrders')}</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate('/users')}>
              <Users className="h-6 w-6" />
              <span>{t('dashboard.manageUsers')}</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate('/banners')}>
              <Image className="h-6 w-6" />
              <span>{t('navigation.banners')}</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate('/sales-report')}>
              <BarChart className="h-6 w-6" />
              <span>{t('navigation.salesReport')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;