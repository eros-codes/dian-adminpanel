import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/Layout/MainLayout';
import LoginPage from '@/components/Auth/LoginPage';
import Dashboard from '@/pages/Dashboard';
import Banners from '@/pages/Banners';
import Products from '@/pages/Products';
import Orders from '@/pages/Orders';
import Users from '@/pages/Users';
import Categories from '@/pages/Categories';
import SalesReport from '@/pages/SalesReport';
import FooterSettings from '@/pages/FooterSettings';
import Comments from '@/pages/Comments';
import Tables from '@/pages/Tables';

import './i18n';

// Redirect '/' to role-appropriate home
function RoleHomeRedirect() {
  const { user } = useAuthStore();
  const role = user?.role;
  const to = role === 'ADMIN' ? '/dashboard' : role === 'PRIMARY' ? '/orders' : role === 'SECONDARY' ? '/products' : '/login';
  return <Navigate to={to} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: unknown) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

function App() {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Set initial direction based on language
    document.documentElement.dir = i18n.language === 'fa' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background font-sans antialiased">
          <Routes>
            <Route 
              path="/login" 
              element={
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
              } 
            />
            
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <RoleHomeRedirect />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/*" 
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route 
                path="dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              
              {/* Products - Admin + Primary Inventor */}
              <Route 
                path="products" 
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'SECONDARY']}>
                    <Products />
                  </ProtectedRoute>
                } 
              />
              
              {/* Orders - Admin + Secondary Inventor */}
              <Route 
                path="orders" 
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'PRIMARY']}>
                    <Orders />
                  </ProtectedRoute>
                } 
              />
              
              {/* Categories - Admin only */}
              <Route 
                path="categories" 
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'SECONDARY']}>
                    <Categories />
                  </ProtectedRoute>
                } 
              />

              {/* Banners - Admin + Primary */}
              <Route
                path="banners"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'SECONDARY']}>
                    <Banners />
                  </ProtectedRoute>
                }
              />
              
              {/* Users - Admin only */}
              <Route 
                path="users" 
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'PRIMARY']}>
                    <Users />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="footer-settings"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <FooterSettings />
                  </ProtectedRoute>
                }
              />

              {/* Sales Report - Admin + Primary */}
              <Route
                path="sales-report"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'PRIMARY']}>
                    <SalesReport />
                  </ProtectedRoute>
                }
              />
              
              {/* Comments - Admin only */}
              <Route
                path="comments"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Comments />
                  </ProtectedRoute>
                }
              />

              <Route
                path="tables"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Tables />
                  </ProtectedRoute>
                }
              />

            </Route>
          </Routes>
          
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                fontFamily: 'system-ui, -apple-system, sans-serif',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;