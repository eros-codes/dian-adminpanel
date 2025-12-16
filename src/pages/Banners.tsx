// admin-panel/src/pages/Banners.tsx
import React, { useState, useEffect } from 'react';
import { Edit, Trash, Image, ArrowUp, ArrowDown } from 'lucide-react';
// dialog not used here; using fixed overlay modal for backward compatibility
import { useTranslation } from 'react-i18next';
import { apiService } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const Banners: React.FC = () => {
  const { t } = useTranslation();
    type BannerItem = { id: string; title?: string; caption?: string; imageUrl?: string; order?: number };
    const [banners, setBanners] = useState<BannerItem[]>([]);
  const [swappingIds, setSwappingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [order, setOrder] = useState<number | ''>('');
  // isActive handled server-side; admin modal no longer edits visibility here
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getBanners();
      // Normalize runtime banner shapes to `BannerItem` and drop items without an id
      const normalized: BannerItem[] = [];
      for (const d of (data || [])) {
        if (!d || typeof d !== 'object') continue;
        const maybeId = (d as Record<string, unknown>)['id'];
        const id = maybeId == null ? '' : String(maybeId);
        if (!id) continue;
        const title = (d as Record<string, unknown>)['title'];
        const caption = (d as Record<string, unknown>)['caption'];
        const imageUrl = (d as Record<string, unknown>)['imageUrl'];
        const orderVal = (d as Record<string, unknown>)['order'];
        normalized.push({
          id,
          title: typeof title === 'string' ? title : undefined,
          caption: typeof caption === 'string' ? caption : undefined,
          imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
          order: typeof orderVal === 'number' ? orderVal : undefined,
        });
      }
      setBanners(normalized);
    } catch (err: unknown) {
      toast.error(t('banners.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function moveBannerUp(id: string) {
    const idx = banners.findIndex(b => b.id === id);
    if (idx <= 0) return;
      const otherId = banners[idx - 1].id;

    // capture positions for FLIP animation
    const prevRects: Record<string, DOMRect> = {};
      for (const b of banners) {
        const el = document.querySelector(`[data-banner-id="${b.id}"]`);
        if (el) prevRects[b.id] = (el as HTMLElement).getBoundingClientRect();
      }

    const previous = [...banners];
    const next = [...banners];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];

    // optimistic UI
    setBanners(next);
    setSwappingIds((s) => [...s, id, otherId]);

    // run FLIP on the two involved items
    requestAnimationFrame(() => {
      const runFlip = (flipIds: string[]) => {
        for (const fid of flipIds) {
          const el = document.querySelector(`[data-banner-id="${fid}"]`) as HTMLElement | null;
          if (!el) continue;
          const newRect = el.getBoundingClientRect();
          const prev = prevRects[fid];
          if (!prev) continue;
          const deltaY = prev.top - newRect.top;
          if (Math.abs(deltaY) < 0.5) continue;
          el.style.transition = 'none';
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.willChange = 'transform, box-shadow, opacity';
          // force reflow
          void el.offsetWidth;
          el.style.transition = 'transform 380ms cubic-bezier(.22,.8,.36,1), box-shadow 280ms ease, opacity 200ms ease';
          el.style.transform = 'translateY(0)';
          // add subtle highlight
          el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.12)';
          // cleanup after animation
          const cleanup = () => {
            el.style.transition = '';
            el.style.transform = '';
            el.style.willChange = '';
            el.style.boxShadow = '';
            el.removeEventListener('transitionend', cleanup);
          };
          el.addEventListener('transitionend', cleanup);
        }
      };
      runFlip([id, otherId]);
    });

    try {
      // persist full order to server
        await apiService.reorderBanners(next.map(b => b.id));
    } catch (err) {
      toast.error(t('banners.reorderError'));
      // fallback: try swap endpoint
      try {
        await apiService.swapBannerOrder(id, otherId);
      } catch (swapErr) {
        setBanners(previous); // revert
      }
    } finally {
      setSwappingIds((s) => s.filter(x => x !== id && x !== otherId));
    }
  }

  async function moveBannerDown(id: string) {
    const idx = banners.findIndex(b => b.id === id);
    if (idx === -1 || idx >= banners.length - 1) return;
      const otherId = banners[idx + 1].id;

    // capture positions for FLIP animation
    const prevRects: Record<string, DOMRect> = {};
      for (const b of banners) {
        const el = document.querySelector(`[data-banner-id="${b.id}"]`);
        if (el) prevRects[b.id] = (el as HTMLElement).getBoundingClientRect();
      }

    const previous = [...banners];
    const next = [...banners];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];

    // optimistic UI
    setBanners(next);
    setSwappingIds((s) => [...s, id, otherId]);

    // run FLIP on the two involved items
    requestAnimationFrame(() => {
      const runFlip = (flipIds: string[]) => {
        for (const fid of flipIds) {
          const el = document.querySelector(`[data-banner-id="${fid}"]`) as HTMLElement | null;
          if (!el) continue;
          const newRect = el.getBoundingClientRect();
          const prev = prevRects[fid];
          if (!prev) continue;
          const deltaY = prev.top - newRect.top;
          if (Math.abs(deltaY) < 0.5) continue;
          el.style.transition = 'none';
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.willChange = 'transform, box-shadow, opacity';
          // force reflow
          void el.offsetWidth;
          el.style.transition = 'transform 380ms cubic-bezier(.22,.8,.36,1), box-shadow 280ms ease, opacity 200ms ease';
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.12)';
          const cleanup = () => {
            el.style.transition = '';
            el.style.transform = '';
            el.style.willChange = '';
            el.style.boxShadow = '';
            el.removeEventListener('transitionend', cleanup);
          };
          el.addEventListener('transitionend', cleanup);
        }
      };
      runFlip([id, otherId]);
    });

    try {
      await apiService.reorderBanners(next.map(b => b.id));
    } catch (err) {
      toast.error(t('banners.reorderError'));
      try {
        await apiService.swapBannerOrder(id, otherId);
      } catch (swapErr) {
        console.error('fallback swap failed', swapErr);
        setBanners(previous);
      }
    } finally {
      setSwappingIds((s) => s.filter(x => x !== id && x !== otherId));
    }
  }

  async function create() {
  const fd = new FormData();
    fd.append('title', title);
    if (caption) fd.append('caption', caption);
    if (order !== '') fd.append('order', String(order));
    if (file) fd.append('file', file);
    try {
      setCreating(true);
      await apiService.createBanner(fd);
      toast.success(t('banners.createSuccess'));
      setTitle(''); setCaption(''); setOrder(''); setFile(null);
      setPreviewUrl(null);
      await load();
    } catch (err) {
      toast.error(t('banners.createError'));
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
  const fd = new FormData();
  fd.append('title', title);
  if (caption) fd.append('caption', caption);
  if (order !== '') fd.append('order', String(order));
    if (file) fd.append('file', file);
    if (removeImage) fd.append('removeImage', 'true');
    try {
      await apiService.updateBanner(editingId, fd);
      toast.success(t('banners.updateSuccess'));
      // reset
  setEditingId(null);
  setTitle(''); setCaption(''); setOrder(''); setFile(null); setRemoveImage(false);
      setPreviewUrl(null);
      await load();
    } catch (err) {
      toast.error(t('banners.updateError'));
    }
  }

  async function remove(id: string) {
    if (!confirm(t('banners.confirmDelete') as string)) return;
    try {
      await apiService.deleteBanner(id);
      toast.success(t('banners.deleteSuccess'));
      await load();
    } catch (err) {
      toast.error(t('banners.deleteError'));
    }
  }

  const [showCreate, setShowCreate] = useState(false);

  // when opening edit modal, set preview to existing image if available
  useEffect(() => {
    if (editingId) {
      const existing = banners.find(x => x.id === editingId);
          setPreviewUrl(existing?.imageUrl ?? null);
    }
  }, [editingId, banners]);

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h2 className="text-xl font-bold flex items-center gap-2"><Image className="h-5 w-5" /> {t('banners.title') || t('navigation.banners')}</h2>
          <Button className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>{t('banners.addBanner')}</Button>
        </div>

      {/* Create dialog (restored to fixed overlay card to match previous behavior) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-[90%] max-w-3xl">
            <CardHeader>
              <CardTitle>{editingId ? (t('banners.edit') as string) : (t('banners.create') as string)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-3">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('banners.titlePlaceholder') as string} />
                <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('banners.captionPlaceholder') as string} />
                {/* isActive checkbox removed from modal per admin request */}
                <div>
                  <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreviewUrl(e.target.files?.[0] ? URL.createObjectURL(e.target.files?.[0]) : null); }} />
                </div>
                <div>
                  {previewUrl && <img src={previewUrl} className="h-28 w-full object-cover rounded mb-2" />}
                  {!previewUrl && editingId && banners.find(x => x.id === editingId)?.imageUrl && (
                    <img src={banners.find(x => x.id === editingId)?.imageUrl} className="h-28 w-full object-cover rounded mb-2" />
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        if (editingId) {
                          await saveEdit();
                        } else {
                          await create();
                        }
                        setShowCreate(false);
                      }}
                      disabled={editingId ? loading : creating}
                    >
                      {editingId
                        ? (t('banners.save') as string)
                        : (creating ? (t('banners.creating') as string) : (t('banners.createBtn') as string))}
                    </Button>
                    <Button variant="outline" className="mr-2" onClick={() => { setShowCreate(false); setEditingId(null); setPreviewUrl(null); }}>{t('banners.cancel')}</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('banners.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {banners.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t('banners.noBanners')}</div>
          ) : (
            <div className="space-y-3">
              {banners.map((b) => (
                <div
                  key={b.id}
                  data-banner-id={b.id}
                  className={
                    `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border p-3 transform transition-all duration-300 ease-in-out ` +
                    `${swappingIds.includes(b.id) ? ' -translate-y-2 scale-105 shadow-2xl z-10 bg-white' : 'bg-transparent'}`
                  }
                >
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                    {b.imageUrl ? <img src={b.imageUrl} className="h-40 max-h-40 w-full rounded object-cover sm:h-16 sm:w-40" /> : null}
                    <div className="space-y-1 text-right sm:text-left">
                         <div className="font-bold">{b.title}</div>
                         <div className="text-sm text-gray-600">{b.caption}</div>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => { await moveBannerUp(b.id); }}
                      title={t('banners.moveUp') as string}
                      disabled={swappingIds.includes(b.id)}
                      className={`${swappingIds.includes(b.id) ? 'opacity-60 cursor-not-allowed' : ''} w-full sm:w-auto justify-center`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => { await moveBannerDown(b.id); }}
                      title={t('banners.moveDown') as string}
                      disabled={swappingIds.includes(b.id)}
                      className={`${swappingIds.includes(b.id) ? 'opacity-60 cursor-not-allowed' : ''} w-full sm:w-auto justify-center`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="w-full sm:w-auto justify-center" onClick={() => {
                      setEditingId(b.id);
                      setTitle(b.title || ''); setCaption(b.caption || ''); setOrder(b.order ?? '');
                      setRemoveImage(false);
                      setFile(null);
                      setShowCreate(true);
                    }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="destructive" className="w-full sm:w-auto justify-center" onClick={() => remove(b.id)}><Trash className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit is handled in the modal (showCreate + editingId) */}
    </div>
  );
};

export default Banners;
