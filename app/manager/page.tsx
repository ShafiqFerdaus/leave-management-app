'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_url?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  users?: {
    full_name: string;
    email: string;
  };
  leave_types?: {
    name: string;
  };
}

interface Employee {
  id: string;
  full_name: string;
}

interface LeaveType {
  id: string;
  name: string;
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  // Filter states
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL');
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    checkManagerRoleAndFetch();
  }, []);

  async function checkManagerRoleAndFetch() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    // Fetch user profile to verify role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const userRole = (profile?.role || '').toString().trim().toUpperCase();

    // Strict restriction: Only MANAGER role can access Manager Dashboard
    if (userRole !== 'MANAGER') {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setAccessDenied(false);
    await fetchData(session.user.id);
    setLoading(false);
  }

  async function fetchData(managerId: string) {
    // 1. Fetch leave types for filtering
    const { data: types } = await supabase.from('leave_types').select('id, name');
    if (types) setLeaveTypes(types);

    // 2. Fetch direct report employees under this manager
    const { data: reports } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('manager_id', managerId);

    if (reports) setEmployees(reports);

    // 3. Fetch leave applications for staff managed by this manager
    const reportIds = reports ? reports.map((r) => r.id) : [];

    if (reportIds.length === 0) {
      setLeaveRequests([]);
      return;
    }

    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('*, users(full_name, email), leave_types(name)')
      .in('user_id', reportIds)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load leave applications: ' + error.message);
    } else if (requests) {
      setLeaveRequests(requests as any);
    }
  }

  // Handle Approve / Reject Actions with confirmation and email notifications
  const handleUpdateStatus = async (requestId: string, newStatus: 'APPROVED' | 'REJECTED', staffName: string) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to set the status of ${staffName}'s leave request to ${newStatus}?`
    );
    if (!isConfirmed) return;

    setProcessingId(requestId);

    try {
      // 1. Update status in leave_requests table
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      // 2. Fetch request details for email notification dispatch
      const targetRequest = leaveRequests.find((r) => r.id === requestId);

      if (targetRequest && targetRequest.users?.email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        await fetch(`${siteUrl}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: targetRequest.users.email,
            subject: `[HYDAC Leave Portal] Leave Application ${newStatus}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #1e3a8a;">Leave Application Update</h2>
                <p>Hi <strong>${staffName}</strong>,</p>
                <p>Your leave application for <strong>${targetRequest.leave_types?.name}</strong> (${targetRequest.start_date} to ${targetRequest.end_date}) has been <strong style="color: ${newStatus === 'APPROVED' ? '#16a34a' : '#dc2626'};">${newStatus}</strong> by your manager.</p>
              </div>
            `,
          }),
        });
      }

      toast.success(`Leave request ${newStatus.toLowerCase()} successfully!`);

      // Refresh data
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await fetchData(session.user.id);
    } catch (err: any) {
      toast.error('Action failed: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Dynamic filter logic
  const filteredRequests = leaveRequests.filter((req) => {
    if (selectedEmployee !== 'ALL' && req.user_id !== selectedEmployee) return false;
    if (selectedLeaveType !== 'ALL' && req.leave_type_id !== selectedLeaveType) return false;
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-gray-600 font-medium">Verifying Manager Access...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-600">Only authorized Managers can access this dashboard.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-900 text-white font-semibold py-2 px-4 rounded-xl hover:bg-blue-800 transition"
          >
            Back to Employee Portal
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent py-10 px-4 sm:px-6 lg:px-8 pb-36">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-xl">
          <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-gray-600 mt-1">Review and manage leave applications submitted by your team</p>
        </div>

        {/* Filters Panel */}
        <div className="bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white/70 shadow-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Filter Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full bg-white/80 border border-white/90 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                <option value="ALL">All Employees under me</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Filter Leave Type</label>
              <select
                value={selectedLeaveType}
                onChange={(e) => setSelectedLeaveType(e.target.value)}
                className="w-full bg-white/80 border border-white/90 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                <option value="ALL">All Leave Types</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Status Filter</label>
              <div className="flex bg-white/80 border border-white/90 rounded-xl p-1 gap-1">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`flex-1 py-1 text-xs font-semibold rounded-lg transition ${
                      statusFilter === st
                        ? 'bg-blue-900 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Leave Requests Table */}
        <div className="bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white/70 shadow-xl space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200/50 pb-3">Team Leave Applications</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-white/60 text-gray-700 uppercase text-xs font-semibold">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">End Date</th>
                  <th className="py-3 px-4 text-center">Days</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-center">Attachment</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500 font-medium">
                      No leave applications found.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id}>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {req.users?.full_name || 'Staff'}
                      </td>
                      <td className="py-3 px-4">{req.leave_types?.name || 'Leave'}</td>
                      <td className="py-3 px-4">{req.start_date}</td>
                      <td className="py-3 px-4">{req.end_date}</td>
                      <td className="py-3 px-4 text-center font-bold text-gray-900">{req.total_days}</td>
                      <td className="py-3 px-4 max-w-xs truncate">{req.reason || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        {req.attachment_url ? (
                          <a
                            href={req.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-blue-900 underline hover:text-blue-700"
                          >
                            View MC
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              disabled={processingId === req.id}
                              onClick={() => handleUpdateStatus(req.id, 'APPROVED', req.users?.full_name || 'Staff')}
                              className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              disabled={processingId === req.id}
                              onClick={() => handleUpdateStatus(req.id, 'REJECTED', req.users?.full_name || 'Staff')}
                              className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}