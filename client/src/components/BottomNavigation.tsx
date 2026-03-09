import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Package, Scan, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNavigation: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isAdmin) return null;

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard', path: '/admin-main' },
    { id: 'inventory', icon: Package, label: 'Inventory', path: '/inventory' },
    { id: 'scanner', icon: Scan, label: '', path: '/scanner', isScanner: true },
    { id: 'staff', icon: Users, label: 'Staff', path: '/staff' },
    { id: 'profile', icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 bg-transparent pointer-events-none">
      <div className="w-full max-w-lg mx-auto pointer-events-auto">
        {/* Soft UI Navigation Container */}
        <div
          className="relative bg-white/90 rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100/50 overflow-visible"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <div className="relative flex justify-around items-center py-4 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;

              if (item.isScanner) {
                return (
                  <button
                    key={item.id}
                    onClick={() => setLocation(item.path)}
                    data-testid={`nav-${item.id}`}
                    className="relative -top-8 z-10"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-[#BF953F] via-[#FCF6BA] to-[#B38728] rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(191,149,63,0.4)] touch-feedback hover:scale-110 active:scale-95 transition-all duration-300 transform border-4 border-white"
                         style={{
                           boxShadow: '0 10px 25px rgba(191, 149, 63, 0.4), inset 0 2px 4px rgba(255,255,255,0.5)',
                         }}>
                      <Icon className="w-8 h-8 text-[#5C4D2E] drop-shadow-sm" />
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setLocation(item.path)}
                  data-testid={`nav-${item.id}`}
                  className={cn(
                    "relative flex flex-col items-center py-2 px-4 transition-all duration-300 rounded-2xl group",
                    isActive
                      ? "text-[#BF953F]"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <div className="relative flex flex-col items-center">
                    <Icon
                      className={cn(
                        "w-6 h-6 mb-1 transition-all duration-300",
                        isActive
                          ? "text-[#BF953F] drop-shadow-sm scale-110"
                          : "group-hover:scale-110"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-tighter transition-all duration-300",
                        isActive ? "text-[#BF953F]" : "text-gray-400"
                      )}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute -bottom-2 w-1.5 h-1.5 rounded-full bg-[#BF953F]"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;
