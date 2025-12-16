import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type FS = { id: number; key: string; title: string; url?: string | null };

export default function FooterSettingsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data: items = [] } = useQuery<FS[]>({
    queryKey: ['footer-settings'],
    queryFn: () => apiService.getFooterSettings(),
    staleTime: 60_000,
  });

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ key: string; title: string; url: string | null }>({ key: '', title: '', url: '' });

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<FS | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; url: string | null }>({ title: '', url: '' });

  const numericKeys = useMemo(() => new Set(['fee', 'tax']), []);
  const discountKey = 'bulk_discount';

  const isNumericAddKey = numericKeys.has(addForm.key);
  const isDiscountAddKey = addForm.key === discountKey;
  const addTitlePlaceholder = (() => {
    if (addForm.key === 'fee') return t('footerSettings.dialog.feePlaceholder');
    if (addForm.key === 'tax') return t('footerSettings.dialog.taxPlaceholder');
    if (isDiscountAddKey) return 'حداقل مبلغ خرید (تومان)';
    return t('footerSettings.dialog.titlePlaceholder');
  })();
  const showAddUrlInput = !isNumericAddKey || isDiscountAddKey;
  const addUrlPlaceholder = isDiscountAddKey ? 'درصد تخفیف (٪)' : t('footerSettings.dialog.urlPlaceholder');

  const editKey = editing?.key ?? '';
  const isNumericEditKey = numericKeys.has(editKey);
  const isDiscountEditKey = editKey === discountKey;
  const editTitlePlaceholder = (() => {
    if (editKey === 'fee') return t('footerSettings.dialog.feePlaceholder');
    if (editKey === 'tax') return t('footerSettings.dialog.taxPlaceholder');
    if (isDiscountEditKey) return 'حداقل مبلغ خرید (تومان)';
    return t('footerSettings.dialog.titlePlaceholder');
  })();
  const showEditUrlInput = !isNumericEditKey || isDiscountEditKey;
  const editUrlPlaceholder = isDiscountEditKey ? 'درصد تخفیف (٪)' : t('footerSettings.dialog.urlPlaceholder');

  const createMut = useMutation({
    mutationFn: () => apiService.createFooterSetting({ key: addForm.key, title: addForm.title, url: showAddUrlInput ? addForm.url || null : null }),
    onSuccess: () => {
      toast.success(t('footerSettings.toast.createSuccess'));
      setAddForm({ key: '', title: '', url: '' });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['footer-settings'] });
    },
    onError: (e: unknown) => toast.error((e as any)?.response?.data?.message || t('footerSettings.toast.createError')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { title?: string; url?: string | null } }) => apiService.updateFooterSetting(id, payload),
    onSuccess: () => {
      toast.success(t('footerSettings.toast.updateSuccess'));
      setEditOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['footer-settings'] });
    },
    onError: (e: unknown) => toast.error((e as any)?.response?.data?.message || t('footerSettings.toast.updateError')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiService.deleteFooterSetting(id),
    onSuccess: () => {
      toast.success(t('footerSettings.toast.deleteSuccess'));
      qc.invalidateQueries({ queryKey: ['footer-settings'] });
    },
    onError: (e: unknown) => toast.error((e as any)?.response?.data?.message || t('footerSettings.toast.deleteError')),
  });

  const isAddConfirmDisabled = !addForm.key || !addForm.title || createMut.isPending || (isDiscountAddKey && !(addForm.url && addForm.url.trim().length));
  const isEditConfirmDisabled = !editing || updateMut.isPending || (isDiscountEditKey && !(editForm.url && editForm.url.trim().length));

  return (
    <div className="space-y-6" dir={i18n.language === 'fa' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('footerSettings.title')}</h1>
        <Button onClick={() => setAddOpen(true)}>{t('footerSettings.addButton')}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('footerSettings.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('footerSettings.table.key')}</TableHead>
                <TableHead>{t('footerSettings.table.title')}</TableHead>
                <TableHead>{t('footerSettings.table.url')}</TableHead>
                <TableHead className="w-[200px]">{t('footerSettings.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-xs">{it.key}</TableCell>
                    <TableCell className="truncate max-w-[360px]" title={it.title} style={{ direction: 'ltr', textAlign: 'left' }}>{it.title}</TableCell>
                    <TableCell className="truncate max-w-[360px]" title={it.url ?? ''} style={{ direction: 'ltr', textAlign: 'left' }}>{numericKeys.has(it.key) ? '-' : (it.url ?? '-')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(it);
                            setEditForm({ title: it.title, url: it.url ?? '' });
                            setEditOpen(true);
                          }}
                          title={t('footerSettings.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteMut.mutate(it.id)}
                          title={t('footerSettings.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">{t('footerSettings.empty')}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="ltr" className="text-left">
          <DialogHeader className="text-left">
            <DialogTitle className="text-left">{t('footerSettings.dialog.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-left">{t('footerSettings.dialog.keyLabel')}</label>
              <Select
                value={addForm.key}
                onValueChange={(v) =>
                  setAddForm((s) => ({
                    key: v,
                    title: v === 'tax' ? (s.title || '100') : '',
                    url: numericKeys.has(v) ? '' : '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('footerSettings.dialog.selectPlaceholder') ?? ''} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">instagram</SelectItem>
                  <SelectItem value="telegram">telegram</SelectItem>
                  <SelectItem value="address">address</SelectItem>
                  <SelectItem value="phone">phone</SelectItem>
                  <SelectItem value="open_time">open_time</SelectItem>
                  <SelectItem value="fee">fee</SelectItem>
                  <SelectItem value="tax">tax</SelectItem>
                  <SelectItem value={discountKey}>{discountKey}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder={addTitlePlaceholder}
              value={addForm.title}
              onChange={(e) => setAddForm((s) => ({ ...s, title: e.target.value }))}
              inputMode={isNumericAddKey || isDiscountAddKey ? 'decimal' : undefined}
            />
            {showAddUrlInput ? (
              <Input
                placeholder={addUrlPlaceholder ?? ''}
                value={addForm.url ?? ''}
                onChange={(e) => setAddForm((s) => ({ ...s, url: e.target.value }))}
                inputMode={isDiscountAddKey ? 'decimal' : undefined}
              />
            ) : null}
          </div>
          <DialogFooter className="justify-start">
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('footerSettings.dialog.cancel')}</Button>
            <Button disabled={isAddConfirmDisabled} onClick={() => createMut.mutate()}>{t('footerSettings.dialog.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="ltr" className="text-left">
          <DialogHeader className="text-left">
            <DialogTitle className="text-left">{t('footerSettings.dialog.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={editing?.key ?? ''} disabled />
            <Input
              placeholder={editTitlePlaceholder}
              value={editForm.title}
              onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))}
              inputMode={isNumericEditKey || isDiscountEditKey ? 'decimal' : undefined}
            />
            {showEditUrlInput ? (
              <Input
                placeholder={editUrlPlaceholder ?? ''}
                value={editForm.url ?? ''}
                onChange={(e) => setEditForm((s) => ({ ...s, url: e.target.value }))}
                inputMode={isDiscountEditKey ? 'decimal' : undefined}
              />
            ) : null}
          </div>
          <DialogFooter className="justify-start">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('footerSettings.dialog.cancel')}</Button>
            <Button
              disabled={isEditConfirmDisabled}
              onClick={() => {
                if (!editing) return;
                const payload: { title?: string; url?: string | null } = { title: editForm.title };
                if (showEditUrlInput) {
                  payload.url = editForm.url || null;
                } else {
                  payload.url = null;
                }
                updateMut.mutate({ id: editing.id, payload });
              }}
            >
              {t('footerSettings.dialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
