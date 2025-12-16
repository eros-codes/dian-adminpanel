import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '@/lib/utils';

const MainLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize mobile state immediately to prevent flash
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'fa';

  // Check if mobile view
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Always ensure mobile menu is closed on screen size change
      setIsMobileMenuOpen(false);
      if (mobile) {
        setIsSidebarCollapsed(true);
      }
    };

    // Initial check
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Ensure mobile menu is closed on mount
  useEffect(() => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobile]);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobile && isMobileMenuOpen) {
        closeMobileMenu();
      }
    };

    if (isMobile && isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isMobile, isMobileMenuOpen]);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Mobile backdrop */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={closeMobileMenu}
        />
      )}
      
      {/* Sidebar */}
      {(!isMobile || isMobileMenuOpen) && (
        <div className={cn(
          'fixed top-0 h-full transition-transform duration-300',
          // Z-index: higher than backdrop but lower than modals
          isMobile ? 'z-40' : 'z-30',
          // Attach side based on direction
          isRTL ? 'right-0' : 'left-0',
          // Desktop behavior - always visible
          !isMobile && 'translate-x-0',
          // Mobile behavior: slide in when open
          isMobile && 'translate-x-0'
        )}>
          <Sidebar 
            isCollapsed={isMobile ? false : isSidebarCollapsed} 
            onToggle={toggleSidebar}
            isMobile={isMobile}
            onItemClick={isMobile ? closeMobileMenu : undefined}
            onClose={isMobile ? closeMobileMenu : undefined}
          />
        </div>
      )}
      
      {/* Main content */}
      <div className={cn(
        'min-h-screen flex flex-col transition-all duration-300',
        // Desktop padding (leave space for sidebar depending on side)
        !isMobile && (isSidebarCollapsed 
          ? (isRTL ? 'pr-16' : 'pl-16') 
          : (isRTL ? 'pr-64' : 'pl-64')
        ),
        // Mobile full width
        isMobile && 'px-0'
      )}>
        <Header onMenuClick={toggleSidebar} isMobile={isMobile} />
        <main className="flex-1 p-3 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;