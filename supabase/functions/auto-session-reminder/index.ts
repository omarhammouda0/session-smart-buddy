import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto Session Reminder - v4.0
// Runs on schedule (pg_cron) to send dual WhatsApp reminders at configurable intervals
// UPDATED: Now supports multiple users - processes each user's settings and sessions separately
// This ensures reminders work even when the app is closed

// Twilio credentials - must be configured in Supabase secrets
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886";

// Germany timezone: CET (UTC+1) in winter, CEST (UTC+2) in summer
function isDaylightSavingTime(date: Date): boolean {
  const year = date.getUTCFullYear();
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0, 0));
  const octLast = new Date(Date.UTC(year, 9, 31));
  const dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0, 0));
  return date >= dstStart && date < dstEnd;
}

function getGermanyTimezoneOffset(date: Date): number {
  return isDaylightSavingTime(date) ? 2 : 1;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get current time in Germany timezone as components (more reliable than Date manipulation)
function getGermanyTimeComponents(date: Date): { hours: number; minutes: number; dateStr: string; totalMinutes: number } {
  const offset = getGermanyTimezoneOffset(date);
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();

  let germanyHours = utcHours + offset;
  let dayOffset = 0;

  if (germanyHours >= 24) {
    germanyHours -= 24;
    dayOffset = 1;
  } else if (germanyHours < 0) {
    germanyHours += 24;
    dayOffset = -1;
  }

  const adjustedDate = new Date(date);
  adjustedDate.setUTCDate(adjustedDate.getUTCDate() + dayOffset);
  const dateStr = adjustedDate.toISOString().split('T')[0];

  return {
    hours: germanyHours,
    minutes: utcMinutes,
    dateStr,
    totalMinutes: germanyHours * 60 + utcMinutes
  };
}

// Format phone number for WhatsApp
function formatPhoneForWhatsApp(phone: string): string {
  let formatted = phone.replace(/[^\d+]/g, "");
  if (formatted.startsWith("0")) {
    formatted = "20" + formatted.substring(1); // Egypt default
  }
  formatted = formatted.replace("+", "");
  return `whatsapp:+${formatted}`;
}

// Send WhatsApp message via Twilio directly (not through another edge function)
async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const whatsappTo = formatPhoneForWhatsApp(phone);
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const fromNumber = TWILIO_WHATSAPP_FROM?.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_FROM
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;

  const formData = new URLSearchParams();
  formData.append("To", whatsappTo);
  formData.append("From", fromNumber);
  formData.append("Body", message);

  try {
    console.log(`Sending WhatsApp to ${whatsappTo.substring(0, 15)}...`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return { success: false, error: `Failed to parse Twilio response: ${responseText.substring(0, 200)}` };
    }

    if (!response.ok) {
      return { success: false, error: data.message || data.error_message || `Twilio error: ${response.status}` };
    }

    return { success: true, messageSid: data.sid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Calculate minutes until a session from current Germany time
function calculateMinutesUntilSession(
  sessionDate: string,
  sessionTime: string,
  germanyNow: { dateStr: string; totalMinutes: number }
): number {
  const [sessionHour, sessionMinute] = sessionTime.split(':').map(Number);
  const sessionMinutesOfDay = sessionHour * 60 + sessionMinute;

  if (sessionDate === germanyNow.dateStr) {
    return sessionMinutesOfDay - germanyNow.totalMinutes;
  } else if (sessionDate > germanyNow.dateStr) {
    const nowDate = new Date(germanyNow.dateStr + 'T00:00:00Z');
    const sessDate = new Date(sessionDate + 'T00:00:00Z');
    const daysDiff = Math.round((sessDate.getTime() - nowDate.getTime()) / (24 * 60 * 60 * 1000));

    const minutesRemainingToday = 24 * 60 - germanyNow.totalMinutes;
    const fullDaysMinutes = (daysDiff - 1) * 24 * 60;
    return minutesRemainingToday + fullDaysMinutes + sessionMinutesOfDay;
  } else {
    return -1; // Past date
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("=== Auto Session Reminder v4.0 (Multi-User Support) ===");

  try {
    const now = new Date();
    const germanyNow = getGermanyTimeComponents(now);

    console.log(`UTC: ${now.toISOString()}`);
    console.log(`Germany: ${germanyNow.dateStr} ${String(germanyNow.hours).padStart(2, '0')}:${String(germanyNow.minutes).padStart(2, '0')}`);

    // Check Twilio credentials early
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error("❌ Twilio credentials not configured - cannot send reminders");
      return new Response(
        JSON.stringify({ success: false, error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("✓ Twilio credentials configured");

    // Fetch ALL users' reminder settings (not just 'default')
    const { data: allSettings, error: settingsError } = await supabase
      .from('reminder_settings')
      .select('*')
      .eq('session_reminders_enabled', true);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw settingsError;
    }

    if (!allSettings || allSettings.length === 0) {
      console.log("⏸ No users have session reminders enabled");
      return new Response(
        JSON.stringify({ success: true, message: "No users have session reminders enabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✓ Found ${allSettings.length} user(s) with session reminders enabled`);

    let globalTotalSent = 0;
    let globalTotalSkipped = 0;
    let globalTotalErrors = 0;
    const globalResults: any[] = [];

    // Helper function to validate UUID format
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Process each user separately
    for (const settings of allSettings) {
      const userId = settings.user_id;

      // Skip invalid user IDs (like 'default')
      if (!isValidUUID(userId)) {
        console.log(`\n⚠️ Skipping invalid user_id: ${userId} (not a valid UUID)`);
        continue;
      }

      console.log(`\n========== Processing user: ${userId} ==========`);

      const reminderHours1 = settings.session_reminder_hours || 24;
      const reminderHours2 = settings.session_reminder_hours_2 || 1;

      const reminderTemplate1 = settings.session_reminder_template_1 ||
        settings.session_reminder_template ||
        'مرحباً {student_name}،\nتذكير: لديك جلسة غداً بتاريخ {date} الساعة {time}.\nنراك قريباً!';

      const reminderTemplate2 = settings.session_reminder_template_2 ||
        'مرحباً {student_name}،\nجلستك تبدأ خلال ساعة واحدة الساعة {time}!\nالرجاء الاستعداد.';

      console.log(`Reminder intervals: ${reminderHours1}h and ${reminderHours2}h`);

      // Create reminder intervals with specific time windows
      const createReminderWindow = (hours: number, otherHours: number) => {
        if (hours <= 2) {
          const minBound = otherHours < hours ? otherHours : 0;
          return { min: minBound, max: hours };
        } else {
          const tolerance = Math.min(2, hours * 0.2);
          const minBound = Math.max(hours - tolerance, otherHours);
          return { min: minBound, max: hours + tolerance };
        }
      };

      const intervals = [
        { hours: reminderHours1, template: reminderTemplate1 },
        { hours: reminderHours2, template: reminderTemplate2 }
      ].sort((a, b) => b.hours - a.hours);

      const longerHours = intervals[0].hours;
      const shorterHours = intervals[1].hours;

      const reminderIntervals = intervals.map((item, idx) => {
        const otherHours = idx === 0 ? shorterHours : longerHours;
        const window = createReminderWindow(item.hours, otherHours);
        return {
          ...item,
          interval: idx + 1,
          windowMin: window.min,
          windowMax: window.max
        };
      });

      console.log(`Reminder windows: ${reminderIntervals.map(r => `${r.hours}h: (${r.windowMin.toFixed(1)}, ${r.windowMax.toFixed(1)}]`).join(', ')}`);

      // Calculate date range
      const today = germanyNow.dateStr;
      const maxLookaheadMs = Math.max(longerHours, 48) * 60 * 60 * 1000;
      const futureDate = new Date(now.getTime() + maxLookaheadMs);
      const endDate = futureDate.toISOString().split('T')[0];

      console.log(`Checking sessions from ${today} to ${endDate}`);

      // Fetch sessions for THIS USER's students only
      // Join through students table to filter by user_id
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          date,
          time,
          student_id,
          students!inner (
            id,
            name,
            phone,
            parent_phone,
            session_time,
            user_id
          )
        `)
        .eq('status', 'scheduled')
        .eq('students.user_id', userId)
        .gte('date', today)
        .lte('date', endDate);

      if (sessionsError) {
        console.error(`Error fetching sessions for user ${userId}:`, sessionsError);
        continue; // Skip this user but continue with others
      }

      console.log(`Found ${sessions?.length || 0} scheduled sessions for user ${userId}`);

      if (!sessions || sessions.length === 0) {
        continue; // No sessions for this user
      }

      let userTotalSent = 0;
      let userTotalSkipped = 0;
      let userTotalErrors = 0;

      // Process each reminder interval
      for (const { hours, interval, template, windowMin, windowMax } of reminderIntervals) {
        console.log(`\n--- Processing interval ${interval} (${hours}h before) for user ${userId} ---`);

        let sentCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const session of sessions) {
          const studentData = Array.isArray(session.students) ? session.students[0] : session.students;
          const phone = studentData?.phone || studentData?.parent_phone;
          const sessionTime = session.time || studentData?.session_time || '16:00';
          const studentName = studentData?.name || 'الطالب';
          const studentId = studentData?.id;

          const minutesUntilSession = calculateMinutesUntilSession(session.date, sessionTime, germanyNow);
          const hoursUntilSession = minutesUntilSession / 60;

          // Log each session for debugging
          console.log(`  Session ${session.id}: ${session.date} ${sessionTime}, ${studentName}, ${hoursUntilSession.toFixed(2)}h away (window: ${windowMin.toFixed(1)}-${windowMax.toFixed(1)}h)`);

          if (hoursUntilSession > windowMax || hoursUntilSession <= windowMin || hoursUntilSession < 0) {
            console.log(`    → Outside window, skipping`);
            continue;
          }

          console.log(`    → ✓ In window! Checking phone...`);

          if (!phone) {
            console.log(`    → Skip - no phone number`);
            skippedCount++;
            continue;
          }

          // Check if reminder already sent
          const { data: existingReminder, error: reminderCheckError } = await supabase
            .from('reminder_log')
            .select('id')
            .eq('session_id', session.id)
            .eq('type', 'session')
            .eq('reminder_interval', interval)
            .eq('status', 'sent')
            .maybeSingle();

          if (reminderCheckError) {
            console.error(`Error checking reminder for ${session.id}:`, reminderCheckError);
          }

          if (existingReminder) {
            console.log(`Skip ${session.id} - interval ${interval} already sent`);
            skippedCount++;
            continue;
          }

          const message = template
            .replace(/{student_name}/g, studentName)
            .replace(/{date}/g, session.date)
            .replace(/{time}/g, sessionTime);

          console.log(`➤ Sending to ${studentName} (${session.date} ${sessionTime}, ${hoursUntilSession.toFixed(1)}h away)`);

          const result = await sendWhatsAppMessage(phone, message);

          // Log with correct user_id
          await supabase.from('reminder_log').insert({
            user_id: userId,
            type: 'session',
            student_id: studentId,
            student_name: studentName,
            phone_number: phone,
            message_text: message,
            status: result.success ? 'sent' : 'failed',
            twilio_message_sid: result.messageSid,
            error_message: result.error,
            session_id: session.id,
            session_date: session.date,
            reminder_interval: interval,
          });

          if (result.success) {
            console.log(`  ✓ Sent (${result.messageSid})`);
            sentCount++;
            globalResults.push({ userId, sessionId: session.id, interval, status: 'sent', messageSid: result.messageSid });
          } else {
            console.error(`  ✗ Failed: ${result.error}`);
            errorCount++;
            globalResults.push({ userId, sessionId: session.id, interval, status: 'failed', error: result.error });
          }
        }

        console.log(`Interval ${interval} for user ${userId}: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`);
        userTotalSent += sentCount;
        userTotalSkipped += skippedCount;
        userTotalErrors += errorCount;
      }

      console.log(`User ${userId} totals: ${userTotalSent} sent, ${userTotalSkipped} skipped, ${userTotalErrors} errors`);
      globalTotalSent += userTotalSent;
      globalTotalSkipped += userTotalSkipped;
      globalTotalErrors += userTotalErrors;
    }

    console.log(`\n=== Complete: ${globalTotalSent} sent, ${globalTotalSkipped} skipped, ${globalTotalErrors} errors across ${allSettings.length} users ===`);

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: allSettings.length,
        sent: globalTotalSent,
        skipped: globalTotalSkipped,
        errors: globalTotalErrors,
        results: globalResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-session-reminder:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
