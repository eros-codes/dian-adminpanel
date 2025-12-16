import { writeFile, utils, WorkBook } from 'xlsx';
import { Order } from '@/types';

type ExportOptions = {
  fileName?: string;
  locale?: 'fa' | 'en';
};

const formatDate = (iso?: string | Date, locale: 'fa' | 'en' = 'en') => {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  try {
    return d.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US');
  } catch {
    return d.toISOString();
  }
};

const formatAmount = (amt?: number) => (typeof amt === 'number' ? amt : 0);

export const exportOrdersToExcel = (orders: Order[], opts: ExportOptions = {}) => {
  const { fileName = 'orders.xlsx', locale = 'en' } = opts;

  const rows = orders.map((o) => {
    // Treat order as partial runtime object — avoid broad `any` but allow unknown fields
    const ox = o as Partial<Order> & Record<string, any>;
    return {
      ...(locale === 'fa'
        ? {
            'شناسه سفارش': ox.id,
            'مشتری': ox.userName || (ox as any).userId || '-',
            'وضعیت': ox.status,
            'روش پرداخت': ox.paymentMethod ?? '-',
            'کد رهگیری': ox.trackingCode ?? '-',
            'مبلغ کل': formatAmount(ox.totalAmount),
            'تاریخ': formatDate(ox.createdAt, locale),
            'شهر ارسال': ox.shippingAddress?.city ?? '-',
            'استان ارسال': ox.shippingAddress?.province ?? '-',
            'خیابان ارسال': ox.shippingAddress?.street ?? '-',
            'کدپستی ارسال': ox.shippingAddress?.postalCode ?? '-',
            'تلفن ارسال': ox.shippingAddress?.phone ?? '-',
            'آیتم‌ها': (ox.items || []).map((it: any) => {
              const base = `${it.productName || it.productId} x${it.quantity}`;
              if (Array.isArray(it.options) && it.options.length > 0) {
                const opts = it.options.map((op: any) => `${op.name}${(op.additionalPrice || 0) ? `+${op.additionalPrice}` : ''}`).join(', ');
                return `${base} (${opts})`;
              }
              return base;
            }).join('; '),
          }
        : {
            OrderId: ox.id,
            Customer: ox.userName || (ox as any).userId || '-',
            Status: ox.status,
            PaymentMethod: ox.paymentMethod ?? '-',
            TrackingCode: ox.trackingCode ?? '-',
            TotalAmount: formatAmount(ox.totalAmount),
            CreatedAt: formatDate(ox.createdAt, locale),
            ShippingCity: ox.shippingAddress?.city ?? '-',
            ShippingProvince: ox.shippingAddress?.province ?? '-',
            ShippingStreet: ox.shippingAddress?.street ?? '-',
            ShippingPostalCode: ox.shippingAddress?.postalCode ?? '-',
            ShippingPhone: ox.shippingAddress?.phone ?? '-',
            Items: (ox.items || []).map((it: any) => {
              const base = `${it.productName || it.productId} x${it.quantity}`;
              if (Array.isArray(it.options) && it.options.length > 0) {
                const opts = it.options.map((op: any) => `${op.name}${(op.additionalPrice || 0) ? `+${op.additionalPrice}` : ''}`).join(', ');
                return `${base} (${opts})`;
              }
              return base;
            }).join('; '),
          }),
    };
  });

  const ws = utils.json_to_sheet(rows);
  // Auto-width columns based on header length (simple heuristic)
  const cols = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.min(Math.max(k.length, 10), 60) }));
  ws['!cols'] = cols;

  const wb: WorkBook = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Orders');

  // writeFile will trigger download in browser
  writeFile(wb, fileName);
};

export default exportOrdersToExcel;
