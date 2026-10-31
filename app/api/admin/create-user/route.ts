import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, fullName, role, jobTitle, managerId, phoneNumber, joinedDate, leaveAllocations } = await request.json();

    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    // 1. Create authentication record
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) throw authError;

    // 2. Insert profile record in public.users table
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authUser.user.id,
          email,
          full_name: fullName,
          role: role || 'EMPLOYEE',
          job_title: jobTitle || null,
          manager_id: managerId || null,
          phone_number: phoneNumber || null,
          joined_date: joinedDate || new Date().toISOString().split('T')[0],
          is_first_login: true
        }
      ]);

    if (profileError) throw profileError;

    // 3. Populate custom leave allocations
    const currentYear = new Date().getFullYear();
    if (leaveAllocations && Array.isArray(leaveAllocations)) {
      const balanceInserts = leaveAllocations.map((alloc: { leave_type_id: string; total_days: number }) => ({
        user_id: authUser.user.id,
        leave_type_id: alloc.leave_type_id,
        total_allocated: alloc.total_days,
        used_days: 0,
        year: currentYear
      }));

      await supabaseAdmin.from('leave_balances').insert(balanceInserts);
    }

    // 4. Send email invitation credentials
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    await fetch(`${siteUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: '[HYDAC Leave Portal] Account Invitation & Credentials',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #1e3a8a;">Welcome to HYDAC Leave Portal</h2>
            <p>Hi <strong>${fullName}</strong>,</p>
            <p>Your account has been created by Super Admin.</p>
            <p><strong>Job Title:</strong> ${jobTitle || 'Staff'}</p>
            <p><strong>Temporary Password (OTP):</strong> <code style="background: #f3f4f6; padding: 4px 8px; font-weight: bold;">${tempPassword}</code></p>
            <p>Please log in and update your password immediately upon first sign in.</p>
          </div>
        `
      })
    });

    return NextResponse.json({ success: true, message: 'User created successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}