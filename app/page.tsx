'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LeaveType {
  id: string;
  name: string;
}

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  total_allocated: number;
  used_days: number;
  year: number;
  leave_types?: {
    name: string;
  };
}

interface LeaveRequest {
  id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: string;
  attachment_url?: string;
  created_at: string;
  leave_types?: {
    name: string;
  };
}

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

  const [selectedType, setSelectedType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [totalDays, setTotalDays] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkUserAndFetch();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setTotalDays(diffDays);
      } else {
        setTotalDays(0);
      }
    } else {
      setTotalDays(0);
    }
  }, [startDate, endDate]);

  async function checkUserAndFetch() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    const uid = session.user.id;
    const email = session.user.email || '';
    setUserId(uid);
    setUserEmail(email);

    // Fetch User Profile
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', uid)
      .single();

    if (profile?.full_name) {
      setUserName(profile.full_name);
    }

    await fetchData(uid);
    setLoading(false);
  }

  async function fetchData(uid: string) {
    const currentYear = new Date().getFullYear();

    // Fetch Leave Types
    const { data: types } = await supabase.from('leave_types').select('*');
    if (types) setLeaveTypes(types);

    // Fetch Leave Balances
    const { data: balances } = await supabase
      .from('leave_balances')
      .select('*, leave_types(name)')
      .eq('user_id', uid)
      .eq('year', currentYear);
    if (balances) setLeaveBalances(balances as any);

    // Fetch My Requests
    const { data: requests } = await supabase
      .from('leave_requests')
      .select('*, leave_types(name)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (requests) setMyRequests(requests as any);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) return;
    if (!selectedType || !startDate || !endDate || !reason) {
      toast.error('Please complete all required fields.');
      return;
    }

    if (totalDays <= 0) {
      toast.error('End Date must be on or after Start Date.');
      return;
    }

    // SEMAKAN MANDATORI DOKUMEN SOKONGAN UNTUK MC DAN EMERGENCY LEAVE (EL)
    const selectedTypeObj = leaveTypes.find((t) => t.id === selectedType);
    const selectedTypeName = selectedTypeObj?.name.toLowerCase() || '';

    const isAttachmentMandatory =
      selectedTypeName.includes('medical') ||
      selectedTypeName.includes('mc') ||
      selectedTypeName.includes('emergency') ||
      selectedTypeName.includes('el');

    if (isAttachmentMandatory && !file) {
      toast.error('Supporting document (MC / Attachment) is required for Medical and Emergency Leave.');
      return;
    }

    setSubmitting(true);
    let attachmentUrl = '';

    // Handle File Upload if exists
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, file);

      if (uploadError) {
        toast.error('Failed to upload document: ' + uploadError.message);
        setSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(fileName);

      attachmentUrl = publicUrlData.publicUrl;
    }

    // Insert leave application
    const { error } = await supabase.from('leave_requests').insert([
      {
        user_id: userId,
        leave_type_id: selectedType,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason,
        attachment_url: attachmentUrl || null,
        status: 'PENDING',
      },
    ]);

    setSubmitting(false);

    if (error) {
      toast.error('Failed to submit application: ' + error.message);
    } else {
      toast.success('Leave request submitted successfully!');

      // Send email notification to Manager (Resend Free Tier Test Target)
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'shafiqqferdaus@gmail.com',
          subject: `[HYDAC Leave Portal] New Leave Application from ${userName || userEmail}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #1e3a8a;">New Leave Application</h2>
              <p>Employee <strong>${userName || userEmail}</strong> has submitted a new leave application.</p>
              <ul>
                <li><strong>Type:</strong> ${selectedTypeObj?.name || 'Leave'}</li>
                <li><strong>Dates:</strong> ${startDate} to ${endDate} (${totalDays} day/s)</li>
                <li><strong>Reason:</strong> ${reason}</li>
              </ul>
              <p>Please log in to the <a href="https://leave-management-app-seven-omega.vercel.app/manager">Manager Dashboard</a> to review this application.</p>
            </div>
          `,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.error('Email sending failed:', data.error);
          } else {
            console.log('Email sent successfully:', data);
          }
        })
        .catch((err) => console.error('Email fetch error:', err));

      setSelectedType('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setFile(null);
      fetchData(userId);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Loading portal details...</p>
      </main>
    );
  }

  // Tentukan sama ada pilihan jenis cuti semasa memerlukan dokumen sokongan
  const currentSelectedTypeObj = leaveTypes.find((t) => t.id === selectedType);
  const currentTypeName = currentSelectedTypeObj?.name.toLowerCase() || '';
  const isCurrentTypeAttachmentRequired =
    currentTypeName.includes('medical') ||
    currentTypeName.includes('mc') ||
    currentTypeName.includes('emergency') ||
    currentTypeName.includes('el');

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">HYDAC Leave Portal</h1>
            <p className="text-gray-500">Welcome back, {userName || userEmail}</p>
          </div>
          <div className="flex items-center">
            <img
              src="/hydac-logo.png"
              alt="HYDAC Logo"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Leave Balances Summary */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Your Leave Balances ({new Date().getFullYear()})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {leaveBalances.map((balance) => {
              const remaining = balance.total_allocated - balance.used_days;
              return (
                <div key={balance.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-1">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    {balance.leave_types?.name}
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {remaining} <span className="text-xs font-normal text-gray-500">days remaining</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Used: {balance.used_days} / Total: {balance.total_allocated}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Apply Leave Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-3">Apply for Leave</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                <select
                  required
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supporting Document (MC / Attachment) {isCurrentTypeAttachmentRequired && <span className="text-red-600 font-bold">*</span>}
                </label>
                <input
                  type="file"
                  required={isCurrentTypeAttachmentRequired}
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Days</label>
                <input
                  type="text"
                  readOnly
                  value={totalDays ? `${totalDays} Day(s)` : '-'}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-700 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State your reason for leave application..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-900 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting Application...' : 'Submit Leave Request'}
            </button>
          </form>
        </div>

        {/* My Leave Requests History */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-3">My Application History</h2>

          {myRequests.length === 0 ? (
            <p className="text-gray-500 text-sm">No leave applications submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Start Date</th>
                    <th className="py-3 px-4">End Date</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Doc</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {myRequests.map((req) => (
                    <tr key={req.id}>
                      <td className="py-3 px-4 font-medium text-gray-900">{req.leave_types?.name}</td>
                      <td className="py-3 px-4">{req.start_date}</td>
                      <td className="py-3 px-4">{req.end_date}</td>
                      <td className="py-3 px-4 font-semibold text-gray-800">{req.total_days}</td>
                      <td className="py-3 px-4">{req.reason}</td>
                      <td className="py-3 px-4">
                        {req.attachment_url ? (
                          <a
                            href={req.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs font-semibold"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            req.status === 'APPROVED'
                              ? 'bg-green-100 text-green-800'
                              : req.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}