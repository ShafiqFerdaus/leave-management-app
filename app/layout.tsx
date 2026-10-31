import './globals.css';
import { Toaster } from 'sonner';
import MacDock from './components/MacDock'; // Updated import path to match app/components location

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
      <body className="bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 min-h-screen text-gray-900 antialiased relative">
        <Toaster position="top-right" richColors />
        {children}
        {/* macOS Dock Navigation Bar */}
        <MacDock />
      </body>
    </html>
  );
}