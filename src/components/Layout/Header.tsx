import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LogOut, Globe, Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
  isMobile?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fa' ? 'en' : 'fa';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'fa' ? 'rtl' : 'ltr';
  };

  const handleLogout = () => {
    setShowLogoutDialog(false);
    logout();
  };

  return (
    <>
      <header className="bg-card border-b border-border px-3 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Menu toggle button - visible on both mobile and desktop */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">
              <span className="hidden sm:inline">{t('dashboard.welcome')}, </span>
              <span className="sm:hidden">سلام </span>
              {user?.firstName} {user?.lastName}
            </h1>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Language Toggle - Hidden on small screens */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="hidden sm:flex items-center gap-2"
            >
              <Globe className="h-4 w-4" />
              {i18n.language === 'fa' ? 'EN' : 'فا'}
            </Button>

            {/* Logout Button */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowLogoutDialog(true)}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.logout')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('common.logout')}</DialogTitle>
            <DialogDescription>
              {t('auth.logoutConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              {t('common.logout')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Header;