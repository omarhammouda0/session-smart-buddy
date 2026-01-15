import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Check Critical Alerts Edge Function - v2.0
// Runs via pg_cron to detect Priority 100 conditions and send push notifications
// FIXED: Now sends push notifications directly via Firebase FCM
// Handles: unconfirmed sessions, payment overdue 30+ days, 30-min pre-session reminders

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Germany timezone helpers
function isDaylightSavingTime(date: Date): boolean {
  const year = date.getUTCFullYear();
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0, 0));
  const octLast = new Date(Date.UTC(year, 9, 31));
  const dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0, 0));
  return date >= dstStart && date < dstEnd;
}

function getGermanyTime(date: Date): Date {
  const offset = isDaylightSavingTime(date) ? 2 : 1;
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (offset * 3600000));
}

// Convert number to Arabic numerals
function toArabicNumerals(num: number): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).split('').map(d => arabicNumerals[parseInt(d)] || d).join('');
}

// Generate JWT for Firebase Auth
async function generateFirebaseAccessToken(): Promise<string> {
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, '\n');
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");

  if (!privateKey || !clientEmail) {
    throw new Error("Firebase credentials not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
    scope: "https://www.googleapis.com/auth/firebase.messaging"
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Send push notification directly via Firebase FCM
async function sendPushNotification(
  supabase: any,
  alert: {
    title: string;
    body: string;
    priority: number;
    suggestionType: string;
    actionType: string;
    conditionKey: string;
    studentId?: string;
    sessionId?: string;
    studentPhone?: string;
  }
): Promise<{ sent: number; skipped: boolean; error?: string }> {
  try {
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "session-smart-buddy";

    // Check for duplicate notification
    if (alert.conditionKey) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('push_notification_log')
        .select('id')
        .eq('condition_key', alert.conditionKey)
        .eq('status', 'sent')
        .gte('sent_at', oneHourAgo)
        .maybeSingle();

      if (existing) {
        return { sent: 0, skipped: true };
      }
    }

    // Get active FCM tokens
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('fcm_token')
      .eq('is_active', true);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return { sent: 0, skipped: false, error: "No active subscriptions" };
    }

    // Get Firebase access token
    const accessToken = await generateFirebaseAccessToken();
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let successCount = 0;
    const results: any[] = [];

    for (const sub of subscriptions) {
      const message = {
        message: {
          token: sub.fcm_token,
          notification: { title: alert.title, body: alert.body },
          data: {
            priority: String(alert.priority),
            suggestionType: alert.suggestionType || '',
            actionType: alert.actionType || '',
            studentId: alert.studentId || '',
            sessionId: alert.sessionId || '',
            studentPhone: alert.studentPhone || '',
            conditionKey: alert.conditionKey || '',
            timestamp: new Date().toISOString()
          },
          webpush: {
            notification: {
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              dir: 'rtl',
              lang: 'ar',
              requireInteraction: alert.priority === 100,
              vibrate: [100, 50, 100]
            },
            fcm_options: { link: '/' }
          }
        }
      };

      try {
        const response = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(message)
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.error?.code === 404 || result.error?.details?.[0]?.errorCode === "UNREGISTERED") {
            await supabase.from('push_subscriptions').update({ is_active: false }).eq('fcm_token', sub.fcm_token);
          }
          results.push({ success: false, error: result.error });
        } else {
          successCount++;
          results.push({ success: true, messageId: result.name });
        }
      } catch (error) {
        results.push({ success: false, error: String(error) });
      }
    }

    // Log notification
    await supabase.from('push_notification_log').insert({
      user_id: 'default',
      suggestion_type: alert.suggestionType || 'general',
      priority: alert.priority,
      title: alert.title,
      body: alert.body,
      condition_key: alert.conditionKey,
      fcm_response: { results, sent: successCount, total: subscriptions.length },
      status: successCount > 0 ? 'sent' : 'failed'
    });

    return { sent: successCount, skipped: false };
  } catch (error) {
    return { sent: 0, skipped: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting critical alerts check...");

  try {
    const now = new Date();
    const localNow = getGermanyTime(now);
    const today = localNow.toISOString().split('T')[0];
    const currentHour = localNow.getHours();
    const currentMinute = localNow.getMinutes();

    console.log(`Current Germany time: ${localNow.toISOString()}, Date: ${today}`);

    const alerts: Array<{
      title: string;
      body: string;
      priority: number;
      suggestionType: string;
      actionType: string;
      conditionKey: string;
      studentId?: string;
      sessionId?: string;
      studentPhone?: string;
    }> = [];

    // ========================================
    // CHECK 1: Unconfirmed Ended Sessions (Priority 100)
    // ========================================
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        date,
        time,
        duration,
        status,
        student_id,
        students!inner (id, name, phone, parent_phone, session_time, default_duration)
      `)
      .eq('date', today)
      .eq('status', 'scheduled');

    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
    } else if (sessions) {
      for (const session of sessions) {
        const student = Array.isArray(session.students) ? session.students[0] : session.students;
        const sessionTime = session.time || student?.session_time || '16:00';
        const duration = session.duration || student?.default_duration || 60;

        const [hour, minute] = sessionTime.split(':').map(Number);
        const sessionEndMinutes = hour * 60 + minute + duration;
        const currentMinutes = currentHour * 60 + currentMinute;

        // Session has ended but not confirmed
        if (currentMinutes > sessionEndMinutes) {
          const conditionKey = `session_unconfirmed:${session.id}`;

          alerts.push({
            title: '⚠️ حصة محتاجة تأكيد',
            body: `حصة ${student?.name || 'طالب'} خلصت ومحتاجة تأكيد`,
            priority: 100,
            suggestionType: 'end_of_day',
            actionType: 'confirm_session',
            conditionKey,
            studentId: student?.id,
            sessionId: session.id
          });
        }

        // 30-minute pre-session reminder (25-35 min window)
        const sessionStartMinutes = hour * 60 + minute;
        const minutesUntilSession = sessionStartMinutes - currentMinutes;

        if (minutesUntilSession >= 25 && minutesUntilSession <= 35) {
          const conditionKey = `pre_session_30min:${session.id}:${today}`;

          // Get last session notes for this student
          const { data: lastNotes } = await supabase
            .from('session_notes')
            .select('notes, homework_status')
            .eq('student_id', student?.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let bodyText = `📚 حصة ${student?.name || 'طالب'} كمان ${toArabicNumerals(Math.round(minutesUntilSession))} دقيقة`;

          if (lastNotes?.notes) {
            const truncatedNotes = lastNotes.notes.length > 50
              ? lastNotes.notes.substring(0, 50) + '...'
              : lastNotes.notes;
            bodyText += `\nآخر ملاحظة: ${truncatedNotes}`;
          }

          // Add homework status
          if (lastNotes?.homework_status === 'assigned') {
            bodyText += '\nالواجب: واجب لم يُراجع';
          } else if (lastNotes?.homework_status === 'completed') {
            bodyText += '\nالواجب: واجب مكتمل ✓';
          } else if (lastNotes?.homework_status === 'incomplete') {
            bodyText += '\nالواجب: واجب غير مكتمل ✗';
          }

          alerts.push({
            title: '📚 تذكير قبل الحصة',
            body: bodyText,
            priority: 100,
            suggestionType: 'pre_session',
            actionType: 'pre_session',
            conditionKey,
            studentId: student?.id,
            sessionId: session.id
          });
        }
      }
    }

    // ========================================
    // CHECK 2: Payment Overdue 30+ Days (Priority 100)
    // ========================================
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, phone, parent_phone')
      .eq('is_active', true);

    if (studentsError) {
      console.error("Error fetching students:", studentsError);
    } else if (students) {
      for (const student of students) {
        // Get last payment date
        const { data: lastPayment } = await supabase
          .from('payments')
          .select('date')
          .eq('student_id', student.id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastPayment?.date) {
          const lastPaymentDate = new Date(lastPayment.date);
          const daysSincePayment = Math.floor((localNow.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSincePayment >= 30) {
            // Check if student is active (has sessions in last 60 days or upcoming)
            const sixtyDaysAgo = new Date(localNow.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const { data: recentSessions } = await supabase
              .from('sessions')
              .select('id')
              .eq('student_id', student.id)
              .or(`date.gte.${sixtyDaysAgo},date.gte.${today}`)
              .limit(1);

            const isActive = recentSessions && recentSessions.length > 0;

            if (isActive) {
              const conditionKey = `payment_overdue:${student.id}`;

              alerts.push({
                title: '💰 تذكير دفع متأخر',
                body: `⚠️ ${student.name} لم يدفع منذ ${toArabicNumerals(daysSincePayment)} يوم`,
                priority: 100,
                suggestionType: 'payment',
                actionType: 'record_payment',
                conditionKey,
                studentId: student.id,
                studentPhone: student.phone || student.parent_phone
              });
            }
          }
        } else {
          // No payment record at all - check if has sessions
          const { data: anySessions } = await supabase
            .from('sessions')
            .select('id, date')
            .eq('student_id', student.id)
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (anySessions) {
            const firstSessionDate = new Date(anySessions.date);
            const daysSinceFirstSession = Math.floor((localNow.getTime() - firstSessionDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceFirstSession >= 30) {
              const conditionKey = `payment_never:${student.id}`;

              alerts.push({
                title: '💰 لم يتم تسجيل أي دفعة',
                body: `⚠️ ${student.name} لم يدفع أبداً منذ ${toArabicNumerals(daysSinceFirstSession)} يوم`,
                priority: 100,
                suggestionType: 'payment',
                actionType: 'record_payment',
                conditionKey,
                studentId: student.id,
                studentPhone: student.phone || student.parent_phone
              });
            }
          }
        }
      }
    }

    console.log(`Found ${alerts.length} critical alerts`);

    // ========================================
    // SEND PUSH NOTIFICATIONS DIRECTLY
    // ========================================
    let sentCount = 0;
    let skippedCount = 0;

    for (const alert of alerts) {
      try {
        const result = await sendPushNotification(supabase, alert);

        if (result.skipped) {
          skippedCount++;
          console.log(`Skipped (duplicate): ${alert.conditionKey}`);
        } else if (result.sent > 0) {
          sentCount++;
          console.log(`Sent: ${alert.title} - ${alert.conditionKey}`);
        } else if (result.error) {
          console.error("Failed to send push notification:", result.error);
        }
      } catch (error) {
        console.error("Error sending push notification:", error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: {
          sessions: sessions?.length || 0,
          students: students?.length || 0
        },
        alerts: alerts.length,
        sent: sentCount,
        skipped: skippedCount,
        timestamp: localNow.toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error checking critical alerts:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

