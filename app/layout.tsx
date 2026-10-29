import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Navbar from './components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HYDAC Leave Portal',
  description: 'Employee Leave Management System for HYDAC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Global Toaster for feedback notifications */}
        <Toaster position="top-right" richColors />
        
        {/* Global Navbar Header */}
        <Navbar />

        {children}
      </body>
    </html>
  );
}