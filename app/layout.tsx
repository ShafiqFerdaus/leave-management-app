import './globals.css';
import { Toaster } from 'sonner';
import MacDock from './components/MacDock';

export const metadata = {
  title: 'HYDAC Leave Portal',
  description: 'Enterprise Leave Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/70 via-slate-100/80 to-indigo-100/70 min-h-screen text-gray-900 antialiased relative">
        <Toaster position="top-right" richColors />
        {children}
        {/* Liquid Glass macOS Dock Navigation */}
        <MacDock />
      </body>
    </html>
  );
}