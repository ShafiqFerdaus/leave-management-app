'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from 'framer-motion';
import { Home, Users, ShieldCheck, User, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface DockIconProps {
  mouseX: MotionValue<number>;
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick: () => void;
  isDanger?: boolean;
}

function DockIcon({ mouseX, title, icon, isActive, onClick, isDanger }: DockIconProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Calculate distance from cursor for smooth magnification effect
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() || { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  // High-performance spring configuration (eliminates rendering lag)
  const widthSync = useTransform(distance, [-120, 0, 120], [44, 66, 44]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 350, damping: 22 });

  return (
    <div className="relative group">
      <motion.div
        ref={ref}
        style={{ width, height: width }}
        onClick={onClick}
        className={`flex items-center justify-center rounded-2xl cursor-pointer transition-colors duration-150 transform-gpu will-change-transform border shadow-md ${
          isDanger
            ? 'bg-red-500/20 border-red-300/40 text-red-600 hover:bg-red-500/30'
            : isActive
            ? 'bg-white border-white text-blue-900 shadow-lg shadow-blue-900/10'
            : 'bg-white/60 border-white/80 text-gray-700 hover:bg-white/90'
        }`}
      >
        {/* Active item bouncing effect */}
        {isActive ? (
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="flex items-center justify-center"
          >
            {icon}
          </motion.div>
        ) : (
          icon
        )}
      </motion.div>

      {/* Hover tooltip label */}
      <span className="absolute -top-10 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform duration-150 bg-gray-900/90 text-white text-[11px] font-medium px-2.5 py-0.5 rounded-md shadow-lg pointer-events-none z-50 whitespace-nowrap">
        {title}
      </span>
    </div>
  );
}

export default function MacDock({ userRole: propRole }: { userRole?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const mouseX = useMotionValue(Infinity);
  const [role, setRole] = useState<string>(propRole || '');

  useEffect(() => {
    if (propRole) {
      setRole(propRole.toUpperCase());
      return;
    }

    async function fetchRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role) {
        setRole(profile.role.toString().trim().toUpperCase());
      }
    }

    fetchRole();
  }, [propRole, pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Successfully logged out.');
    router.push('/login');
  };

  const navItems = [
    { title: 'Employee Portal', icon: <Home className="w-5 h-5" />, path: '/' },
    ...(role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'ADMIN'
      ? [{ title: 'Manager Dashboard', icon: <Users className="w-5 h-5" />, path: '/manager' }]
      : []),
    ...(role === 'SUPER_ADMIN' || role === 'ADMIN'
      ? [{ title: 'Super Admin', icon: <ShieldCheck className="w-5 h-5" />, path: '/admin' }]
      : []),
    { title: 'My Profile', icon: <User className="w-5 h-5" />, path: '/profile' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex items-end gap-2.5 px-3 py-2.5 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl shadow-black/10 transform-gpu"
      >
        {navItems.map((item) => (
          <DockIcon
            key={item.path}
            mouseX={mouseX}
            title={item.title}
            icon={item.icon}
            isActive={pathname === item.path}
            onClick={() => router.push(item.path)}
          />
        ))}

        {/* Divider line */}
        <div className="w-[1px] h-7 bg-gray-300/60 mx-0.5 self-center" />

        {/* Sign Out Action Button */}
        <DockIcon
          mouseX={mouseX}
          title="Sign Out"
          icon={<LogOut className="w-5 h-5" />}
          onClick={handleSignOut}
          isDanger
        />
      </motion.div>
    </div>
  );
}