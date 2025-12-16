import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { CreateUserDto, User } from '@/types';
import { useAuthStore } from '@/store/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Users: React.FC = () => {
  const { t } = useTranslation();
  const { user: me } = useAuthStore();
  const isAdmin = me?.role === 'ADMIN';

  const queryClient = useQueryClient();

  const usersQuery = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiService.getUsers(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createInitialForm = (): CreateUserDto => ({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'ADMIN',
    isActive: true,
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateUserDto>(() => createInitialForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const usernameRegex = /^[a-zA-Z0-9._-]+$/;

  const getUsernameError = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return t('users.usernameRequired') ?? 'وارد کردن نام کاربری الزامی است';
    if (trimmed.length < 4 || trimmed.length > 32) return t('users.usernameLengthError') ?? 'نام کاربری باید بین ۴ تا ۳۲ کاراکتر باشد';
    if (!usernameRegex.test(trimmed)) return t('users.usernamePatternError') ?? 'نام کاربری فقط می‌تواند شامل حروف، اعداد، نقطه، آندرلاین یا خط تیره باشد';
    return '';
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const usernameError = getUsernameError(form.username);
    if (usernameError) errors.username = usernameError;

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const roleOptions = useMemo(() => (
    [
      { value: 'ADMIN', label: t('users.admin') },
      { value: 'USER', label: t('users.user') },
      { value: 'PRIMARY', label: t('users.primaryInventor') },
      { value: 'SECONDARY', label: t('users.secondaryInventor') },
    ]
  ), [t]);

  // Track which users are currently being updated to disable their selects
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const { mutateAsync: patchUser } = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<User> }) => {
      return apiService.updateUser(id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const { mutateAsync: createUser, isPending: isCreating } = useMutation({
    mutationFn: async (payload: CreateUserDto) => apiService.createUser(payload),
    onSuccess: () => {
      toast.success(t('users.createUserSuccess'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateOpen(false);
      setForm(createInitialForm());
      setFormErrors({});
    },
    onError: () => {
      toast.error(t('users.createUserError'));
    },
  });

  const handleOpenCreate = () => setIsCreateOpen(true);
  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setForm(createInitialForm());
    setFormErrors({});
  };
  const handleSubmitCreate = async () => {
    if (!validateForm()) return;

    await createUser({
      username: form.username.trim(),
      password: form.password,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role,
      isActive: form.isActive,
    });
  };

  if (usersQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  // If users query returned an authorization error, show admin-login prompt
  if (usersQuery.isError) {
    const err: any = usersQuery.error;
    const status = err?.response?.status || err?.status;
    if (status === 401) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('users.title')}</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t('users.title')}</CardTitle>
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
  }

  const users: User[] = usersQuery.data || [];

  const getRoleLabel = (role?: string) => {
    const opt = roleOptions.find((r) => r.value === role);
    return opt ? opt.label : String(role || '');
  };

  const getStatusLabel = (active?: boolean | string) => {
    const a = typeof active === 'string' ? active === 'true' : Boolean(active);
    return a ? t('common.active') : t('common.inactive');
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Only ADMIN can change roles (UI guard)
    if (!isAdmin) return;
    // If the role isn't actually changing, do nothing
    const current = users.find((x) => x.id === userId);
    if (!current) return;
    if (current.role === newRole) return;

    // Prevent removing the last ADMIN
    if (current.role === 'ADMIN' && newRole !== 'ADMIN') {
      const otherAdmins = users.filter((u) => u.role === 'ADMIN' && u.id !== userId);
      if (otherAdmins.length === 0) {
        toast.error(t('users.cannotRemoveLastAdmin') || 'There must be at least one admin user');
        return;
      }
    }

    setUpdatingIds((s) => new Set(s).add(userId));
    try {
      await patchUser({ id: userId, patch: { role: newRole as User['role'] } });
      toast.success(t('users.updateSuccess'));
    } catch (err) {
      console.error('update role error', err);
      toast.error(t('users.updateError'));
    } finally {
      setUpdatingIds((s) => {
        const copy = new Set(s);
        copy.delete(userId);
        return copy;
      });
    }
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    const current = users.find((x) => x.id === userId);
    if (!current) return;

    // Prevent deactivating the last ADMIN
    if (current.role === 'ADMIN' && !isActive) {
      const otherAdmins = users.filter((u) => u.role === 'ADMIN' && u.id !== userId && u.isActive);
      if (otherAdmins.length === 0) {
        toast.error(t('users.cannotDeactivateLastAdmin') || 'Cannot deactivate the last admin account');
        return;
      }
    }

    setUpdatingIds((s) => new Set(s).add(userId));
    try {
      await patchUser({ id: userId, patch: { isActive } });
      toast.success(t('users.updateSuccess'));
    } catch (err) {
      console.error('update status error', err);
      toast.error(t('users.updateError'));
    } finally {
      setUpdatingIds((s) => {
        const copy = new Set(s);
        copy.delete(userId);
        return copy;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('users.title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{t('users.title')}</CardTitle>
            <Button onClick={handleOpenCreate}>
              {t('users.createUser')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">{t('common.noData')}</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t('common.name')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('users.username') || 'Username'}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('users.role')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{`${u.firstName} ${u.lastName}`}</TableCell>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(v) => handleRoleChange(u.id, v)}
                          disabled={updatingIds.has(u.id) || !isAdmin}
                        >
                          <SelectTrigger className="h-7 px-1 py-0 text-[0.75rem] w-[150px] inline-flex items-center justify-start overflow-hidden whitespace-nowrap truncate">
                            <span className="truncate">{getRoleLabel(u.role)}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={String(u.isActive)}
                          onValueChange={(v) => handleStatusChange(u.id, v === 'true')}
                          disabled={updatingIds.has(u.id) || !isAdmin}
                        >
                          <SelectTrigger className="h-7 px-1 py-0 text-[0.75rem] w-[150px] inline-flex items-center justify-start overflow-hidden whitespace-nowrap truncate">
                            <span className="truncate">{getStatusLabel(u.isActive)}</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={'true'}>{t('common.active')}</SelectItem>
                            <SelectItem value={'false'}>{t('common.inactive')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setForm(createInitialForm());
            setFormErrors({});
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.createUser')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">{t('users.username') || 'Username'}</Label>
              <Input
                id="username"
                value={form.username}
                placeholder={t('users.usernamePlaceholder') || 'Enter username'}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm({ ...form, username: value });
                  setFormErrors((prev) => ({
                    ...prev,
                    username: value ? getUsernameError(value) : getUsernameError(''),
                  }));
                }}
                onBlur={() => setFormErrors((prev) => ({ ...prev, username: getUsernameError(form.username) }))}
                className={formErrors.username ? 'border-destructive focus-visible:ring-destructive' : undefined}
              />
              {formErrors.username ? (
                <p className="text-xs text-destructive">{formErrors.username}</p>
              ) : null}
            </div>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">{t('users.firstName')}</Label>
                <Input id="firstName" value={form.firstName} placeholder={t('users.firstNamePlaceholder') as string} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">{t('users.lastName')}</Label>
                <Input id="lastName" value={form.lastName} placeholder={t('users.lastNamePlaceholder') as string} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('users.password')}</Label>
              <Input id="password" type="password" value={form.password} placeholder="********" onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>{t('users.role')}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as CreateUserDto['role'] })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('users.rolePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCreate}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmitCreate} disabled={isCreating}>{isCreating ? t('common.loading') : t('users.createUser')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;


