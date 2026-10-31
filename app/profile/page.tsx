'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { User, Crop, Check, X } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [joinedDate, setJoinedDate] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [yearsOfService, setYearsOfService] = useState<string>('0.0');

  // Image Cropper Modal States
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Security password change states
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
      setAvatarUrl(profile.avatar_url || '');

      const userJoined = profile.joined_date || '2024-01-01';
      setJoinedDate(userJoined);
      calculateTenure(userJoined);
    }

    setLoading(false);
  }

  const calculateTenure = (dateString: string) => {
    if (!dateString) return;
    const start = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const years = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
    setYearsOfService(years);
  };

  const handleJoinedDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setJoinedDate(val);
    calculateTenure(val);
  };

  // Open Image Crop Modal on file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImageSrc(reader.result as string);
        setZoomLevel(1);
      };
      reader.readAsDataURL(file);
    }
  };

  // Process HTML5 Canvas Circular Crop and Upload to Supabase Storage
  const handleCropAndUpload = async () => {
    if (!selectedImageSrc || !imageRef.current) return;

    try {
      setUploadingAvatar(true);
      const canvas = document.createElement('canvas');
      const size = 300;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (ctx && imageRef.current) {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();

        const img = imageRef.current;
        const minDim = Math.min(img.naturalWidth, img.naturalHeight);
        const cropSize = minDim / zoomLevel;
        const startX = (img.naturalWidth - cropSize) / 2;
        const startY = (img.naturalHeight - cropSize) / 2;

        ctx.drawImage(img, startX, startY, cropSize, cropSize, 0, 0, size, size);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      );

      if (!blob) throw new Error('Canvas cropping failed');

      const filePath = `${userId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setSelectedImageSrc(null);
      toast.success('Profile picture cropped and updated successfully!');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const isConfirmed = window.confirm('Save profile changes and updated Joined Date?');
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
      toast.success('Profile details updated!');
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

    const isConfirmed = window.confirm('Confirm updating security password?');
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
        {/* Profile Card Header */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-xl flex items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-white/80 border-2 border-white shadow-md flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <label className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white text-xs font-semibold opacity-0 group-hover:opacity-100 cursor-pointer transition">
              <Crop className="w-4 h-4 mb-1" />
              <span>{uploadingAvatar ? 'Saving...' : 'Crop Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>
            <p className="text-gray-600 text-sm mt-0.5">{jobTitle} • {role}</p>
          </div>
        </div>

        {/* Personal & Employment Form */}
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
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Joined Date (Editable)</label>
                <input
                  type="date"
                  value={joinedDate}
                  onChange={handleJoinedDateChange}
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

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-900 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-blue-800 transition shadow-md disabled:opacity-50"
            >
              {saving ? 'Saving Details...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Password Form */}
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

      {/* Image Crop Modal */}
      {selectedImageSrc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-white">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-bold text-gray-900">Crop Profile Photo</h3>
              <button onClick={() => setSelectedImageSrc(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-blue-900 shadow-inner flex items-center justify-center bg-gray-100">
              <img
                ref={imageRef}
                src={selectedImageSrc}
                alt="Crop preview"
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-w-full max-h-full object-cover transition-transform"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 text-center">Zoom & Adjust</label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedImageSrc(null)}
                className="w-1/2 bg-gray-200 text-gray-800 text-xs font-semibold py-2 rounded-xl hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCropAndUpload}
                disabled={uploadingAvatar}
                className="w-1/2 bg-blue-900 text-white text-xs font-semibold py-2 rounded-xl hover:bg-blue-800 flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" />
                {uploadingAvatar ? 'Uploading...' : 'Apply Crop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}