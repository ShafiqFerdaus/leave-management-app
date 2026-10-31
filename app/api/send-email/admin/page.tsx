'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  job_title?: string;
  manager_id?: string;
  phone_number?: string;
}

interface LeaveType {
  id: string;
  name: string;
}

interface UserBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  total_allocated: number;
  used_days: number;
  leave_types?: { name: string };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);

  // Registration form states
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [jobTitle, setJobTitle] = useState('');
  const [managerId, setManagerId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [quotas, setQuotas] = useState<{ [key: string]: number }>({});

  // Modal edit states
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userBalances, setUserBalances] = useState<UserBalance[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAdminRoleAndFetch();
  }, []);

  async function checkAdminRoleAndFetch() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    // Verify Super Admin permission
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const userRole = (profile?.role || '').toString().trim().toUpperCase();

    if (userRole !== 'SUPER_ADMIN') {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setAccessDenied(false);
    await fetchData();
    setLoading(false);
  }

  async function fetchData() {
    // Fetch leave types
    const { data: types } = await supabase.from('leave_types').select('*');
    if (types) {
      setLeaveTypes(types);
      const defaultQuotas: { [key: string]: number } = {};
      types.forEach((t) => {
        if (t.name.toLowerCase().includes('annual')) defaultQuotas[t.id] = 14;
        else if (t.name.toLowerCase().includes('medical')) defaultQuotas[t.id] = 14;
        else if (t.name.toLowerCase().includes('hospitalization')) defaultQuotas[t.id] = 60;
        else defaultQuotas[t.id] = 0;
      });
      setQuotas(defaultQuotas);
    }

    // Fetch user profiles
    const { data: allUsers } = await supabase.from('users').select('*').order('full_name');
    if (allUsers) {
      setUsers(allUsers);
      setManagers(allUsers.filter((u) => u.role === 'MANAGER' || u.role === 'SUPER_ADMIN'));
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const leaveAllocations = Object.entries(quotas).map(([leave_type_id, total_days]) => ({
      leave_type_id,
      total_days,
    }));

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          role,
          jobTitle,
          managerId,
          phoneNumber,
          leaveAllocations,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success(`User ${fullName} registered successfully!`);
      setEmail('');
      setFullName('');
      setJobTitle('');
      setPhoneNumber('');
      setManagerId('');
      fetchData();
    } catch (err: any) {
      toast.error('Registration failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = async (user: UserProfile) => {
    setEditingUser(user);
    const currentYear = new Date().getFullYear();
    const { data: balances } = await supabase
      .from('leave_balances')
      .select('*, leave_types(name)')
      .eq('user_id', user.id)
      .eq('year', currentYear);

    if (balances) setUserBalances(balances as any);
  };

  const handleUpdateBalance = async (balanceId: string, newTotal: number, newUsed: number) => {
    const { error } = await supabase
      .from('leave_balances')
      .update({ total_allocated: newTotal, used_days: newUsed })
      .eq('id', balanceId);

    if (error) {
      toast.error('Update failed: ' + error.message);
    } else {
      toast.success('Leave quota updated!');
      if (editingUser) openEditModal(editingUser);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast.error('Role update failed: ' + error.message);
    } else {
      toast.success(`Role changed to ${newRole}`);
      fetchData();
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900/10 flex items-center justify-center">
        <p className="text-gray-600 font-medium">Verifying Authorization...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-slate-900/10 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-600">Only HR Super Admin accounts are permitted to access this portal.</p>
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
        {/* Page Header */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-xl shadow-blue-900/5">
          <h1 className="text-3xl font-bold text-gray-900">HR Super Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage Staff Entitlements, Job Titles, and Portal Privileges</p>
        </div>

        {/* Register Staff Panel */}
        <div className="bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white/70 shadow-xl space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200/50 pb-3">Register New Staff</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ahmad Razak"
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ahmad@hydac.com"
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">WhatsApp Phone</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 60123456789"
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Technician"
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Assign Manager</label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                >
                  <option value="">No Manager Assigned</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.job_title || m.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Quota Controls */}
            <div className="border-t border-gray-200/50 pt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Set Leave Quotas (Days)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {leaveTypes.map((t) => (
                  <div key={t.id}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{t.name}</label>
                    <input
                      type="number"
                      min="0"
                      value={quotas[t.id] ?? 0}
                      onChange={(e) => setQuotas({ ...quotas, [t.id]: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white/70 border border-white/80 rounded-xl px-3 py-1.5 text-sm text-gray-900 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-900 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-blue-800 transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
            >
              {submitting ? 'Registering Staff...' : 'Register Staff & Send Credentials'}
            </button>
          </form>
        </div>

        {/* Staff Management Table */}
        <div className="bg-white/50 backdrop-blur-xl p-6 rounded-3xl border border-white/70 shadow-xl space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200/50 pb-3">Organization Directory</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-white/60 text-gray-700 uppercase text-xs font-semibold">
                <tr>
                  <th className="py-3 px-4">Name & Email</th>
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{u.full_name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">{u.job_title || '-'}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="border border-white/80 rounded-lg text-xs px-2 py-1 bg-white/80 font-semibold"
                      >
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openEditModal(u)}
                        className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
                      >
                        Adjust Quotas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quota Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-white">
              <h3 className="text-lg font-bold text-gray-900">
                Adjust Leave Quotas for {editingUser.full_name}
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {userBalances.map((b) => (
                  <div key={b.id} className="bg-white/60 border border-gray-200 p-3 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{b.leave_types?.name}</p>
                      <p className="text-xs text-gray-500">Allocated: {b.total_allocated} | Used: {b.used_days}</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        defaultValue={b.total_allocated}
                        id={`total-${b.id}`}
                        className="w-16 border rounded-lg px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        defaultValue={b.used_days}
                        id={`used-${b.id}`}
                        className="w-16 border rounded-lg px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => {
                          const total = parseInt((document.getElementById(`total-${b.id}`) as HTMLInputElement).value);
                          const used = parseInt((document.getElementById(`used-${b.id}`) as HTMLInputElement).value);
                          handleUpdateBalance(b.id, total, used);
                        }}
                        className="bg-blue-900 text-white text-xs px-2.5 py-1 rounded-lg"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="w-full bg-gray-200 text-gray-800 font-semibold py-2 rounded-xl hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}