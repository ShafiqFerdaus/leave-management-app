'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from 'framer-motion';
import { Home, Users, ShieldCheck, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DockIconProps {
  mouseX: MotionValue<number>;
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

function DockIcon({ mouseX, title, icon, isActive, onClick }: DockIconProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Measure distance from cursor to dock icon center for magnification effect
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() || { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  // Calculate dynamic width and height based on hover proximity
  const widthSync = useTransform(distance, [-150, 0, 150], [44, 68, 44]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 200, damping: 12 });

  return (
    <div className="relative group">
      <motion.div
        ref={ref}
        style={{ width, height: width }}
        onClick={onClick}
        className={`flex items-center justify-center rounded-2xl cursor-pointer transition-colors backdrop-blur-md border ${
          isActive
            ? 'bg-white/50 border-white/80 text-blue-900 shadow-lg'
            : 'bg-white/20 border-white/30 text-gray-700 hover:bg-white/40'
        }`}
      >
        {/* Active item bouncing animation */}
        {isActive ? (
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="flex items-center justify-center"
          >
            {icon}
          </motion.div>
        ) : (
          icon
        )}
      </motion.div>

      {/* Hover tooltip */}
      <span className="absolute -top-10 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all bg-gray-900/80 text-white text-[11px] px-2.5 py-1 rounded-md backdrop-blur-sm whitespace-nowrap shadow-md pointer-events-none">
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

    // Automatically fetch user role from Supabase session if prop is not provided
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

  // Filter navigation items dynamically based on current user role
  const navItems = [
    { title: 'Employee Portal', icon: <Home className="w-5 h-5" />, path: '/' },
    ...(role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'ADMIN'
      ? [{ title: 'Manager Dashboard', icon: <Users className="w-5 h-5" />, path: '/manager' }]
      : []),
    ...(role === 'SUPER_ADMIN' || role === 'ADMIN'
      ? [{ title: 'HR Super Admin', icon: <ShieldCheck className="w-5 h-5" />, path: '/admin' }]
      : []),
    { title: 'My Profile', icon: <User className="w-5 h-5" />, path: '/profile' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex items-end gap-3 px-4 py-3 rounded-3xl bg-white/30 backdrop-blur-xl border border-white/40 shadow-2xl shadow-black/10"
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
      </motion.div>
    </div>
  );
}