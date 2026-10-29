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
  status: string;
  attachment_url?: string;
  created_at: string;
  users?: {
    full_name: string;
    email: string;
  };
  leave_types?: {
    name: string;
  };
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeEmail, setActiveEmail] = useState<string>('');
  const [activeRole, setActiveRole] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

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

    const currentEmail = session.user.email || '';
    setActiveEmail(currentEmail);

    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error || !userProfile) {
      console.warn('Role verification error:', error?.message);
    }

    // Trim whitespace to handle trailing spaces from database string values
    const rawRole = userProfile?.role || 'UNKNOWN';
    const userRole = rawRole.toString().trim().toUpperCase();
    setActiveRole(userRole);

    if (userRole !== 'MANAGER' && userRole !== 'ADMIN') {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setAccessDenied(false);
    await fetchRequests();
  }

  async function fetchRequests() {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, users!user_id(full_name, email), leave_types(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error.message);
    } else if (data) {
      setRequests(data as any);
    }

    setLoading(false);
  }

  const handleApprove = async (req: LeaveRequest) => {
    if (req.status !== 'PENDING' || actionLoading) return;

    setActionLoading(req.id);

    const { error: reqError } = await supabase
      .from('leave_requests')
      .update({ status: 'APPROVED' })
      .eq('id', req.id);

    if (reqError) {
      toast.error('Failed to approve request: ' + reqError.message);
      setActionLoading(null);
      return;
    }

    const currentYear = new Date().getFullYear();
    const isEL = req.leave_types?.name.toLowerCase().includes('emergency');

    if (isEL) {
      const { data: userBalances } = await supabase
        .from('leave_balances')
        .select('*, leave_types(name)')
        .eq('user_id', req.user_id)
        .eq('year', currentYear);

      const alBalance = userBalances?.find((b) => b.leave_types?.name.toLowerCase().includes('annual'));
      const elBalance = userBalances?.find((b) => b.leave_types?.name.toLowerCase().includes('emergency'));
      const unpaidBalance = userBalances?.find((b) => b.leave_types?.name.toLowerCase().includes('unpaid'));

      const reqDays = req.total_days;
      const alRemaining = alBalance ? alBalance.total_allocated - alBalance.used_days : 0;

      if (alRemaining >= reqDays) {
        if (alBalance) {
          await supabase
            .from('leave_balances')
            .update({ used_days: alBalance.used_days + reqDays })
            .eq('id', alBalance.id);
        }
      } else if (alRemaining > 0) {
        const excessDays = reqDays - alRemaining;
        if (alBalance) {
          await supabase
            .from('leave_balances')
            .update({ used_days: alBalance.total_allocated })
            .eq('id', alBalance.id);
        }
        if (unpaidBalance) {
          await supabase
            .from('leave_balances')
            .update({ used_days: unpaidBalance.used_days + excessDays })
            .eq('id', unpaidBalance.id);
        }
      } else {
        if (unpaidBalance) {
          await supabase
            .from('leave_balances')
            .update({ used_days: unpaidBalance.used_days + reqDays })
            .eq('id', unpaidBalance.id);
        }
      }

      if (elBalance) {
        await supabase
          .from('leave_balances')
          .update({ used_days: elBalance.used_days + reqDays })
          .eq('id', elBalance.id);
      }
    } else {
      const { data: approvedRequests } = await supabase
        .from('leave_requests')
        .select('total_days')
        .eq('user_id', req.user_id)
        .eq('leave_type_id', req.leave_type_id)
        .eq('status', 'APPROVED');

      const totalUsedDays = approvedRequests?.reduce((sum, item) => sum + item.total_days, 0) || 0;

      await supabase
        .from('leave_balances')
        .update({ used_days: totalUsedDays })
        .eq('user_id', req.user_id)
        .eq('leave_type_id', req.leave_type_id)
        .eq('year', currentYear);
    }

    toast.success(`Leave application for ${req.users?.full_name || 'employee'} approved.`);
    setActionLoading(null);
    fetchRequests();
  };

  const handleReject = async (id: string, applicantName?: string) => {
    setActionLoading(id);
    await supabase
      .from('leave_requests')
      .update({ status: 'REJECTED' })
      .eq('id', id);

    toast.error(`Leave application for ${applicantName || 'employee'} rejected.`);
    setActionLoading(null);
    fetchRequests();
  };

  const exportToCSV = () => {
    if (requests.length === 0) {
      toast.error('No data available to export.');
      return;
    }

    const headers = ['Employee Name', 'Email', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status', 'Submitted At'];
    
    const rows = filteredRequests.map((req) => [
      `"${req.users?.full_name || 'N/A'}"`,
      `"${req.users?.email || 'N/A'}"`,
      `"${req.leave_types?.name || 'N/A'}"`,
      `"${req.start_date}"`,
      `"${req.end_date}"`,
      req.total_days,
      `"${req.reason.replace(/"/g, '""')}"`,
      `"${req.status}"`,
      `"${new Date(req.created_at).toLocaleDateString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HYDAC_Leave_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV report exported successfully!');
  };

  const filteredRequests = requests.filter((req) => {
    if (statusFilter === 'ALL') return true;
    return req.status === statusFilter;
  });

  const totalPending = requests.filter((r) => r.status === 'PENDING').length;
  const totalApproved = requests.filter((r) => r.status === 'APPROVED').length;
  const totalRejected = requests.filter((r) => r.status === 'REJECTED').length;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Verifying authorization...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">
            Logged in as <span className="font-semibold text-gray-800">{activeEmail}</span> (Role: <span className="font-semibold text-gray-800">{activeRole}</span>).
          </p>
          <p className="text-xs text-gray-400">
            You do not have manager privileges to view this portal.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-900 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-800 transition"
          >
            Back to Employee Portal
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">HYDAC Leave Portal</h1>
            <p className="text-gray-500">Manager Approval Dashboard</p>
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

        {/* Dashboard Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Applications</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{requests.length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-yellow-200 bg-yellow-50/30">
            <p className="text-xs font-semibold text-yellow-700 uppercase">Pending Approval</p>
            <p className="text-3xl font-bold text-yellow-800 mt-2">{totalPending}</p>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-green-200 bg-green-50/30">
            <p className="text-xs font-semibold text-green-700 uppercase">Approved</p>
            <p className="text-3xl font-bold text-green-800 mt-2">{totalApproved}</p>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-red-200 bg-red-50/30">
            <p className="text-xs font-semibold text-red-700 uppercase">Rejected</p>
            <p className="text-3xl font-bold text-red-800 mt-2">{totalRejected}</p>
          </div>
        </div>

        {/* Requests Management Panel */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Leave Applications</h2>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={exportToCSV}
                className="bg-gray-800 text-white text-xs px-3.5 py-2 rounded-lg hover:bg-gray-700 font-semibold transition"
              >
                Export CSV
              </button>

              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                      statusFilter === status
                        ? 'bg-white text-blue-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <p className="text-gray-500 text-sm">No leave requests found for this category.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
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
                  {filteredRequests.map((req) => (
                    <tr key={req.id}>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {req.users?.full_name || 'Unknown Employee'}
                        </div>
                        <div className="text-xs text-gray-400">{req.users?.email}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800">{req.leave_types?.name}</td>
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={actionLoading === req.id}
                              className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 font-semibold transition disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(req.id, req.users?.full_name)}
                              disabled={actionLoading === req.id}
                              className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 font-semibold transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Completed</span>
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