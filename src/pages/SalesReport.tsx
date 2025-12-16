import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { exportJsonToExcel } from '@/lib/exportJson';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
// SalesDataRow import removed to avoid unused-type issues in quick fix

// Reliable Jalali (Shamsi) -> Gregorian converter (ported from jalaali-js)
function div(a: number, b: number) { return (a / b) | 0; }
function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  jy = jy - 979;
  jm = jm - 1;
  jd = jd - 1;

  let j_day_no = 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4);
  for (let i = 0; i < jm; ++i) j_day_no += (i < 6) ? 31 : 30;
  j_day_no += jd;

  let g_day_no = j_day_no + 79;

  let gy = 1600 + 400 * div(g_day_no, 146097);
  g_day_no = g_day_no % 146097;

  let leap = true;
  if (g_day_no >= 36525) {
    g_day_no--;
    gy += 100 * div(g_day_no, 36524);
    g_day_no = g_day_no % 36524;
    if (g_day_no >= 365) g_day_no++; else leap = false;
  }

  gy += 4 * div(g_day_no, 1461);
  g_day_no %= 1461;

  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy += div(g_day_no, 365);
    g_day_no = g_day_no % 365;
  }

  const gdMonthDays = [31, (leap ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && g_day_no >= gdMonthDays[gm]) {
    g_day_no -= gdMonthDays[gm];
    gm++;
  }
  const gd = g_day_no + 1;
  return [gy, gm + 1, gd];
}

function parseJalaliDateString(s: string): [number, number, number] | null {
  // Accept formats: YYYY/MM/DD or YYYY-MM-DD (fa digits or latin)
  const normalized = s.replace(/[\u06F0-\u06F9]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
  const m = normalized.match(new RegExp('^(\\d{4})(?:/|-)(\\d{1,2})(?:/|-)(\\d{1,2})$'));
  if (!m) return null;
  const jy = parseInt(m[1], 10);
  const jm = parseInt(m[2], 10);
  const jd = parseInt(m[3], 10);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return [jy, jm, jd];
}

function toGregorianISO(s: string): string | undefined {
  const parts = parseJalaliDateString(s);
  if (!parts) return undefined;
  const [gy, gm, gd] = jalaliToGregorian(parts[0], parts[1], parts[2]);
  const mm = String(gm).padStart(2, '0');
  const dd = String(gd).padStart(2, '0');
  return `${gy}-${mm}-${dd}`;
}

export default function SalesReport() {
  const { t, i18n } = useTranslation();
  const [fromJ, setFromJ] = useState<string>('');
  const [toJ, setToJ] = useState<string>('');

  const fromG = useMemo(() => toGregorianISO(fromJ), [fromJ]);
  const toG = useMemo(() => toGregorianISO(toJ), [toJ]);

  const query = useQuery({
    queryKey: ['sales-summary', fromG, toG],
    queryFn: async () => await apiService.getSalesSummary(fromG || undefined, toG || undefined),
    retry: false,
  });

  const { mutateAsync: resetSales, isPending: isResetting } = useMutation({
    mutationFn: async () => apiService.resetSales(),
    onSuccess: async (_resp: Record<string, unknown>) => {
      // After successful reset, refetch the summary to keep UI consistent
      await query.refetch();
    }
  });

  const { mutateAsync: clearAllResets, isPending: isClearing } = useMutation({
    mutationFn: async () => apiService.clearResets(),
    onSuccess: async () => {
      await query.refetch();
    }
  });

  type SalesRow = { product?: { name?: string } | null; productId?: string; soldQuantity?: number; totalRevenue?: number | string; options?: string[] };
  const data: SalesRow[] = Array.isArray(query.data) ? (query.data as SalesRow[]) : [];
  const totalQuantity = data.reduce((s: number, item: SalesRow) => s + ((item.soldQuantity as number) || 0), 0);
  const totalRevenue = data.reduce((s: number, item: SalesRow) => s + (Number(item.totalRevenue) || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('salesReport.title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('salesReport.filter')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => resetSales()} disabled={isResetting}>
                {t('salesReport.reset')}
              </Button>
              <Button variant="ghost" onClick={() => clearAllResets()} disabled={isClearing}>
                {t('salesReport.clearAll')}
              </Button>
                <Button variant="outline" onClick={() => {
                const lang = i18n?.language || 'fa';
                const l = lang === 'fa' ? 'fa' : 'en';
                const rows = (data || []).map((r: any) => ({
                  [l === 'fa' ? 'محصول' : 'Product']: (r as any).product?.name ?? (r as any).productId,
                  [l === 'fa' ? 'تعداد فروش' : 'Sold Quantity']: (r as any).soldQuantity ?? 0,
                  [l === 'fa' ? 'مجموع درآمد' : 'Total Revenue']: Number((r as any).totalRevenue) || 0,
                  [l === 'fa' ? 'افزودنی‌ها' : 'Options']: Array.isArray(r.options) ? (r.options as string[]).join(', ') : '',
                }));
                // append totals row
                const totalQuantity = (data || []).reduce((s: number, it: Record<string, unknown>) => s + ((it.soldQuantity as number) || 0), 0);
                const totalRevenue = (data || []).reduce((s: number, it: Record<string, unknown>) => s + (Number(it.totalRevenue) || 0), 0);
                rows.push({
                  [l === 'fa' ? 'محصول' : 'Product']: l === 'fa' ? 'جمع' : 'Total',
                  [l === 'fa' ? 'تعداد فروش' : 'Sold Quantity']: totalQuantity,
                  [l === 'fa' ? 'مجموع درآمد' : 'Total Revenue']: totalRevenue,
                  [l === 'fa' ? 'افزودنی‌ها' : 'Options']: '',
                });
                exportJsonToExcel(rows, { fileName: `sales-report-${new Date().toISOString().slice(0,10)}.xlsx`, sheetName: l === 'fa' ? 'گزارش' : 'Report' });
              }}>
                {t('salesReport.exportExcel')}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex flex-col">
                <label className="text-sm">{t('salesReport.fromDate')}</label>
                <Input dir="ltr" inputMode="numeric" placeholder="1403/01/01" value={fromJ} onChange={(e) => setFromJ(e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label className="text-sm">{t('salesReport.toDate')}</label>
                <Input dir="ltr" inputMode="numeric" placeholder="1403/12/29" value={toJ} onChange={(e) => setToJ(e.target.value)} />
              </div>
              <div>
                <Button onClick={() => { console.log('SalesReport filter params', { fromJ, toJ, fromG, toG }); query.refetch(); }}>
                  {t('salesReport.filterBtn')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('salesReport.summary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('salesReport.product')}</TableHead>
                  <TableHead>{t('salesReport.soldQuantity')}</TableHead>
                  <TableHead>{t('salesReport.totalRevenue')}</TableHead>
                  <TableHead>{i18n.language === 'fa' ? 'افزودنی‌ها' : 'Options'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell>{row.product?.name ?? row.productId}</TableCell>
                    <TableCell>{row.soldQuantity ?? 0}</TableCell>
                    <TableCell>{formatCurrency(Number(row.totalRevenue) || 0, 'fa')}</TableCell>
                    <TableCell className="max-w-sm truncate">
                      {(row.options && row.options.length > 0) ? (row.options as string[]).join(', ') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {(data || []).length === 0 && (
              <div className="text-center text-muted-foreground py-8">{t('salesReport.noData')}</div>
            )}

            <div className="mt-4 flex justify-end gap-6">
              <div className="text-sm">{t('salesReport.totalQuantity')}: <strong>{totalQuantity}</strong></div>
              <div className="text-sm">{t('salesReport.totalRevenueLabel')}: <strong>{formatCurrency(totalRevenue, 'fa')}</strong></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
