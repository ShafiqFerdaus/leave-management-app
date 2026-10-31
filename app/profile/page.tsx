'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [joinedDate, setJoinedDate] = useState('');
  const [yearsOfService, setYearsOfService] = useState<string>('0');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    const uid = session.user.id;
    setUserId(uid);
    setEmail(session.user.email || '');

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single();

    if (profile) {
      setFullName(profile.full_name || '');
      setRole(profile.role || 'EMPLOYEE');
      setJobTitle(profile.job_title || 'Staff');
      setPhoneNumber(profile.phone_number || '');
      setJoinedDate(profile.joined_date || new Date().toISOString().split('T')[0]);

      // Calculate service duration in years and months
      if (profile.joined_date) {
        const start = new Date(profile.joined_date);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const years = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
        setYearsOfService(years);
      }
    }

    setLoading(false);
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // Confirmation dialog before saving profile changes
    const isConfirmed = window.confirm('Are you sure you want to save these profile changes?');
    if (!isConfirmed) return;

    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        full_name: fullName,
        phone_number: phoneNumber,
        joined_date: joinedDate,
      })
      .eq('id', userId);

    setSaving(false);

    if (error) {
      toast.error('Failed to update profile: ' + error.message);
    } else {
      toast.success('Profile details updated successfully!');
      fetchProfile();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    const isConfirmed = window.confirm('Are you sure you want to change your password?');
    if (!isConfirmed) return;

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error('Password update failed: ' + error.message);
    } else {
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-gray-600 font-medium">Loading User Profile...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent py-10 px-4 sm:px-6 lg:px-8 pb-36">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-xl">
          <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
          <p className="text-gray-600 mt-1">Manage personal contact details, tenure info, and security credentials</p>
        </div>

        {/* Account Details & Phone Registration */}
        <div className="bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white/70 shadow-xl space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200/50 pb-3">Personal & Employment Information</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white/80 border border-white/90 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full bg-gray-100/70 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">WhatsApp Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 60123456789"
                  className="w-full bg-white/80 border border-white/90 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Joined Date</label>
                <input
                  type="date"
                  value={joinedDate}
                  onChange={(e) => setJoinedDate(e.target.value)}
                  className="w-full bg-white/80 border border-white/90 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Years of Service (Tenure)</label>
                <input
                  type="text"
                  disabled
                  value={`${yearsOfService} Year(s)`}
                  className="w-full bg-gray-100/70 border border-gray-200 rounded-xl px-3 py-2 text-sm text-blue-950 font-bold cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-gray-200/50 pt-4">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase mr-2">Role:</span>
                <span className="bg-blue-100 text-blue-900 text-xs font-bold px-2.5 py-1 rounded-full">{role}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase mr-2">Job Title:</span>
                <span className="text-xs font-semibold text-gray-800">{jobTitle}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-900 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-blue-800 transition shadow-md disabled:opacity-50"
            >
              {saving ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Change Password Panel */}
        <div className="bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white/70 shadow-xl space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200/50 pb-3">Change Security Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-white/80 border border-white/90 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full bg-white/80 border border-white/90 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-gray-800 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-gray-700 transition shadow-md"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}