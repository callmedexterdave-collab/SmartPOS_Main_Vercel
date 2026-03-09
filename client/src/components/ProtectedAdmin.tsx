import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

interface Props {
  component: React.ComponentType<any>;
}

export default function ProtectedAdmin({ component: Component }: Props) {
  const { isAdmin, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated || !isAdmin) {
    setLocation('/admin-login');
    return null;
  }
  return <Component />;
}

