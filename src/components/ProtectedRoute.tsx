import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles = [] 
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const [isHydrating, setIsHydrating] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Give zustand-persist a moment to hydrate from storage
    const id = setTimeout(() => setIsHydrating(false), 0);
    return () => clearTimeout(id);
  }, []);

  if (isHydrating) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    // Redirect to a safe default route per role to avoid redirect loops
    const role = user.role;
    const fallback = role === 'ADMIN'
      ? '/dashboard'
      : role === 'PRIMARY'
      ? '/orders'
      : role === 'SECONDARY'
      ? '/products'
      : '/login';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;