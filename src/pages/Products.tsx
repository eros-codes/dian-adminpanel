//...Product.tsx...//
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, X, CheckCircle2, CircleDashed } from 'lucide-react';
import { apiService } from '@/services/api';
import { Product, Category, ProductImageInput } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/utils';

type ProductOptionForm = {
  id?: number | string;
  name: string;
  additionalPrice: string;
  isAvailable: boolean;
  _destroy?: boolean;
};

type ProductForm = {
  name: string;
  description: string;
  // UI shows a single Price field which we store as originalPrice
  originalPrice: string;
  categoryId: string;
  discountPercent?: string;
  isAvailable: boolean;
  options: ProductOptionForm[];
};

const resolveImageUrl = (imgUrl: string): string => {
  if (!imgUrl || typeof imgUrl !== 'string') return '';
  const base = import.meta.env.VITE_REACT_APP_API_URL?.replace(/\/$/, '') || '';
  if (imgUrl.startsWith('http')) return imgUrl;
  return `${base}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
};

const normalizeImage = (img: ProductImageInput | string): { id: string; url: string } => {
  const rawUrl = typeof img === 'string' ? img : (img as ProductImageInput)?.url;
  const id = typeof img === 'string' ? (img ?? '') : ((img as ProductImageInput)?.id ?? (rawUrl ?? ''));
  return {
    id,
    url: resolveImageUrl(rawUrl ?? ''),
  };
};

const Products: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  // filters
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');


  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Image handling
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // existingImages are URLs (string[]) for the product; when editing user can remove some
  const [existingImages, setExistingImages] = useState<{ id: string; url: string }[]>([]);

  // React Hook Form
  const form = useForm<ProductForm>({
    defaultValues: {
      name: '',
      description: '',
      originalPrice: '',
      discountPercent: '0',
      categoryId: '',
      isAvailable: true,
      options: [],
    },
    mode: 'onTouched',
  });

  const {
    fields: optionFields,
    append: appendOption,
    remove: removeOption,
    update: updateOption,
    replace: replaceOptions,
  } = useFieldArray<ProductForm, 'options'>({
    control: form.control,
    name: 'options',
  });

  // Small runtime helpers to avoid explicit `any` usage and handle unknown shapes
  const safeStr = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  const safeNum = (v: unknown) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const extractStatus = (err: unknown): number | undefined => {
    if (!err) return undefined;
    const e = err as Record<string, unknown>;
    if (e.response && typeof e.response === 'object') {
      const r = e.response as Record<string, unknown>;
      if (r.status !== undefined) return Number(r.status as unknown as number);
    }
    if (e.status !== undefined) return Number(e.status as unknown as number);
    return undefined;
  };

  // compute client-side preview price for admin (backend is authoritative)
  const watchedOriginalPrice = form.watch('originalPrice');
  const watchedDiscount = Number(form.watch('discountPercent') ?? 0);
  const previewPrice = (() => {
    const orig = Number(watchedOriginalPrice ?? 0) || 0;
    const dp = Math.max(0, Math.min(100, Number(watchedDiscount || 0)));
    return Number((orig * (1 - dp / 100)).toFixed(2));
  })();

  // --- Queries ---
  // ✅ Products query - V5 syntax
  const {
    data: productsResponse,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery<{ data: Product[]; total: number }, Error>({
    queryKey: ['products', search, selectedCategory],
    queryFn: () =>
      apiService.getProducts({
        ...(search ? { search } : {}),
        ...(selectedCategory ? { category: selectedCategory } : {}),
      }),
  staleTime: 1000 * 60 * 0.5, // 30s
});



// ✅ Categories query - V5 syntax
const {
  data: categoriesResponse,
  isLoading: categoriesLoading,
  error: categoriesError,
} = useQuery<Category[], Error>({
  queryKey: ['categories'],
  queryFn: () => apiService.getCategories(),
  staleTime: 1000 * 60 * 5, // 5 دقیقه
});

// Normalize responses
const categories = categoriesResponse ?? [];
const products: Product[] = productsResponse?.data || [];


  // --- Mutations ---//
  // create: JSON first, then if files selected -> upload to /products/:id/images
  // ✅ Create Product
  const createProductMutation = useMutation<Product, Error, Record<string, unknown>>({
    mutationFn: async (payload) => {
      // If there are no files selected, call the JSON endpoint (simpler and avoids multipart validation issues)
      const jsonPayload = {
        name: payload.name,
        description: payload.description,
        originalPrice: payload.originalPrice !== undefined && payload.originalPrice !== '' ? Number(payload.originalPrice) : 0,
        discountPercent: payload.discountPercent !== undefined && payload.discountPercent !== '' ? Number(payload.discountPercent) : 0,
        categoryId: payload.categoryId,
        images: payload.images ?? undefined,
        isAvailable: payload.isAvailable !== false,
      };

      if (!selectedFiles || selectedFiles.length === 0) {
        // Use JSON endpoint when there are no files to upload
        return apiService.createProductJson(jsonPayload);
      }

      // Otherwise send multipart FormData including files
      const fd = new FormData();
      fd.append('name', safeStr((payload as Record<string, unknown>).name));
      fd.append('description', safeStr((payload as Record<string, unknown>).description));
      fd.append('originalPrice', String(safeNum((payload as Record<string, unknown>).originalPrice) ?? 0));
      fd.append('discountPercent', String(safeNum((payload as Record<string, unknown>).discountPercent) ?? 0));
      fd.append('categoryId', safeStr((payload as Record<string, unknown>).categoryId));
      fd.append('isAvailable', String(((payload as Record<string, unknown>).isAvailable !== false)));
      selectedFiles.forEach((file) => fd.append('files', file)); // 🔑 فایل‌ها

      return apiService.createProduct(fd);
    },
    onSuccess: async () => {
      toast.success(t('products.saveSuccess'));
      setSelectedFiles([]);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (err: unknown) => {
      console.error('createProduct error', err);
      toast.error(t('products.saveError'));
    },
  });

  // ✅ Update Product
  const updateProductMutation = useMutation<Product, Error, { id: string; data: Record<string, unknown> }>({
    mutationFn: async ({ id, data }) => apiService.updateProduct(id, data),
    onSuccess: async (_, { id }) => {
      toast.success(t('products.saveSuccess'));

      try {
        if (selectedFiles.length > 0) {
          const fd = new FormData();
          selectedFiles.forEach((file) => fd.append('files', file));
          const res = await apiService.uploadProductImages(id, fd);
          if (res.success && Array.isArray(res.images)) {
            setExistingImages(res.images.map(normalizeImage));
          } else {
            console.warn('uploadProductImages returned unexpected format', res);
          }
        }
      } catch (err) {
        console.error('Upload images after update failed', err);
        toast.error(t('products.imageUploadError') || 'Failed uploading images');
        // continue
      }

      setSelectedFiles([]);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (err: unknown) => {
      console.error('updateProduct error', err);
      toast.error(t('products.updateError'));
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => apiService.deleteProduct(id),
    onSuccess: () => {
      toast.success(t('products.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => {
      console.error('deleteProduct error', err);
      toast.error(t('products.deleteError'));
    },
  });

  // --- Handlers ---
  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    await deleteProductMutation.mutateAsync(productToDelete.id);
    setIsDeleteOpen(false);
    setProductToDelete(null);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);

    const rawOptions = (product as unknown as { options?: unknown }).options;
    const normalizedOptions: ProductOptionForm[] = (Array.isArray(rawOptions) ? rawOptions : []).map((opt) => {
      const o = opt as Record<string, unknown>;
      return {
        id: (o.id ?? undefined) as number | string | undefined,
        name: safeStr(o.name),
        additionalPrice: safeStr(o.additionalPrice ?? 0),
        isAvailable: Boolean(o.isAvailable !== false),
      };
    });

    form.reset({
      name: product.name,
      description: product.description,
      // Show originalPrice if available, otherwise fallback to stored price for convenience
      originalPrice: product.originalPrice?.toString() ?? product.price?.toString() ?? '',
      // Show product-specific discount if present; otherwise show category's discount if any.
      discountPercent: (product.discountPercent !== undefined && product.discountPercent !== null && Number(product.discountPercent) > 0)
        ? String(Number(product.discountPercent))
        : (() => {
          const catDisc = safeNum((product.category as unknown as Record<string, unknown>)?.discountPercent) ?? 0;
          return catDisc > 0 ? String(catDisc) : '0';
        })(),
      categoryId: product.categoryId,
      isAvailable: product.isAvailable !== false,
      options: normalizedOptions,
    });

    replaceOptions(normalizedOptions);

    // NORMALIZE images: همیشه { id, url }
    const imgs = (product.images ?? []).map(normalizeImage);

    setExistingImages(imgs);
    setSelectedFiles([]);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    form.reset();
    replaceOptions([]);
    setSelectedFiles([]);
  };

  // Submit handler (create or update)
  const normalizeNumber = (value: string | number | undefined): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const normalizeOptions = (options: ProductOptionForm[] | undefined) => {
    if (!options || options.length === 0) return [];
    return options.map((option) => {
      const normalized: Record<string, unknown> = {
        name: option.name,
        additionalPrice: normalizeNumber(option.additionalPrice) ?? 0,
        isAvailable: Boolean(option.isAvailable),
      };

      const rawId = option.id;
      const parsedId =
        typeof rawId === 'number'
          ? (Number.isFinite(rawId) ? rawId : undefined)
          : typeof rawId === 'string' && rawId.trim() !== ''
            ? Number(rawId)
            : undefined;

      if (parsedId !== undefined && Number.isFinite(parsedId)) {
        normalized.id = parsedId;
      }

      if (option._destroy) {
        normalized._destroy = true;
      }

      return normalized;
    });
  };

  const onSubmit = async (values: ProductForm) => {
    if (!values.name) {
      form.setError('name', { message: t('products.productName') as string });
      return;
    }

    const payload = {
      ...values,
      originalPrice: normalizeNumber(values.originalPrice),
      discountPercent: normalizeNumber(values.discountPercent),
      isAvailable: values.isAvailable !== false,
      options: normalizeOptions(values.options),
    };

    try {
      if (editingProduct) {
        await updateProductMutation.mutateAsync({ id: editingProduct.id, data: payload });
      } else {
        await createProductMutation.mutateAsync(payload);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddOption = () => {
    appendOption({ name: '', additionalPrice: '0', isAvailable: true });
  };

  const handleToggleOption = (index: number) => {
    const option = optionFields[index];
    updateOption(index, {
      ...option,
      isAvailable: !option.isAvailable,
    });
  };

  const handleSoftDeleteOption = (index: number) => {
    const option = optionFields[index];
    if (option.id) {
      updateOption(index, { ...option, _destroy: !option._destroy });
    } else {
      removeOption(index);
    }
  };

  // file input change
  const onFilesChange = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setSelectedFiles((prev) => {
      // merge but keep unique by name+size to avoid duplicates
      const merged = [...prev, ...arr];
      const unique: File[] = [];
      const seen = new Set<string>();
      merged.forEach((f) => {
        const key = `${f.name}-${f.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(f);
        }
      });
      return unique;
    });
  };

  // remove selected file
  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // remove existing image url (user wants to delete that image on save)
  const removeExistingImage = async (index: number) => {
    const image = existingImages[index];
    if (!image) return;

    try {
      // اگر id داریم => حذف از DB و Cloudinary
      if (image.id && image.id.trim() !== '') {
        await apiService.deleteProductImage(image.id); // backend expects imageId (productImage.id)
        // در صورتی که بک درست کار کند، از لیست UI حذف می‌کنیم
        setExistingImages((prev) => prev.filter((_, i) => i !== index));
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        toast.success(t('products.imageDeleteSuccess'));
        return;
      }

      // اگر id نداریم (مثلاً فقط url است) => فعلاً حذف در UI (یا میتونی endpoint اضافه کنی)
      setExistingImages((prev) => prev.filter((_, i) => i !== index));
      toast.success(t('products.imageDeleteSuccess'));
      // ---- اگر میخواهی بک‌اند هم پاک کند باید endpointی بوجود آوریم که حذف با url انجام شود ----
    } catch (err) {
      console.error('delete image error', err);
      toast.error(t('products.imageDeleteError'));
    }
  };

  // Derived UI flags
  const isRTL = useMemo(() => i18n.language === 'fa', [i18n.language]);
  const locale = i18n.language === 'fa' ? 'fa' : 'en';

  // Loading / error handling
  if (productsLoading || categoriesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('products.title')}</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (productsError || categoriesError) {
    const err = (productsError ?? categoriesError) as unknown;
    const status = extractStatus(err);
    if (status === 401) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('products.title')}</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t('products.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-lg text-destructive">{t('admin.unauthorizedReturns')}</p>
                <div className="mt-4">
                  <button className="px-4 py-2 bg-primary text-white rounded" onClick={() => { window.location.href = '/login'; }}>
                    {t('admin.adminLogin')}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('products.title')}</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center space-y-4">
            <p className="text-destructive">Error loading data</p>
            <p className="text-muted-foreground text-sm">
              {productsError?.message || categoriesError?.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* header (match Categories layout) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('products.title')}</h1>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2 flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search') as string}
            className={`${isRTL ? 'text-right' : 'text-left'} flex-1 min-w-0`}
          />

          <Button className="w-auto whitespace-nowrap" variant={selectedCategory ? 'secondary' : 'outline'} onClick={() => setCategoryDialogOpen(true)}>
            {selectedCategory
              ? `${t('products.categoryFilterLabel')}: ${categories.find((c) => c.id === selectedCategory)?.name || ''}`
              : t('products.categoryFilter')}
          </Button>
          {selectedCategory && (
            <button
              onClick={() => {
                setSelectedCategory('');
                queryClient.invalidateQueries({ queryKey: ['products'] });
              }}
              className="px-2 text-red-500 hover:text-red-700 text-lg"
              title={t('common.clearFilter')}
            >
              ×
            </button>
          )}

          <Button className="whitespace-nowrap" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('products.addProduct')}
          </Button>
        </div>
      </div>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('products.filterDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('products.filterDialog.placeholder') as string} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setSelectedCategory('');
                queryClient.invalidateQueries({ queryKey: ['products'] });
                setCategoryDialogOpen(false);
              }}>
                {t('products.filterDialog.clear')}
              </Button>
              <Button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['products'] });
                  setCategoryDialogOpen(false);
                }}
              >
                {t('products.filterDialog.apply')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
          else setIsDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingProduct ? t('products.editProduct') : t('products.addProduct')}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form className="flex flex-col flex-1 overflow-hidden" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="flex-1 overflow-y-auto px-6 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('products.productName')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('products.productName') as string} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('products.description')}</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder={t('products.description') as string} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.category')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('common.category') as string} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(categories ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="originalPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('common.price')}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              inputMode="numeric"
                              placeholder={t('common.price') as string}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discountPercent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('products.discount') || 'Discount (%)'}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              inputMode="numeric"
                              placeholder={'Discount %'}
                              type="number"
                              min={0}
                              max={100}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">Preview price: {formatCurrency(previewPrice, locale)}</div>
                </div>

                <FormField
                  control={form.control}
                  name="isAvailable"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            id="product-availability"
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(!!checked)}
                          />
                        </FormControl>
                        <FormLabel htmlFor="product-availability" className="!mt-0">
                          {field.value
                            ? t('products.options.available')
                            : t('products.options.unavailable')}
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Images area */}
                <div className="space-y-2">
                  <FormLabel>{t('products.images')}</FormLabel>

                  {/* choose new files */}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => onFilesChange(e.target.files)}
                    className="block w-full text-sm text-muted-foreground"
                  />

                  {/* preview selected new files */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt="preview"
                            className="h-16 w-16 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(idx)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full px-1 text-xs"
                            aria-label="remove"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* existing images when editing */}
                  {editingProduct && existingImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {existingImages.map((img, idx) => {
                        if (!img.url) return null;
                        return (
                          <div key={img.id || img.url} className="relative">
                            <img
                              src={img.url}
                              alt={`existing-${idx}`}
                              className="h-16 w-16 object-cover rounded border"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/placeholder-100.png';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(idx)}
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-full px-1 text-xs"
                              aria-label="remove-existing"
                            >
                              x
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base font-medium flex items-center gap-2">
                      {t('products.options.sectionTitle')}
                    </FormLabel>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddOption}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('products.options.addOption')}
                    </Button>
                  </div>

                  {optionFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('products.options.emptyState')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {optionFields.map((option, index) => {
                        const fieldName = `options.${index}` as const;
                        const isMarkedForDeletion = !!option._destroy;
                        return (
                          <div
                            key={option.id ?? index}
                            className={`rounded-lg border ${isMarkedForDeletion ? 'border-red-200 bg-red-50/40' : 'border-border'} p-3 shadow-sm transition`}
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:gap-4 gap-3">
                              <div className="flex-1 space-y-2">
                                <FormField
                                  control={form.control}
                                  name={`${fieldName}.name`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">
                                        {t('products.options.nameLabel')}
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          placeholder={t('products.options.namePlaceholder') as string}
                                          disabled={isMarkedForDeletion}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`${fieldName}.additionalPrice`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">
                                        {t('products.options.priceLabel')}
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="number"
                                          min="0"
                                          step="500"
                                          placeholder={t('products.options.pricePlaceholder') as string}
                                          disabled={isMarkedForDeletion}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="flex flex-col gap-2 min-w-[160px]">
                                <Button
                                  type="button"
                                  variant={option.isAvailable ? 'secondary' : 'outline'}
                                  onClick={() => handleToggleOption(index)}
                                  disabled={isMarkedForDeletion}
                                  className="flex items-center gap-2"
                                >
                                  {option.isAvailable ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <CircleDashed className="h-4 w-4" />
                                  )}
                                  {option.isAvailable
                                    ? t('products.options.available')
                                    : t('products.options.unavailable')}
                                </Button>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleSoftDeleteOption(index)}
                                  className={`flex items-center gap-2 ${isMarkedForDeletion ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-destructive'}`}
                                >
                                  <X className="h-4 w-4" />
                                  {isMarkedForDeletion
                                    ? t('products.options.restore')
                                    : t('products.options.remove')}
                                </Button>
                              </div>
                            </div>

                            {isMarkedForDeletion && (
                              <p className="mt-2 text-xs text-red-500">
                                {t('products.options.markedForDeletion')}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {optionFields.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {t('products.options.helpText')}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="px-6 py-4 border-t">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  >
                    {createProductMutation.isPending || updateProductMutation.isPending
                      ? t('common.loading')
                      : t('common.save')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

    {/* Products table */}
    <Card>
      <CardHeader>
        <CardTitle>{t('products.title')}</CardTitle>
      </CardHeader>

      <CardContent>
        {(products ?? []).length === 0 ? (
          <div className="text-center text-muted-foreground py-8">{t('products.noProducts')}</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">{t('common.image')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('products.productName')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('common.category')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('common.price')}</TableHead>
                  <TableHead className="whitespace-nowrap">% {t('products.discount') || 'Discount'}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('products.availabilityLabel', { defaultMessage: 'وضعیت' })}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {(products ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.images && p.images.length > 0 ? (
                        <img
                         src={resolveImageUrl(p.images[0]?.url)} 
                         alt={p.name} 
                         className="h-12 w-12 object-cover rounded"
                         onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder-100.png';}} />
                      ) : (
                        <span className="text-muted-foreground text-xs">{t('products.noImage')}</span>
                      )}
                    </TableCell>

                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category?.name ?? '-'}</TableCell>
                    <TableCell>{formatCurrency(p.price, locale)}</TableCell>
                    <TableCell>{(p.discountPercent ?? (safeNum((p.category as unknown as Record<string, unknown>)?.discountPercent) ?? 0))}%</TableCell>
                    <TableCell>
                      <span className={p.isAvailable ? 'text-green-600' : 'text-red-500'}>
                        {p.isAvailable
                          ? t('products.options.available')
                          : t('products.options.unavailable')}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditProduct(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteProduct(p)}
                          disabled={deleteProductMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Delete confirm */}
    <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('products.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('products.deleteDescription', { name: productToDelete?.name ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setIsDeleteOpen(false)}>{t('products.deleteCancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDeleteProduct}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteProductMutation.isPending ? t('common.loading') : t('products.deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
};

export default Products;
