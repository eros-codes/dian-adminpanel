import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, CheckCircle2, CircleDashed, X } from 'lucide-react';
import { apiService, extractErrorStatus } from '@/services/api';
import { Category, CategoryOptionInput, CreateCategoryDto, UpdateCategoryDto } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
// Switch component replaced by a native checkbox in this admin form
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';

type CategoryOptionForm = {
  id?: number;
  name: string;
  additionalPrice: string;
  isAvailable: boolean;
  _delete?: boolean;
};

type CategoryForm = {
  name: string;
  isActive?: boolean;
  discountPercent?: number;
  iconUrl?: string;
  clearIcon?: boolean;
  type: 'CAFE' | 'RESTAURANT';
  options: CategoryOptionForm[];
};

const Categories: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: categoriesData } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => apiService.getCategories(),
  });

  const form = useForm<CategoryForm>({
    defaultValues: {
      name: '',
      isActive: true,
      discountPercent: 0,
      iconUrl: '',
      clearIcon: false,
      type: 'CAFE',
      options: [],
    },
    mode: 'onTouched',
  });

  const {
    fields: optionFields,
    append: appendOption,
    update: updateOption,
    remove: removeOption,
    replace: replaceOptions,
  } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  const optionsValues = form.watch('options');
  const iconUrlValue = form.watch('iconUrl');
  const clearIconValue = form.watch('clearIcon');

  const apiAssetBase = useMemo(() => {
    const raw = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:4000';
    return raw.replace(/\/$/, '');
  }, []);

  const resolveIconSrc = useCallback((value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed) return '';
    if (/^data:/i.test(trimmed)) return trimmed;
    if (/^<svg[\s\S]*?<\/svg>$/i.test(trimmed)) {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(trimmed)))}`;
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return `${apiAssetBase}${trimmed}`;
    return `${apiAssetBase}/${trimmed}`;
  }, [apiAssetBase]);

  useEffect(() => {
    if (iconUrlValue && iconUrlValue.trim()) {
      form.setValue('clearIcon', false, { shouldDirty: true, shouldTouch: true });
    }
  }, [iconUrlValue, form]);

  const iconPreview = useMemo(() => {
    const raw = iconUrlValue?.trim();
    if (raw) {
      return resolveIconSrc(raw);
    }
    if (!clearIconValue && editingCategory?.iconPath) {
      return resolveIconSrc(editingCategory.iconPath);
    }
    return '';
  }, [iconUrlValue, clearIconValue, editingCategory, resolveIconSrc]);

  const sanitizeOptionsForSubmit = useCallback(
    (options: CategoryOptionForm[] | undefined) => {
      const sanitized: CategoryOptionInput[] = [];
      let hasValidationError = false;

      (options ?? []).forEach((option, index) => {
        const trimmedName = option.name?.trim() ?? '';
        const numericAdditional = Number(option.additionalPrice ?? 0);

        if (option._delete) {
          if (option.id !== undefined) {
            sanitized.push({ id: option.id, _delete: true });
          }
          return;
        }

        if (!trimmedName && option.id === undefined) {
          form.setError(`options.${index}.name` as const, {
            type: 'manual',
            message: t('categories.optionsNameRequired') as string,
          });
          hasValidationError = true;
          return;
        }

        const payload: CategoryOptionInput = {};
        if (option.id !== undefined) {
          payload.id = option.id;
        }
        if (trimmedName) {
          payload.name = trimmedName;
        }
        if (!Number.isNaN(numericAdditional)) {
          payload.additionalPrice = Math.max(0, numericAdditional);
        }
        payload.isAvailable = option.isAvailable ?? true;

        sanitized.push(payload);
      });

      return { sanitized, hasValidationError };
    },
    [form, t],
  );

  const handleAddOption = useCallback(() => {
    appendOption({ name: '', additionalPrice: '0', isAvailable: true });
  }, [appendOption]);

  const handleToggleOptionAvailability = useCallback(
    (index: number) => {
      const option = form.getValues(`options.${index}`);
      if (!option) return;
      updateOption(index, {
        ...option,
        isAvailable: !option.isAvailable,
      });
    },
    [form, updateOption],
  );

  const handleSoftDeleteOption = useCallback(
    (index: number) => {
      const option = form.getValues(`options.${index}`);
      if (!option) return;

      if (option.id === undefined) {
        removeOption(index);
        return;
      }

      updateOption(index, {
        ...option,
        _delete: !option._delete,
      });
    },
    [form, removeOption, updateOption],
  );

  const resetFormState = useCallback(() => {
    form.reset();
    replaceOptions([]);
  }, [form, replaceOptions]);

  const { mutateAsync: createCategory, isPending: isSaving } = useMutation({
    mutationFn: async (values: CategoryForm) => {
      form.clearErrors('options');
      const { sanitized: sanitizedOptions, hasValidationError } = sanitizeOptionsForSubmit(values.options);
      if (hasValidationError) {
        throw new Error('VALIDATION_ERROR');
      }

      const payload: CreateCategoryDto = {
        name: values.name,
        iconUrl: values.iconUrl?.trim() ? values.iconUrl.trim() : undefined,
        type: values.type || 'CAFE',
        options: sanitizedOptions.length > 0 ? sanitizedOptions : undefined,
      };
      const created = await apiService.createCategory(payload);
      if (values.discountPercent !== undefined) {
        await apiService.patchCategory(created.id, { discountPercent: values.discountPercent });
      }
      if (values.isActive === false) {
        await apiService.updateCategory(created.id, { isActive: false });
      }
      return created;
    },
    onSuccess: () => {
      toast.success(t('categories.saveSuccess'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsDialogOpen(false);
      resetFormState();
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.message === 'VALIDATION_ERROR') return;
      const status = extractErrorStatus(error);
      const message = status === 409 ? t('categories.duplicateName') : t('categories.saveError');
      toast.error(message as string);
    },
  });

  const { mutateAsync: updateCategory, isPending: isUpdating } = useMutation({
      mutationFn: async (values: CategoryForm) => {
      if (!editingCategory) throw new Error('No category selected');
      form.clearErrors('options');
      const { sanitized: sanitizedOptions, hasValidationError } = sanitizeOptionsForSubmit(values.options);
      if (hasValidationError) {
        throw new Error('VALIDATION_ERROR');
      }
      const payload: UpdateCategoryDto = {
        name: values.name || undefined,
        isActive: values.isActive,
        discountPercent: values.discountPercent,
        iconUrl: values.iconUrl?.trim() ? values.iconUrl.trim() : undefined,
        clearIcon: values.clearIcon ? true : undefined,
        type: values.type,
        options: sanitizedOptions.length > 0 ? sanitizedOptions : [],
      };
      const updated = await apiService.updateCategory(editingCategory.id, payload);
      // If discountPercent set explicitly, ensure PATCH endpoint handles product updates
      if (values.discountPercent !== undefined) {
        await apiService.patchCategory(editingCategory.id, { discountPercent: values.discountPercent });
      }
      return updated;
    },
    onSuccess: () => {
      toast.success(t('categories.saveSuccess'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsDialogOpen(false);
      setEditingCategory(null);
      resetFormState();
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.message === 'VALIDATION_ERROR') return;
      const status = extractErrorStatus(error);
      const message = status === 409 ? t('categories.duplicateName') : t('categories.updateError');
      toast.error(message as string);
    },
  });

  const { mutateAsync: deleteCategory, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      return await apiService.deleteCategory(id);
    },
    onSuccess: () => {
      toast.success(t('categories.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => {
      toast.error(t('categories.deleteError'));
    },
  });

  const handleDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    await deleteCategory(categoryToDelete.id);
    setIsDeleteOpen(false);
    setCategoryToDelete(null);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    const mappedOptions: CategoryOptionForm[] = (category.options ?? []).map((option) => ({
      id: option.id,
      name: option.name ?? '',
      additionalPrice: String(option.additionalPrice ?? 0),
      isAvailable: option.isAvailable,
    }));
    form.reset({
      name: category.name,
      isActive: category.isActive,
      discountPercent: category.discountPercent ?? 0,
      iconUrl: '',
      clearIcon: false,
      type: category.type ?? 'CAFE',
      options: mappedOptions,
    });
    replaceOptions(mappedOptions);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: CategoryForm) => {
    if (!values.name || !values.name.trim()) {
      form.setError('name', { message: t('categories.name') as string });
      return;
    }
    if (editingCategory) {
      await updateCategory(values);
    } else {
      await createCategory(values);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    resetFormState();
  };

  const isRTL = useMemo(() => i18n.language === 'fa', [i18n.language]);
  const categories: Category[] = useMemo(() => {
    const list = categoriesData || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [categoriesData, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('categories.title')}</h1>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search') as string}
            className={isRTL ? 'text-right' : 'text-left'}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('categories.addCategory')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-hidden p-0 sm:max-w-3xl">
              <Form {...form}>
                <form
                  className="grid max-h-[80vh] grid-rows-[auto,1fr,auto]"
                  onSubmit={form.handleSubmit(handleSubmit)}
                >
                  <DialogHeader className="px-6 pb-2 pt-6">
                    <DialogTitle>
                      {editingCategory ? t('categories.editCategory') : t('categories.addCategory')}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="overflow-y-auto px-6 pb-6">
                    <div className="space-y-4 pr-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('categories.name')}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={t('categories.name') as string} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('categories.status')}</FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-3">
                                  <input type="checkbox" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4" />
                                  <span className="text-sm text-muted-foreground">
                                    {field.value ? t('categories.active') : t('categories.inactive')}
                                  </span>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('categories.typeLabel')}</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                  value={field.value ?? 'CAFE'}
                                  onValueChange={(value) => field.onChange(value as 'CAFE' | 'RESTAURANT')}
                                >
                                  <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="CAFE" />
                                    </FormControl>
                                    <span className="text-sm">{t('categories.typeCafe')}</span>
                                  </FormItem>
                                  <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="RESTAURANT" />
                                    </FormControl>
                                    <span className="text-sm">{t('categories.typeRestaurant')}</span>
                                  </FormItem>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                  <FormField
                    control={form.control}
                    name="discountPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('categories.discountLabel')}</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={0} max={100} placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3 rounded-lg border border-dashed border-border/70 bg-muted/30 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <FormLabel className="text-base font-semibold">
                        {t('categories.options.sectionTitle')}
                      </FormLabel>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAddOption}
                        className="w-full sm:w-auto"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('categories.options.addOption')}
                      </Button>
                    </div>

                    {optionFields.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t('categories.options.emptyState')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {optionFields.map((option, index) => {
                          const optionValue = optionsValues?.[index];
                          const isMarkedForDeletion = !!optionValue?._delete;
                          return (
                            <div
                              key={option.id ?? index}
                              className={`rounded-lg border ${
                                isMarkedForDeletion
                                  ? 'border-red-200 bg-red-50/60 dark:border-red-400/40 dark:bg-red-500/10'
                                  : 'border-border bg-background'
                              } p-3 shadow-sm transition`}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                                <div className="flex-1 space-y-2">
                                  <FormField
                                    control={form.control}
                                    name={`options.${index}.name`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">
                                          {t('categories.options.nameLabel')}
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder={t('categories.options.namePlaceholder') as string}
                                            disabled={isMarkedForDeletion}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`options.${index}.additionalPrice`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">
                                          {t('categories.options.priceLabel')}
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="number"
                                            min="0"
                                            step="500"
                                            placeholder={t('categories.options.pricePlaceholder') as string}
                                            disabled={isMarkedForDeletion}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <div className="flex min-w-[180px] flex-col gap-2">
                                  <Button
                                    type="button"
                                    variant={optionValue?.isAvailable ? 'secondary' : 'outline'}
                                    onClick={() => handleToggleOptionAvailability(index)}
                                    disabled={isMarkedForDeletion}
                                    className="flex items-center gap-2"
                                  >
                                    {optionValue?.isAvailable ? (
                                      <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                      <CircleDashed className="h-4 w-4" />
                                    )}
                                    {optionValue?.isAvailable
                                      ? t('categories.options.available')
                                      : t('categories.options.unavailable')}
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleSoftDeleteOption(index)}
                                    className={`flex items-center gap-2 ${
                                      isMarkedForDeletion
                                        ? 'text-red-600 hover:text-red-700'
                                        : 'text-muted-foreground hover:text-destructive'
                                    }`}
                                  >
                                    <X className="h-4 w-4" />
                                    {isMarkedForDeletion
                                      ? t('categories.options.restore')
                                      : t('categories.options.remove')}
                                  </Button>
                                </div>
                              </div>

                              {isMarkedForDeletion && (
                                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                  {t('categories.options.markedForDeletion')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {optionFields.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {t('categories.options.helpText')}
                      </div>
                    )}
                  </div>

                      <div className="grid gap-2 rounded-lg border border-muted bg-muted/30 p-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base font-semibold">{t('categories.iconSectionTitle')}</FormLabel>
                          {editingCategory?.iconPath && !iconUrlValue?.trim() && !form.getValues('clearIcon') ? (
                            <span className="text-xs text-muted-foreground">{t('categories.iconSectionExisting')}</span>
                          ) : null}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                          <FormField
                            control={form.control}
                            name="iconUrl"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    rows={4}
                                    placeholder=""
                                    className="font-mono max-h-40 overflow-auto"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex items-center justify-center">
                            <div
                              className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background shadow-sm"
                              style={{
                                background: '#000',
                                color: '#fff',
                              }}
                            >
                              {iconPreview ? (
                                <div
                                  role="img"
                                  aria-label={t('categories.iconPreviewAria') ?? 'Icon preview'}
                                  className="h-9 w-9"
                                  style={{
                                    backgroundColor: '#fff',
                                    mask: `url(${iconPreview}) center / contain no-repeat`,
                                    WebkitMask: `url(${iconPreview}) center / contain no-repeat`,
                                  }}
                                />
                              ) : (
                                <span className="text-xl font-bold">
                                  {form.getValues('name')?.charAt(0)?.toUpperCase() || 'A'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <FormField
                            control={form.control}
                            name="clearIcon"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value ?? false}
                                    onChange={(e) => field.onChange(e.target.checked)}
                                    className="h-4 w-4"
                                  />
                                </FormControl>
                                <div className="text-sm text-muted-foreground">{t('categories.iconClearCheckbox')}</div>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-fit text-xs"
                            onClick={() => {
                              form.setValue('iconUrl', '');
                              form.setValue('clearIcon', true, { shouldDirty: true, shouldTouch: true });
                            }}
                            disabled={(!editingCategory?.iconPath && !iconPreview) || clearIconValue}
                          >
                            {t('categories.iconClearButton')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="gap-2 border-t px-6 py-4">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={isSaving || isUpdating}>
                      {(isSaving || isUpdating) ? t('common.loading') : t('common.save')}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('categories.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">{t('categories.noCategories')}</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t('common.name')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('categories.iconColumn')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('categories.optionsColumn')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('categories.discountColumn')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('categories.typeColumn')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('common.status')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => {
                    const optionNames = (c.options ?? [])
                      .map((option) => option.name?.trim())
                      .filter((name): name is string => !!name && name.length > 0);
                    const optionsTitle = optionNames.length ? optionNames.join(', ') : undefined;
                    const optionCount = c.options?.length ?? 0;

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-full border border-border shadow-sm"
                              style={{
                                background: 'linear-gradient(135deg, #3A0C10, #7A1E24)',
                                color: '#fff',
                              }}
                            >
                              {c.iconPath ? (
                                <div
                                  role="img"
                                  aria-label={`${c.name} icon`}
                                  className="h-6 w-6"
                                  style={{
                                    backgroundColor: '#fff',
                                    mask: `url(${resolveIconSrc(c.iconPath)}) center / contain no-repeat`,
                                    WebkitMask: `url(${resolveIconSrc(c.iconPath)}) center / contain no-repeat`,
                                  }}
                                />
                              ) : (
                                <span className="text-sm font-semibold text-white">
                                  {c.name?.charAt(0)?.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate" title={optionsTitle}>
                          {optionCount > 0 ? optionCount : t('categories.optionsNone')}
                        </TableCell>
                        <TableCell>
                          {typeof c.discountPercent === 'number' ? String(c.discountPercent) : '0'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {c.type === 'RESTAURANT' ? t('categories.typeRestaurant') : t('categories.typeCafe')}
                        </TableCell>
                        <TableCell>
                          <span className={c.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                            {c.isActive ? t('common.active') : t('common.inactive')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditCategory(c)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteCategory(c)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('categories.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('categories.deleteDescription', { name: categoryToDelete?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteOpen(false)}>
              {t('categories.deleteCancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? t('common.loading') : t('categories.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Categories;


