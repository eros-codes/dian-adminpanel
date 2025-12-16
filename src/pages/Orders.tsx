import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit, Eye, ChevronDown, ShoppingCart, Clock, CheckCircle, DollarSign, XCircle } from 'lucide-react';
import { apiService } from '@/services/api';
import { Order } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { exportOrdersToExcel } from '@/lib/exportExcel';

// Small measured collapse component: animates max-height + transform + opacity
function CollapseSection({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      el.style.transition = 'max-height 300ms ease, opacity 220ms ease, transform 300ms ease';
      if (open) {
        el.style.display = 'block';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        el.style.maxHeight = '0px';
        requestAnimationFrame(() => {
          const h = el.scrollHeight;
          el.style.maxHeight = h + 'px';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          el.style.overflow = 'auto';
        });
      } else {
        const h = el.scrollHeight;
        el.style.maxHeight = h + 'px';
        requestAnimationFrame(() => {
          el.style.maxHeight = '0px';
          el.style.opacity = '0';
          el.style.transform = 'translateY(-6px)';
          el.style.overflow = 'hidden';
        });
      }
    } catch (e) {
      // ignore
    }
  }, [open]);

  return (
    <div ref={ref} className="overflow-hidden max-h-0" aria-hidden={!open}>
      {children}
    </div>
  );
}

const Orders: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<Order['status'] | ''>('');
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const [orderInfoOpen, setOrderInfoOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Order['status'] | 'ALL'>('ALL');

  const { data, isLoading } = useQuery<{ data: Order[]; total: number }>({
    queryKey: ['orders'],
    queryFn: () => apiService.getOrders(),
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  const { mutateAsync: updateOrderStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: Order['status'] }) => {
      return apiService.updateOrderStatus(orderId, status);
    },
    onSuccess: () => {
      toast.success(t('orders.statusUpdated'));
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsStatusDialogOpen(false);
      setSelectedOrder(null);
      setNewStatus('');
    },
    onError: () => {
      toast.error('خطا در بروزرسانی وضعیت سفارش');
    },
  });

  const handleEditStatus = (order: Order) => {
    if (order.status === 'CANCELLED') {
      return;
    }
    setSelectedOrder(order);
    setNewStatus(order.status);
    setIsStatusDialogOpen(true);
  };

  const getPaymentBadgeClass = (method?: Order['paymentMethod'] | null): string => {
    if (!method) return 'bg-gray-100 text-gray-800 border border-gray-200';
    const value = String(method).toUpperCase();
    switch (value) {
      case 'COD':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'ONLINE':
        return 'bg-sky-100 text-sky-800 border border-sky-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const handleUpdateStatus = async () => {
    if (selectedOrder && newStatus) {
      if (newStatus === 'CANCELLED') {
        toast.error(t('orders.cannotCancelAdmin') || 'امکان لغو سفارش از پنل وجود ندارد');
        return;
      }
      await updateOrderStatus({ orderId: selectedOrder.id, status: newStatus as Order['status'] });
    }
  };

  const handleCloseStatusDialog = () => {
    setIsStatusDialogOpen(false);
    setSelectedOrder(null);
    setNewStatus('');
  };

  const statusOptions: Order['status'][] = ['CONFIRMED', 'DELIVERED', 'PAID'];

  useEffect(() => {
    if (statusFilter === 'PENDING') {
      setStatusFilter('ALL');
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedOrder || !data?.data) return;
    const latest = data.data.find((o) => o.id === selectedOrder.id);
    if (latest?.status === 'CANCELLED') {
      setIsStatusDialogOpen(false);
      setSelectedOrder(null);
      setNewStatus('');
    }
  }, [data?.data, selectedOrder]);

  const handleOpenDetails = async (order: Order) => {
    try {
      setIsDetailsDialogOpen(true);
      const full = await apiService.getOrderById(order.id);
      setSelectedOrder(full as Order);
      setOrderInfoOpen(true);
      setNotesOpen(false);
      setAnimateRows(false);
      setTimeout(() => setAnimateRows(true), 50);
    } catch (err: unknown) {
      toast.error('خطا در بارگذاری اطلاعات سفارش');
      console.error('Failed to load order details', err);
    }
  };

  const handleCloseDetails = () => {
    setIsDetailsDialogOpen(false);
    setSelectedOrder(null);
    setAnimateRows(false);
  };

  const [animateRows, setAnimateRows] = useState(false);
  useEffect(() => {
    if (isDetailsDialogOpen) {
      setAnimateRows(false);
      const id = setTimeout(() => setAnimateRows(true), 50);
      return () => clearTimeout(id);
    }
    setAnimateRows(false);
  }, [isDetailsDialogOpen]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  const allOrders: Order[] = data?.data || [];
  const statusFilteredOrders = statusFilter === 'ALL'
    ? allOrders
    : allOrders.filter((o) => o.status === statusFilter);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOrders = normalizedSearch
    ? statusFilteredOrders.filter((o) => o.id.toLowerCase().includes(normalizedSearch))
    : statusFilteredOrders;
  const locale = i18n.language === 'fa' ? 'fa' : 'en';

  const confirmedCount = allOrders.filter((o) => o.status === 'CONFIRMED').length;
  const deliveredCount = allOrders.filter((o) => o.status === 'DELIVERED').length;
  const paidCount = allOrders.filter((o) => o.status === 'PAID').length;
  const cancelledCount = allOrders.filter((o) => o.status === 'CANCELLED').length;

  const getStatusKey = (status?: Order['status'] | null): string => {
    if (!status) return 'unknown';
    try {
      return String(status).toLowerCase();
    } catch {
      return 'unknown';
    }
  };

  const getStatusBadgeClass = (status?: Order['status'] | null): string => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'CONFIRMED':
        return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'DELIVERED':
        return 'bg-sky-100 text-sky-800 border border-sky-200';
      case 'PAID':
        return 'bg-emerald-200 text-emerald-900 border border-emerald-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('orders.title')}</h1>
        <div className="flex items-center gap-3 overflow-x-auto mt-2">
          {[
            {
              key: 'ALL' as const,
              label: 'همه سفارش‌ها',
              count: allOrders.length,
              icon: ShoppingCart,
              colorClass: 'text-blue-500',
            },
            {
              key: 'CONFIRMED' as const,
              label: 'در حال آماده‌سازی',
              count: confirmedCount,
              icon: Clock,
              colorClass: 'text-indigo-600',
            },
            {
              key: 'DELIVERED' as const,
              label: 'تحویل شده',
              count: deliveredCount,
              icon: CheckCircle,
              colorClass: 'text-sky-600',
            },
            {
              key: 'PAID' as const,
              label: 'تسویه شده',
              count: paidCount,
              icon: DollarSign,
              colorClass: 'text-emerald-700',
            },
            {
              key: 'CANCELLED' as const,
              label: 'لغو شده',
              count: cancelledCount,
              icon: XCircle,
              colorClass: 'text-red-600',
            },
          ].map(({ key, label, count, icon: Icon, colorClass }) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              onClick={() => setStatusFilter(key)}
              title={label}
              aria-label={label}
              className={`h-11 px-3 flex items-center gap-2 rounded-full transition-colors ${
                statusFilter === key ? 'border-primary bg-primary/10' : ''
              }`}
            >
              <Icon className={`h-5 w-5 ${colorClass}`} />
              <span className="text-sm font-semibold text-foreground">{count}</span>
              <span className="sr-only">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('orders.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <div className="mb-4 flex items-center gap-2">
              <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder={t('orders.searchById') as string} className={i18n.language === 'fa' ? 'text-right w-full max-w-sm' : 'text-left w-full max-w-sm'} />
              <Button variant="outline" onClick={() => exportOrdersToExcel(filteredOrders, { locale: i18n.language === 'fa' ? 'fa' : 'en', fileName: `orders-${new Date().toISOString().slice(0,10)}.xlsx` })}>{t('orders.exportExcel')}</Button>
            </div>

            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t('orders.orderNumber')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('orders.customer')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('common.amount')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('orders.paymentMethod.title')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('common.status')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('common.date')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.id}</TableCell>
                      <TableCell>میز {o.tableNumber}</TableCell>
                      <TableCell>{formatCurrency(o.totalAmount, locale)}</TableCell>
                      <TableCell>{(() => {
                        const pm = o.paymentMethod;
                        if (!pm) return '-';
                        const up = String(pm).toUpperCase();
                        if (up === 'COD') {
                          return (
                            <Badge className={getPaymentBadgeClass(pm)}>
                              {t('orders.paymentMethod.cod', { defaultValue: locale === 'fa' ? 'پرداخت در صندوق' : 'Cash on Delivery' })}
                            </Badge>
                          );
                        }
                        if (up === 'ONLINE') {
                          return (
                            <Badge className={getPaymentBadgeClass(pm)}>
                              {t('orders.paymentMethod.online', { defaultValue: locale === 'fa' ? 'پرداخت آنلاین' : 'Online Payment' })}
                            </Badge>
                          );
                        }
                        return <Badge className={getPaymentBadgeClass(pm)}>{String(pm)}</Badge>;
                      })()}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeClass(o.status)}>
                            {t(`orders.${getStatusKey(o.status)}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US') : '-'}
                        </TableCell>
                        <TableCell className="space-x-2 rtl:space-x-reverse">
                          <Button variant="outline" size="sm" onClick={() => handleOpenDetails(o)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditStatus(o)}
                            disabled={o.status === 'CANCELLED'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </div>

            {/* Mobile/card view */}
            <div className="sm:hidden space-y-3">
              {filteredOrders.map((o) => (
                <div key={o.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium break-all">{o.id}</div>
                    <div>{o.createdAt ? new Date(o.createdAt).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US') : '-'}</div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">میز {o.tableNumber}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm">{t('common.amount')}</div>
                      <div className="font-medium">{formatCurrency(o.totalAmount, locale)}</div>
                    </div>
                    <div>
                      <Badge className={getStatusBadgeClass(o.status)}>
                        {t(`orders.${getStatusKey(o.status)}`)}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDetails(o)} aria-label={t('common.view') as string}>
                      <Eye className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">{t('common.view')}</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditStatus(o)} aria-label={t('common.edit') as string}>
                      <Edit className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">{t('common.edit')}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {filteredOrders.length === 0 && (
              <div className="text-center text-muted-foreground py-8">{t('common.noData')}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('orders.editStatus')}</DialogTitle>
              <DialogDescription>در این دیالوگ می‌توانید وضعیت سفارش را تغییر دهید.</DialogDescription>
            </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('orders.orderNumber')}</label>
                <p>{selectedOrder.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium">{t('orders.currentStatus')}</label>
                <Badge className={getStatusBadgeClass(selectedOrder.status)}>
                  {t(`orders.${getStatusKey(selectedOrder.status)}`)}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium">{t('orders.newStatus')}</label>
                <Select value={newStatus} onValueChange={(value) => setNewStatus(value as Order['status'])}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('orders.selectStatus')} />
                  </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`orders.${getStatusKey(status)}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseStatusDialog}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isUpdatingStatus || !newStatus}>
              {isUpdatingStatus ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('orders.orderDetails')}</DialogTitle>
            <DialogDescription>جزئیات سفارش در اینجا نمایش داده می‌شود.</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            // Cap dialog inner height and make content scrollable so dialog doesn't grow
            // beyond the viewport. Individual collapsible sections below will animate
            // by measuring their inner content height.
            <div className="space-y-6 max-h-[70vh] overflow-auto pr-2">
              {/* Order Info (custom animated) */}
              <div className="border rounded-lg">
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="font-medium">اطلاعات سفارش</div>
                  <Button variant="ghost" size="sm" aria-label="toggle-order-info" onClick={() => setOrderInfoOpen((s) => !s)}>
                    <ChevronDown className={orderInfoOpen ? 'h-4 w-4 transform rotate-180 transition-transform duration-200' : 'h-4 w-4 transition-transform duration-200'} />
                  </Button>
                </div>
                <CollapseSection open={orderInfoOpen}>
                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">{t('orders.orderNumber')}</div>
                        <div className="font-medium break-all">{selectedOrder.id}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">شماره میز</div>
                        <div className="font-medium">میز {selectedOrder.tableNumber}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t('common.status')}</div>
                        <div>
                          <Badge>{t(`orders.${getStatusKey(selectedOrder.status)}`)}</Badge>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t('orders.paymentMethod.title')}</div>
                        <div className="font-medium">{(() => {
                          const pm = selectedOrder.paymentMethod;
                          if (!pm) return '-';
                          const up = String(pm).toUpperCase();
                          if (up === 'COD') return t('orders.paymentMethod.cod') || 'پرداخت در صندوق';
                          if (up === 'ONLINE') return t('orders.paymentMethod.online') || 'پرداخت آنلاین';
                          return pm;
                        })()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">کد رهگیری</div>
                        <div className="font-medium">{selectedOrder.trackingCode ?? '-'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t('common.amount')}</div>
                        <div className="font-medium">{formatCurrency(selectedOrder.totalAmount, locale)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t('common.date')}</div>
                        <div className="font-medium">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US') : '-'}</div>
                      </div>
                    </div>
                  </div>
                </CollapseSection>
              </div>

              {/* Notes (no icon in admin header as requested) */}
              <div className="border rounded-lg">
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="font-medium">توضیحات</div>
                  <Button variant="ghost" size="sm" aria-label="toggle-notes" onClick={() => setNotesOpen((s) => !s)}>
                    <ChevronDown className={notesOpen ? 'h-4 w-4 transform rotate-180 transition-transform duration-200' : 'h-4 w-4 transition-transform duration-200'} />
                  </Button>
                </div>
                <CollapseSection open={notesOpen}>
                  <div className="p-4 text-sm">{selectedOrder.notes || '-'}</div>
                </CollapseSection>
              </div>

              {/* Items (always visible) */}
              <div>
                <div className="text-base font-semibold mb-2">{t('orders.items')}</div>
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t('products.productName')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('orders.itemOptions')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('common.quantity')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('common.price')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('common.total')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((it, idx) => (
                        <TableRow
                          key={it.id}
                          className="transform will-change-transform"
                          style={{
                            opacity: animateRows ? 1 : 0,
                            transform: animateRows ? 'translateY(0)' : 'translateY(-8px)',
                            transitionProperty: 'opacity, transform',
                            transitionDuration: '360ms',
                            transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)',
                            transitionDelay: `${idx * 40}ms`,
                          }}
                        >
                          <TableCell>{it.productName || it.productId}</TableCell>
                          <TableCell>
                            {Array.isArray(it.options) && it.options.length > 0 ? (
                              <ul className="space-y-1 text-xs text-muted-foreground">
                                {it.options.map((opt, optionIdx) => (
                                  <li key={`${opt.id ?? `${it.id}-${optionIdx}`}`} className="flex items-center justify-between gap-2">
                                    <span>{opt.name}</span>
                                    <span>{formatCurrency(opt.additionalPrice ?? 0, locale)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{it.quantity}</TableCell>
                          <TableCell>{formatCurrency(it.unitPrice ?? it.price ?? 0, locale)}</TableCell>
                          <TableCell>{formatCurrency(it.totalPrice ?? (it.unitPrice ?? it.price ?? 0) * it.quantity, locale)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDetails}>{t('common.close')}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;


