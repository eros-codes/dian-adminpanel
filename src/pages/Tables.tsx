import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, Table as TableIcon } from 'lucide-react';

import { apiService } from '@/services/api';
import { DiningTable } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface TableForm {
  staticId: string;
  name: string;
  description?: string;
  isActive: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if ('response' in errObj && typeof errObj.response === 'object' && errObj.response) {
      const resp = errObj.response as Record<string, unknown>;
      if ('data' in resp && typeof resp.data === 'object' && resp.data) {
        const data = resp.data as Record<string, unknown>;
        if ('message' in data && typeof data.message === 'string') {
          return data.message;
        }
      }
    }
    if ('message' in errObj && typeof errObj.message === 'string') {
      return errObj.message;
    }
  }
  return fallback;
}

const Tables: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<DiningTable | null>(null);

  const { data: tablesData, isLoading } = useQuery<DiningTable[]>({
    queryKey: ['dining-tables'],
    queryFn: () => apiService.getDiningTables(),
    staleTime: 60_000,
  });

  const form = useForm<TableForm>({
    defaultValues: {
      staticId: '',
      name: '',
      description: '',
      isActive: true,
    },
    mode: 'onTouched',
  });

  const resetForm = () => {
    form.reset({
      staticId: '',
      name: '',
      description: '',
      isActive: true,
    });
    setEditingTable(null);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const createMutation = useMutation({
    mutationFn: async (values: TableForm) => {
      const payload = {
        staticId: values.staticId.trim(),
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        isActive: values.isActive,
      } as Partial<DiningTable>;
      if (!payload.staticId || !payload.name) {
        throw new Error(t('tables.validation.requiredFields') as string);
      }
      return apiService.createDiningTable(payload);
    },
    onSuccess: () => {
      toast.success(t('tables.notifications.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      closeDialog();
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, t('tables.notifications.genericError') as string);
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: TableForm) => {
      if (!editingTable) throw new Error('No table selected');
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        isActive: values.isActive,
      } as Partial<DiningTable>;
      if (!payload.name) {
        throw new Error(t('tables.validation.requiredName') as string);
      }
      return apiService.updateDiningTable(editingTable.id, payload);
    },
    onSuccess: () => {
      toast.success(t('tables.notifications.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      closeDialog();
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, t('tables.notifications.genericError') as string);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiService.deleteDiningTable(id);
    },
    onSuccess: () => {
      toast.success(t('tables.notifications.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      setIsDeleteOpen(false);
      setTableToDelete(null);
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, t('tables.notifications.genericError') as string);
      toast.error(message);
    },
  });

  const handleSubmit = async (values: TableForm) => {
    if (editingTable) {
      await updateMutation.mutateAsync(values);
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (table: DiningTable) => {
    setEditingTable(table);
    form.reset({
      staticId: table.staticId,
      name: table.name,
      description: table.description || '',
      isActive: table.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteRequest = (table: DiningTable) => {
    setTableToDelete(table);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!tableToDelete) return;
    await deleteMutation.mutateAsync(tableToDelete.id);
  };

  const isRTL = i18n.language === 'fa';
  const tables = useMemo(() => {
    const list = tablesData || [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((table) =>
      table.name.toLowerCase().includes(query) ||
      table.staticId.toLowerCase().includes(query)
    );
  }, [tablesData, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <TableIcon className="h-7 w-7" />
            {t('tables.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('tables.subtitle')}</p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tables.searchPlaceholder') as string}
            className={isRTL ? 'text-right' : 'text-left'}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t('tables.addButton')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingTable ? t('tables.editTitle') : t('tables.createTitle')}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                  <FormField
                    control={form.control}
                    name="staticId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('tables.form.staticId')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="table-01"
                            disabled={!!editingTable}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('tables.form.name')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('tables.form.namePlaceholder') as string} />
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
                        <FormLabel>{t('tables.form.description')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder={t('tables.form.descriptionPlaceholder') as string} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('tables.form.isActive')}</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={!!field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-muted-foreground">
                              {field.value ? t('tables.form.active') : t('tables.form.inactive')}
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {createMutation.isPending || updateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('common.loading')}
                        </>
                      ) : (
                        t('common.save')
                      )}
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
          <CardTitle>{t('tables.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 mr-2 animate-spin" />
              {t('common.loading')}
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              {search ? t('tables.emptySearch') : t('tables.emptyState')}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t('tables.columns.staticId')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('tables.columns.name')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('tables.columns.description')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('tables.columns.status')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map((table) => (
                    <TableRow key={table.id}>
                      <TableCell className="font-mono text-xs sm:text-sm">{table.staticId}</TableCell>
                      <TableCell className="font-medium">{table.name}</TableCell>
                      <TableCell className="max-w-[320px] truncate" title={table.description || ''}>
                        {table.description || '-'}
                      </TableCell>
                      <TableCell>
                        <span className={table.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {table.isActive ? t('tables.status.active') : t('tables.status.inactive')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEdit(table)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRequest(table)}
                            disabled={deleteMutation.isPending}
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

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tables.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tables.delete.description', { name: tableToDelete?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteOpen(false)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('tables.delete.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tables;
