'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  remaining_days: number;
  total_allocated: number;
  used_days: number;
  leave_types: {
    id: string;
    name: string;
  };
}

interface LeaveType {
  id: string;
  name: string;
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
  leave_types: {
    name: string;
  };
}

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  // Form State
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    // Populate current year safely on client mount to prevent prerender hydration errors
    setCurrentYear(new Date().getFullYear());
    checkUserAndFetch();
  }, []);

  // Validate active authenticated user session and fetch user data
  async function checkUserAndFetch() {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    const currentUserId = session.user.id;
    setUserId(currentUserId);
    setUserEmail(session.user.email || '');

    // Retrieve user profile details
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', currentUserId)
      .single();

    if (profile) {
      setUserName(profile.full_name);
    }

    await fetchData(currentUserId);
  }

  async function fetchData(activeUserId: string) {
    const activeYear = new Date().getFullYear();

    // 1. Fetch user leave balances for current year
    let { data: balanceData } = await supabase
      .from('leave_balances')
      .select('*, leave_types(id, name)')
      .eq('user_id', activeUserId)
      .eq('year', activeYear);

    // 2. Auto-allocate new year balances if not generated yet
    if (!balanceData || balanceData.length === 0) {
      await supabase.rpc('ensure_user_year_balance', {
        target_user_id: activeUserId,
        target_year: activeYear,
      });

      const { data: newBalanceData } = await supabase
        .from('leave_balances')
        .select('*, leave_types(id, name)')
        .eq('user_id', activeUserId)
        .eq('year', activeYear);

      balanceData = newBalanceData;
    }

    // 3. Fetch leave types
    const { data: typesData } = await supabase
      .from('leave_types')
      .select('*');

    // 4. Fetch leave request history for current user
    const { data: requestsData } = await supabase
      .from('leave_requests')
      .select('*, leave_types(name)')
      .eq('user_id', activeUserId)
      .order('created_at', { ascending: false });

    if (balanceData) setBalances(balanceData as any);
    if (typesData) setLeaveTypes(typesData);
    if (requestsData) setRequests(requestsData as any);

    setLoading(false);
  }

  // Check if current selected leave type requires an attachment (Medical or Emergency Leave)
  const requiresAttachment = () => {
    const selected = leaveTypes.find((t) => t.id === selectedType);
    if (!selected) return false;
    const typeName = selected.name.toLowerCase();
    return typeName.includes('medical') || typeName.includes('emergency');
  };

  const isEmergencyLeave = () => {
    const selected = leaveTypes.find((t) => t.id === selectedType);
    return selected?.name.toLowerCase().includes('emergency');
  };

  const isUnpaidLeave = () => {
    const selected = leaveTypes.find((t) => t.id === selectedType);
    return selected?.name.toLowerCase().includes('unpaid');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) return;

    if (!selectedType || !startDate || !endDate || !reason) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (requiresAttachment() && !file) {
      toast.error('Please upload a supporting document / MC for this leave request.');
      return;
    }

    // Calculate working days excluding weekends
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      toast.error('End date cannot be earlier than start date.');
      return;
    }

    let totalDays = 0;
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (totalDays === 0) {
      toast.error('Selected date range contains no working days.');
      return;
    }

    // Skip strict balance check for Emergency Leave & Unpaid Leave
    if (!isEmergencyLeave() && !isUnpaidLeave()) {
      const selectedBalance = balances.find(
        (b) => b.leave_type_id === selectedType || b.leave_types?.id === selectedType
      );

      if (!selectedBalance) {
        toast.error('Selected leave type balance record not found.');
        return;
      }

      const pendingDays = requests
        .filter((r) => r.leave_type_id === selectedType && r.status === 'PENDING')
        .reduce((sum, r) => sum + r.total_days, 0);

      const availableDays = selectedBalance.total_allocated - selectedBalance.used_days - pendingDays;

      if (totalDays > availableDays) {
        toast.error(
          `Insufficient leave balance. Requested: ${totalDays} day(s), Available: ${Math.max(0, availableDays)} day(s)${
            pendingDays > 0 ? ` (${pendingDays} day(s) currently pending approval)` : ''
          }.`
        );
        return;
      }
    }

    setSubmitting(true);

    let attachmentUrl = '';

    // Upload attachment to Supabase Storage if file selected
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `mc/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('mc-attachments')
        .upload(filePath, file);

      if (uploadError) {
        toast.error('Failed to upload document: ' + uploadError.message);
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('mc-attachments')
        .getPublicUrl(filePath);

      attachmentUrl = urlData.publicUrl;
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
      setSelectedType('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setFile(null);
      fetchData(userId);
    }
  };

  // Allow employee to cancel their pending leave request
  const handleCancelRequest = async (requestId: string) => {
    setCancellingId(requestId);

    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', requestId)
      .eq('status', 'PENDING');

    setCancellingId(null);

    if (error) {
      toast.error('Failed to cancel request: ' + error.message);
    } else {
      toast.success('Leave request cancelled successfully.');
      if (userId) fetchData(userId);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">HYDAC Leave Portal</h1>
            <p className="text-gray-500">Welcome, {userName || userEmail || 'Employee'}</p>
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

        {/* Leave Balances Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Your Leave Balances ({currentYear ?? ''})
          </h2>
          {loading ? (
            <p className="text-gray-500">Loading balances...</p>
          ) : balances.length === 0 ? (
            <p className="text-gray-500 text-sm">No leave balances found for your account.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {balances.map((item) => {
                const isUncapped =
                  item.leave_types?.name.toLowerCase().includes('emergency') ||
                  item.leave_types?.name.toLowerCase().includes('unpaid') ||
                  item.leave_types?.name.toLowerCase().includes('replacement') ||
                  item.leave_types?.name.toLowerCase().includes('earned day');

                return (
                  <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {item.leave_types?.name}
                    </p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-bold text-blue-900">
                        {isUncapped ? item.used_days : item.total_allocated - item.used_days}
                      </span>
                      <span className="text-xs text-gray-400">
                        {isUncapped ? 'Days Taken' : `of ${item.total_allocated} Days`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Used: {item.used_days} days</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Apply for Leave Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Apply for Leave</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                <option value="">Select Leave Type</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for leave..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            {requiresAttachment() && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supporting Document / MC <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-900 hover:file:bg-blue-100"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-900 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </div>

        {/* Leave Request History Table */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">My Leave History</h2>
          {requests.length === 0 ? (
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
                    <th className="py-3 px-4">Attachment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requests.map((req) => (
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
                            View Doc
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
                      <td className="py-3 px-4 text-center">
                        {req.status === 'PENDING' ? (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            disabled={cancellingId === req.id}
                            className="text-xs text-red-600 hover:text-red-800 font-semibold underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
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