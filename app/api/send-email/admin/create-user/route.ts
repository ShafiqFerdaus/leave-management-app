import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin client using Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, fullName, role, jobTitle, managerId, phoneNumber, leaveAllocations } = await request.json();

    // Generate a temporary 8-character random password / OTP
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    // 1. Create user in Supabase Authentication System
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) throw authError;

    // 2. Insert user record into public.users table with job title and manager reference
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authUser.user.id,
          email,
          full_name: fullName,
          role: role || 'EMPLOYEE',
          job_title: jobTitle,
          manager_id: managerId || null,
          phone_number: phoneNumber || null,
          is_first_login: true
        }
      ]);

    if (profileError) throw profileError;

    // 3. Populate customized initial leave balances set by Super Admin
    const currentYear = new Date().getFullYear();
    if (leaveAllocations && Array.isArray(leaveAllocations)) {
      const balanceInserts = leaveAllocations.map((alloc: { leave_type_id: string; total_days: number }) => ({
        user_id: authUser.user.id,
        leave_type_id: alloc.leave_type_id,
        total_allocated: alloc.total_days,
        used_days: 0,
        year: currentYear
      }));

      const { error: balanceError } = await supabaseAdmin.from('leave_balances').insert(balanceInserts);
      if (balanceError) console.error('Error setting leave balances:', balanceError.message);
    }

    // 4. Send invitation email with temporary credentials via Resend API
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: '[HYDAC Leave Portal] Account Invitation & Temporary Credentials',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #1e3a8a;">Welcome to HYDAC Leave Portal</h2>
            <p>Hi <strong>${fullName}</strong>,</p>
            <p>Your account has been created by HR / Super Admin.</p>
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