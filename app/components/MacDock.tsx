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

  // Measure distance for macOS dynamic magnification
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() || { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  // Smooth magnification spring curve
  const widthSync = useTransform(distance, [-150, 0, 150], [46, 72, 46]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 220, damping: 14 });

  return (
    <div className="relative group">
      <motion.div
        ref={ref}
        style={{ width, height: width }}
        onClick={onClick}
        className={`flex items-center justify-center rounded-2xl cursor-pointer transition-all duration-150 backdrop-blur-2xl border shadow-lg ${
          isDanger
            ? 'bg-red-500/15 border-red-300/40 text-red-600 hover:bg-red-500/30'
            : isActive
            ? 'bg-white/80 border-white/90 text-blue-900 shadow-xl shadow-blue-900/10'
            : 'bg-white/40 border-white/60 text-gray-700 hover:bg-white/60'
        }`}
      >
        {/* Active item dynamic bouncing effect */}
        {isActive ? (
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex items-center justify-center"
          >
            {icon}
          </motion.div>
        ) : (
          icon
        )}
      </motion.div>

      {/* Hover tooltip label */}
      <span className="absolute -top-11 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all duration-200 bg-gray-900/90 text-white text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-md whitespace-nowrap shadow-xl pointer-events-none z-50">
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
      ? [{ title: 'HR Super Admin', icon: <ShieldCheck className="w-5 h-5" />, path: '/admin' }]
      : []),
    { title: 'My Profile', icon: <User className="w-5 h-5" />, path: '/profile' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex items-end gap-3 px-4 py-3 rounded-3xl bg-white/30 backdrop-blur-2xl border border-white/70 shadow-2xl shadow-blue-950/15"
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

        {/* Vertical divider */}
        <div className="w-[1px] h-8 bg-white/60 mx-1 self-center" />

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