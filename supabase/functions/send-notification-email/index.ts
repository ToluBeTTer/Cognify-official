// supabase/functions/send-notification-email/index.ts
//
// Called by the `trg_dispatch_notification_email` trigger (see the
// 20260708000002 migration) whenever a row is inserted into `notifications`.
// This is the only place that actually talks to an email provider — the
// database trigger just relays the payload here.
//
// One-time setup:
//   1. Sign up at https://resend.com, verify a sending domain, get an API key.
//   2. supabase functions deploy send-notification-email
//   3. supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//   4. Update FROM_EMAIL below (or set a FROM_EMAIL secret) to an address on
//      your verified domain.
//
// Until RESEND_API_KEY is set, this function responds 200 with
// { skipped: 'not_configured' } rather than erroring — the in-app
// notification still works either way; only the email is a no-op.

import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'Cognify <notifications@example.com>';

// Maps a notification `type` to the preference key saved by the Settings
// page (app/(app)/settings/page.tsx -> profile.preferences.notifications).
// Unmapped types default to "send" so nothing silently goes missing.
const TYPE_TO_PREF: Record<string, string> = {
  human_response_ready: 'email_human_response',
  response_approved: 'email_question_answered',
  response_rejected: 'email_question_answered',
};

interface NotificationPayload {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
}

Deno.serve(async (req: Request) => {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ skipped: 'not_configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as NotificationPayload;
    if (!payload?.user_id || !payload?.title) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, full_name, preferences')
      .eq('user_id', payload.user_id)
      .maybeSingle();

    if (error || !profile?.email) {
      return new Response(JSON.stringify({ skipped: 'no_email_on_profile' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const notifPrefs = (profile.preferences as any)?.notifications || {};
    const prefKey = TYPE_TO_PREF[payload.type];
    const shouldSend = prefKey ? notifPrefs[prefKey] !== false : true;

    if (!shouldSend) {
      return new Response(JSON.stringify({ skipped: 'user_opted_out' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const firstName = (profile.full_name || 'there').split(' ')[0];

    const emailRes = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: profile.email,
        subject: payload.title,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #0f172a;">${payload.title}</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.5;">
              Hi ${firstName}, ${payload.message}
            </p>
            <p style="margin-top: 24px;">
              <a href="${Deno.env.get('APP_URL') || ''}" style="color: #4f46e5;">Open Cognify</a>
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
              You're receiving this because of your notification settings in Cognify.
              You can adjust what you get emailed about from Settings → Notifications.
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text().catch(() => '');
      console.error('Resend API error', emailRes.status, errText);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 502 });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-notification-email error', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500 });
  }
});
