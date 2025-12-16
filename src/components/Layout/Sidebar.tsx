import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  BarChart,
  Image,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  Table2
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onItemClick?: () => void;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, isMobile = false, onItemClick, onClose }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { user } = useAuthStore();
  const isRTL = i18n.language === 'fa';


  const navigationItems = [
    {
      name: t('navigation.dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['ADMIN']
    },
    // Swap positions: Categories first, then Products
    {
      name: t('navigation.categories'),
      href: '/categories',
      icon: FolderTree,
      allowedRoles: ['ADMIN', 'SECONDARY']
    },
    {
      name: t('navigation.products'),
      href: '/products',
      icon: Package,
      allowedRoles: ['ADMIN', 'SECONDARY']
    },
    {
      name: t('navigation.banners'),
      href: '/banners',
      icon: Image,
      allowedRoles: ['ADMIN', 'SECONDARY']
    },
    {
      name: t('navigation.orders'),
      href: '/orders',
      icon: ShoppingCart,
      allowedRoles: ['ADMIN', 'PRIMARY']
    },
    // Sales Report
    {
      name: t('navigation.salesReport'),
      href: '/sales-report',
      icon: BarChart,
      allowedRoles: ['ADMIN', 'PRIMARY']
    },
    // Comments - Admin only
    {
      name: t('navigation.comments'),
      href: '/comments',
      icon: MessageSquare,
      allowedRoles: ['ADMIN']
    },
    {
      name: t('navigation.tables'),
      href: '/tables',
      icon: Table2,
      allowedRoles: ['ADMIN']
    },
    {
      name: t('navigation.users'),
      href: '/users',
      icon: Users,
      allowedRoles: ['ADMIN', 'PRIMARY']
    },
    // Move Footer Settings to the end, after Users
    {
      name: 'تنظیمات',
      href: '/footer-settings',
      icon: Settings,
      allowedRoles: ['ADMIN']
    },

  ];

  const role = user?.role || '';
  const filteredItems = role
    ? navigationItems.filter((item) => item.allowedRoles.includes(role))
    : navigationItems;
  const itemsToShow = filteredItems.length > 0 ? filteredItems : navigationItems;

  // After updating allowedRoles above, simple filtering is enough
  const roleScopedItems = itemsToShow;

  return (
    <div className={cn(
      "bg-card border-border transition-all duration-300 flex flex-col h-full fixed top-0 bottom-0 z-40",
      isRTL ? "right-0 border-l" : "left-0 border-r",
      // Desktop sizing
      !isMobile && (isCollapsed ? "w-16" : "w-64"),
      // Mobile full width with shadow
      isMobile && "w-64 shadow-xl"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {(!isCollapsed || isMobile) && (
            <h2 className="text-lg font-semibold text-foreground">
              {t('navigation.dashboard')}
            </h2>
          )}
          <div className="flex items-center gap-2">
            {/* Mobile close button */}
            {isMobile && onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-accent"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {/* Desktop toggle button */}
            {!isMobile && (
              <button
                onClick={onToggle}
                className="p-2 rounded-md hover:bg-accent"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                ) : (
                  isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {roleScopedItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    !isMobile && isCollapsed && "justify-center"
                  )}
                  title={!isMobile && isCollapsed ? item.name : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {(!isCollapsed || isMobile) && (
                    <span className={isRTL ? "text-right" : "text-left"}>
                      {item.name}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;