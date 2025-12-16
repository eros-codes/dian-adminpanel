import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Globe, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type ErrorCandidate = string | { message?: unknown; error?: unknown; msg?: unknown } | unknown[] | null | undefined;

interface HttpErrorLike {
  response?: {
    status?: number;
    data?: unknown;
  };
  data?: unknown;
  message?: string;
}

const extractMessage = (candidate: ErrorCandidate): string | null => {
  if (candidate == null) return null;
  if (typeof candidate === 'string') return candidate;
  if (Array.isArray(candidate) && candidate.length > 0) {
    return extractMessage(candidate[0] as ErrorCandidate);
  }
  if (typeof candidate === 'object') {
    const obj = candidate as { message?: unknown; error?: unknown; msg?: unknown };
    return (
      extractMessage(obj.message as ErrorCandidate) ??
      extractMessage(obj.error as ErrorCandidate) ??
      extractMessage(obj.msg as ErrorCandidate) ??
      null
    );
  }
  return null;
};

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const isRTL = i18n.language === 'fa';

  const validateUsername = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return t('auth.usernameRequired');
    if (trimmed.length < 4 || trimmed.length > 32) return t('auth.usernameLengthError');
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return t('auth.usernamePatternError');
    return '';
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fa' ? 'en' : 'fa';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'fa' ? 'rtl' : 'ltr';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameError(validationError);
      setError('');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(username.trim(), password);
      toast.success(t('auth.loginSuccess'));
      navigate('/dashboard');
    } catch (error: unknown) {
      // Prefer structured messages from backend and provide friendly fallbacks
      let errorMessage = t('auth.invalidCredentials');
      try {
        const httpError = error as HttpErrorLike;
        // Try several places where the backend or axios might put error info
        const resp = httpError.response?.data ?? httpError.data ?? httpError.response ?? null;

        const msg = extractMessage(resp as ErrorCandidate);

        if (msg) {
          const s = String(msg).toLowerCase();
          if (s.includes('deactiv') || s.includes('disabled')) {
            errorMessage = t('auth.accountDisabled');
          } else if (s.includes('invalid') || s.includes('credential') || s.includes('not found') || s.includes('incorrect') || httpError.response?.status === 401) {
            errorMessage = t('auth.invalidCredentials');
          } else {
            errorMessage = String(msg);
          }
        } else if (httpError.response?.status === 401) {
          // No structured message, but a 401 -> invalid credentials
          errorMessage = t('auth.invalidCredentials');
        } else if (httpError.message) {
          // Fallback to thrown message
          errorMessage = httpError.message;
        }
      } catch {
        // ignore parse errors and fall back
        const fallback = (error as { message?: string })?.message;
        if (fallback) errorMessage = fallback;
      }

      setError(errorMessage);
      toast.error(`${t('auth.loginErrorPrefix', { defaultValue: 'خطا در ورود:' })} ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Language Toggle */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            {i18n.language === 'fa' ? t('common.languageEnglish') : t('common.languagePersian')}
          </Button>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-primary">
                {t('auth.loginTitle')}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('auth.loginSubtitle')}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className={cn(
                  "text-sm font-medium",
                  isRTL ? "text-right" : "text-left"
                )}>
                  {t('auth.usernameLabel')}
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUsername(value);
                    setUsernameError(value ? validateUsername(value) : '');
                  }}
                  onBlur={() => {
                    setUsernameError(validateUsername(username));
                  }}
                  placeholder={t('auth.usernamePlaceholder') || 'admin'}
                  required
                  disabled={isLoading}
                  className={cn(
                    "transition-all duration-200",
                    isRTL ? "text-right" : "text-left",
                    usernameError ? 'border-destructive focus-visible:ring-destructive' : ''
                  )}
                />
                {usernameError ? (
                  <p className={cn('text-xs mt-1', 'text-destructive', isRTL ? 'text-right' : 'text-left')}>
                    {usernameError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className={cn(
                  "text-sm font-medium",
                  isRTL ? "text-right" : "text-left"
                )}>
                  {t('common.password')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  required
                  disabled={isLoading}
                  className={cn(
                    "transition-all duration-200",
                    isRTL ? "text-right" : "text-left"
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90 transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('auth.loginButton')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;