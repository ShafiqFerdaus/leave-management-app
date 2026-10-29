'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }

    setLoading(true);

    // Send password reset email via Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profile`,
    });

    setLoading(false);

    if (error) {
      toast.error('Failed to send reset link: ' + error.message);
    } else {
      setSubmitted(true);
      toast.success('Password reset link sent to your email!');
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/hydac-logo.png"
            alt="HYDAC Logo"
            className="h-12 w-auto mx-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 className="text-2xl font-bold text-gray-900">Reset Your Password</h1>
          <p className="text-sm text-gray-500">
            Enter your email to receive a password reset link
          </p>
        </div>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-3">
            <p className="text-sm text-green-800 font-medium">
              We have sent a password reset link to <span className="font-bold">{email}</span>.
            </p>
            <p className="text-xs text-green-600">
              Please check your inbox and click the link to update your password.
            </p>
            <Link
              href="/login"
              className="inline-block text-xs font-semibold text-blue-900 hover:underline pt-2"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee@hydac.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-900 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600">
          Remembered your password?{' '}
          <Link href="/login" className="text-blue-900 font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}