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

interface ManagedEmployee {
  id: string;
  full_name: string;
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [managedEmployees, setManagedEmployees] = useState<ManagedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Filter States
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL');
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('ALL');
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

    // Verify manager or admin role
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const userRole = (userProfile?.role || '').toString().trim().toUpperCase();

    if (userRole !== 'MANAGER' && userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setAccessDenied(false);

    // Fetch employees assigned under this manager
    const { data: staffList } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('manager_id', session.user.id);

    if (staffList) {
      setManagedEmployees(staffList);
    }

    await fetchRequests(session.user.id, userRole);
  }

  async function fetchRequests(managerId: string, role: string) {
    let query = supabase
      .from('leave_requests')
      .select('*, users!user_id(full_name, email), leave_types(name)')
      .order('created_at', { ascending: false });

    // If role is MANAGER, only retrieve leave requests for their assigned staff
    if (role === 'MANAGER') {
      const { data: staff } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', managerId);

      const staffIds = staff?.map((s) => s.id) || [];
      query = query.in('user_id', staffIds);
    }

    const { data, error } = await query;

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

    toast.success(`Leave application for ${req.users?.full_name || 'employee'} approved.`);

    // Send email notification to applicant
    if (req.users?.email) {
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: req.users.email,
          subject: `[HYDAC Leave Portal] Leave Application Approved`,
          html: `<p>Your leave application for <strong>${req.leave_types?.name}</strong> has been APPROVED.</p>`,
        }),
      }).catch((err) => console.error('Email notification error:', err));
    }

    setActionLoading(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) fetchRequests(session.user.id, 'MANAGER');
  };

  const handleReject = async (id: string, applicantName?: string) => {
    setActionLoading(id);
    const targetReq = requests.find((r) => r.id === id);

    await supabase
      .from('leave_requests')
      .update({ status: 'REJECTED' })
      .eq('id', id);

    toast.error(`Leave application for ${applicantName || 'employee'} rejected.`);

    if (targetReq?.users?.email) {
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetReq.users.email,
          subject: `[HYDAC Leave Portal] Leave Application Status Update`,
          html: `<p>Your leave application has been REJECTED.</p>`,
        }),
      }).catch((err) => console.error('Email notification error:', err));
    }

    setActionLoading(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) fetchRequests(session.user.id, 'MANAGER');
  };

  // Filter requests based on status, selected employee, and leave type
  const filteredRequests = requests.filter((req) => {
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const matchesEmployee = selectedEmployee === 'ALL' || req.user_id === selectedEmployee;
    const matchesType = selectedLeaveType === 'ALL' || req.leave_types?.name === selectedLeaveType;
    return matchesStatus && matchesEmployee && matchesType;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Verifying authorization...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-500">You do not have manager privileges to view this portal.</p>
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
    <main className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
            <p className="text-gray-500">Review and filter leave applications for your staff</p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white/70 backdrop-blur-md p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Employee Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Filter Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg text-xs font-medium px-3 py-2 text-gray-800 focus:outline-none"
              >
                <option value="ALL">All Employees under me</option>
                {managedEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Leave Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Filter Leave Type</label>
              <select
                value={selectedLeaveType}
                onChange={(e) => setSelectedLeaveType(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg text-xs font-medium px-3 py-2 text-gray-800 focus:outline-none"
              >
                <option value="ALL">All Leave Types</option>
                <option value="Annual Leave">Annual Leave</option>
                <option value="Medical Leave (MC)">Medical Leave (MC)</option>
                <option value="Emergency Leave">Emergency Leave</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
              </select>
            </div>
          </div>

          {/* Status Tabs */}
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

        {/* Applications Table */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          {filteredRequests.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">No leave requests match the selected filters.</p>
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
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {req.users?.full_name || 'Unknown'}
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
                      <td className="py-3 px-4 text-center">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={actionLoading === req.id}
                              className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 font-semibold transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(req.id, req.users?.full_name)}
                              disabled={actionLoading === req.id}
                              className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 font-semibold transition"
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