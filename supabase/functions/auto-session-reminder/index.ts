import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto Session Reminder - v3.0
// Runs on schedule (pg_cron) to send dual WhatsApp reminders at configurable intervals
// FIXED: Now calls Twilio directly instead of invoking another edge function
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

  console.log("=== Auto Session Reminder v3.0 (Direct Twilio) ===");

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

    // Fetch reminder settings
    const { data: settings, error: settingsError } = await supabase
      .from('reminder_settings')
      .select('*')
      .eq('user_id', 'default')
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw settingsError;
    }

    if (!settings?.session_reminders_enabled) {
      console.log("⏸ Session reminders are DISABLED");
      return new Response(
        JSON.stringify({ success: true, message: "Session reminders are disabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("✓ Session reminders are ENABLED");

    const reminderHours1 = settings.session_reminder_hours || 24;
    const reminderHours2 = settings.session_reminder_hours_2 || 1;

    const reminderTemplate1 = settings.session_reminder_template_1 ||
      settings.session_reminder_template ||
      'مرحباً {student_name}،\nتذكير: لديك جلسة غداً بتاريخ {date} الساعة {time}.\nنراك قريباً!';

    const reminderTemplate2 = settings.session_reminder_template_2 ||
      'مرحباً {student_name}،\nجلستك تبدأ خلال ساعة واحدة الساعة {time}!\nالرجاء الاستعداد.';

    console.log(`Reminder intervals: ${reminderHours1}h and ${reminderHours2}h`);

    // Create reminder intervals with specific time windows
    // Each reminder fires within a window around its target time, not filling gaps
    // Window logic:
    //   - For reminders <= 2 hours: window is (0, hours]
    //   - For reminders > 2 hours: window is (hours - tolerance, hours] where tolerance = min(2, hours * 0.2)
    const createReminderWindow = (hours: number, otherHours: number) => {
      if (hours <= 2) {
        // Short reminders: fire from 0 to the specified hours
        // But not below the other reminder if it's shorter
        const minBound = otherHours < hours ? otherHours : 0;
        return { min: minBound, max: hours };
      } else {
        // Longer reminders: fire within a ±2 hour window or 20% tolerance
        const tolerance = Math.min(2, hours * 0.2);
        // Don't overlap with shorter reminder
        const minBound = Math.max(hours - tolerance, otherHours);
        return { min: minBound, max: hours + tolerance };
      }
    };

    // Sort intervals by hours descending (longer first)
    const intervals = [
      { hours: reminderHours1, template: reminderTemplate1 },
      { hours: reminderHours2, template: reminderTemplate2 }
    ].sort((a, b) => b.hours - a.hours);

    const longerHours = intervals[0].hours;
    const shorterHours = intervals[1].hours;

    // Calculate windows for each interval
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

    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const allResults: any[] = [];

    // Calculate date range to query (today + next day for longer interval reminders)
    const today = germanyNow.dateStr;
    const maxLookaheadMs = Math.max(longerHours, 48) * 60 * 60 * 1000;
    const futureDate = new Date(now.getTime() + maxLookaheadMs);
    const endDate = futureDate.toISOString().split('T')[0];

    console.log(`Checking sessions from ${today} to ${endDate}`);

    // Fetch all scheduled sessions
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
          session_time
        )
      `)
      .eq('status', 'scheduled')
      .gte('date', today)
      .lte('date', endDate);

    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
      throw sessionsError;
    }

    console.log(`Found ${sessions?.length || 0} scheduled sessions`);

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No scheduled sessions found", sent: 0, skipped: 0, errors: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each reminder interval
    for (const { hours, interval, template, windowMin, windowMax } of reminderIntervals) {
      console.log(`\n--- Processing interval ${interval} (${hours}h before, window: ${windowMin.toFixed(1)}-${windowMax.toFixed(1)}h) ---`);

      let sentCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const session of sessions) {
        const studentData = Array.isArray(session.students) ? session.students[0] : session.students;
        const phone = studentData?.phone || studentData?.parent_phone;
        const sessionTime = session.time || studentData?.session_time || '16:00';
        const studentName = studentData?.name || 'الطالب';
        const studentId = studentData?.id;

        // Calculate minutes until session using correct timezone handling
        const minutesUntilSession = calculateMinutesUntilSession(session.date, sessionTime, germanyNow);
        const hoursUntilSession = minutesUntilSession / 60;

        // Session must be within the specific window for this reminder
        // Window is (windowMin, windowMax] - exclusive min, inclusive max
        if (hoursUntilSession > windowMax || hoursUntilSession <= windowMin || hoursUntilSession < 0) {
          continue; // Outside window, skip silently
        }

        if (!phone) {
          console.log(`Skip ${session.id} - no phone`);
          skippedCount++;
          continue;
        }

        // Check if reminder already sent for this session+interval
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

        // Build message
        const message = template
          .replace(/{student_name}/g, studentName)
          .replace(/{date}/g, session.date)
          .replace(/{time}/g, sessionTime);

        console.log(`➤ Sending to ${studentName} (${session.date} ${sessionTime}, ${hoursUntilSession.toFixed(1)}h away)`);

        // Send WhatsApp directly via Twilio
        const result = await sendWhatsAppMessage(phone, message);

        // Log the attempt
        await supabase.from('reminder_log').insert({
          user_id: 'default',
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
          allResults.push({ sessionId: session.id, interval, status: 'sent', messageSid: result.messageSid });
        } else {
          console.error(`  ✗ Failed: ${result.error}`);
          errorCount++;
          allResults.push({ sessionId: session.id, interval, status: 'failed', error: result.error });
        }
      }

      console.log(`Interval ${interval}: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`);
      totalSent += sentCount;
      totalSkipped += skippedCount;
      totalErrors += errorCount;
    }

    console.log(`\n=== Complete: ${totalSent} sent, ${totalSkipped} skipped, ${totalErrors} errors ===`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        skipped: totalSkipped,
        errors: totalErrors,
        reminders: reminderIntervals.map(r => ({ interval: r.interval, hours: r.hours })),
        results: allResults,
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
