import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto Session Reminder - v2.0
// Runs on schedule to send dual WhatsApp reminders at configurable intervals

// Germany timezone: CET (UTC+1) in winter, CEST (UTC+2) in summer
// Helper to check if date is in daylight saving time (last Sunday of March to last Sunday of October)
function isDaylightSavingTime(date: Date): boolean {
  const year = date.getUTCFullYear();

  // Last Sunday of March
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0, 0)); // 1:00 UTC

  // Last Sunday of October
  const octLast = new Date(Date.UTC(year, 9, 31));
  const dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0, 0)); // 1:00 UTC

  return date >= dstStart && date < dstEnd;
}

function getGermanyTimezoneOffset(date: Date): number {
  return isDaylightSavingTime(date) ? 2 : 1; // CEST (UTC+2) or CET (UTC+1)
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to get local time (Germany timezone)
function getLocalTime(date: Date): Date {
  const timezoneOffset = getGermanyTimezoneOffset(date);
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (timezoneOffset * 3600000));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting auto session reminder check...");

  try {
    const now = new Date();
    const localNow = getLocalTime(now);
    const tzOffset = getGermanyTimezoneOffset(now);
    const tzName = tzOffset === 2 ? 'CEST' : 'CET';

    console.log(`Current UTC time: ${now.toISOString()}`);
    console.log(`Current Germany time (${tzName}/UTC+${tzOffset}): ${localNow.toISOString()}`);

    // Check if session reminders are enabled
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
      console.log("Session reminders are disabled");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Session reminders are disabled",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reminderHours1 = settings.session_reminder_hours || 24;
    const reminderHours2 = settings.session_reminder_hours_2 || 1;

    // Separate templates for each reminder interval - matched to their hours
    const reminderTemplate1 = settings.session_reminder_template_1 ||
      settings.session_reminder_template ||
      'مرحباً {student_name}،\nتذكير: لديك جلسة غداً بتاريخ {date} الساعة {time}.\nنراك قريباً!';

    const reminderTemplate2 = settings.session_reminder_template_2 ||
      'مرحباً {student_name}،\nجلستك تبدأ خلال ساعة واحدة الساعة {time}!\nالرجاء الاستعداد.';

    console.log(`Reminder intervals: ${reminderHours1}h (template 1) and ${reminderHours2}h (template 2)`);

    // Build intervals with hours and their corresponding templates
    // Then SORT by hours descending so the longer interval is processed first
    const unsortedIntervals = [
      { hours: reminderHours1, template: reminderTemplate1 },
      { hours: reminderHours2, template: reminderTemplate2 }
    ];

    // Sort by hours descending (larger interval first: 24h before 1h)
    unsortedIntervals.sort((a, b) => b.hours - a.hours);

    // Assign interval numbers after sorting (interval 1 = longer, interval 2 = shorter)
    const reminderIntervals = unsortedIntervals.map((item, index) => ({
      ...item,
      interval: index + 1
    }));

    const longerIntervalHours = reminderIntervals[0].hours;
    const shorterIntervalHours = reminderIntervals[1].hours;

    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const allResults: any[] = [];

    // Process each reminder interval
    for (const reminder of reminderIntervals) {
      const { hours, interval, template } = reminder;

      // Calculate the window: sessions starting within the next X hours should be notified
      // We check for sessions that are:
      // - Starting within the next {hours} hours
      // - AND have not been notified for this interval yet

      const windowEndTime = new Date(localNow.getTime() + hours * 60 * 60 * 1000);

      // For interval 1 (e.g., 24h), we want sessions between now and 24h from now
      // For interval 2 (e.g., 1h), we want sessions between now and 1h from now
      // But we exclude sessions that are too close (less than the next smaller interval for interval 1)

      const windowStartTime = localNow;

      // Get dates to query (could span two days)
      const startDateStr = windowStartTime.toISOString().split('T')[0];
      const endDateStr = windowEndTime.toISOString().split('T')[0];

      console.log(`Processing reminder interval ${interval} (${hours}h before)`);
      console.log(`Window: ${windowStartTime.toISOString()} to ${windowEndTime.toISOString()}`);
      console.log(`Checking dates: ${startDateStr} to ${endDateStr}`);

      // Fetch scheduled sessions for the date range
      let query = supabase
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
        .eq('status', 'scheduled');

      // Handle date range
      if (startDateStr === endDateStr) {
        query = query.eq('date', startDateStr);
      } else {
        query = query.gte('date', startDateStr).lte('date', endDateStr);
      }

      const { data: sessions, error: sessionsError } = await query;

      if (sessionsError) {
        console.error("Error fetching sessions:", sessionsError);
        throw sessionsError;
      }

      console.log(`Found ${sessions?.length || 0} sessions in date range`);

      if (!sessions || sessions.length === 0) {
        continue;
      }

      let sentCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const session of sessions) {
        // students is returned as first item of array from join
        const studentData = Array.isArray(session.students) ? session.students[0] : session.students;
        const phone = studentData?.phone || studentData?.parent_phone;
        const sessionTime = session.time || studentData?.session_time || '16:00';
        const studentName = studentData?.name || 'الطالب';
        const studentId = studentData?.id;

        // Calculate the exact session datetime
        const [sessionHour, sessionMinute] = sessionTime.split(':').map(Number);
        const sessionDateTime = new Date(session.date + 'T00:00:00');
        sessionDateTime.setHours(sessionHour, sessionMinute, 0, 0);

        // The session time is in local (Germany) timezone, so we use it directly
        const sessionLocalTime = sessionDateTime;

        // Check if session is within the window (now to now+hours)
        const minutesUntilSession = (sessionLocalTime.getTime() - localNow.getTime()) / (1000 * 60);
        const hoursUntilSession = minutesUntilSession / 60;

        // For interval 1 (longer, e.g. 24h): session should be within 24h but more than shorter interval hours away
        // For interval 2 (shorter, e.g. 1h): session should be within 1h and more than 0 (not in the past)
        const maxHoursForThisInterval = hours;
        const minHoursForThisInterval = interval === 1 ? shorterIntervalHours : 0;

        if (hoursUntilSession > maxHoursForThisInterval || hoursUntilSession <= minHoursForThisInterval) {
          console.log(`Skipping session ${session.id} - ${hoursUntilSession.toFixed(2)}h until session, outside window [${minHoursForThisInterval}, ${maxHoursForThisInterval}]`);
          continue;
        }

        if (!phone) {
          console.log(`Skipping session ${session.id} - no phone number`);
          skippedCount++;
          continue;
        }

        // Check if this specific reminder (interval) was already sent for this session
        const { data: existingReminder, error: reminderCheckError } = await supabase
          .from('reminder_log')
          .select('id')
          .eq('session_id', session.id)
          .eq('type', 'session')
          .eq('reminder_interval', interval)
          .eq('status', 'sent')
          .maybeSingle();

        if (reminderCheckError) {
          console.error(`Error checking existing reminder for session ${session.id}:`, reminderCheckError);
        }

        if (existingReminder) {
          console.log(`Skipping session ${session.id} - reminder interval ${interval} already sent`);
          skippedCount++;
          continue;
        }

        console.log(`Sending reminder for session ${session.id} (${hoursUntilSession.toFixed(2)}h until session, interval ${interval})`);
        // Build message from interval-specific template
        const message = template
          .replace(/{student_name}/g, studentName)
          .replace(/{date}/g, session.date)
          .replace(/{time}/g, sessionTime || '');

        // Send WhatsApp reminder using existing edge function
        try {
          const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-whatsapp-reminder', {
            body: {
              phone: phone,
              message: message,
              phoneNumber: phone,
              customMessage: message,
              studentName: studentName,
              sessionDate: session.date,
              sessionTime: sessionTime,
            },
          });

          if (sendError) {
            console.error(`Error sending reminder for session ${session.id}:`, sendError);

            // Log failed attempt
            await supabase.from('reminder_log').insert({
              user_id: 'default',
              type: 'session',
              student_id: studentId,
              student_name: studentName,
              phone_number: phone,
              message_text: message,
              status: 'failed',
              error_message: sendError.message,
              session_id: session.id,
              session_date: session.date,
              reminder_interval: interval,
            });

            errorCount++;
            allResults.push({ sessionId: session.id, interval, status: 'failed', error: sendError.message });
          } else {
            console.log(`Reminder sent for session ${session.id} (interval ${interval}) to ${phone}`);

            // Log successful reminder
            await supabase.from('reminder_log').insert({
              user_id: 'default',
              type: 'session',
              student_id: studentId,
              student_name: studentName,
              phone_number: phone,
              message_text: message,
              status: 'sent',
              twilio_message_sid: sendResult?.messageSid,
              session_id: session.id,
              session_date: session.date,
              reminder_interval: interval,
            });

            sentCount++;
            allResults.push({ sessionId: session.id, interval, status: 'sent', messageSid: sendResult?.messageSid });
          }
        } catch (err) {
          console.error(`Exception sending reminder for session ${session.id}:`, err);
          errorCount++;
          allResults.push({ sessionId: session.id, interval, status: 'error', error: String(err) });
        }
      }

      console.log(`Interval ${interval}: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`);
      totalSent += sentCount;
      totalSkipped += skippedCount;
      totalErrors += errorCount;
    }

    console.log(`Auto session reminder complete: ${totalSent} sent, ${totalSkipped} skipped, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        skipped: totalSkipped,
        errors: totalErrors,
        reminders: reminderIntervals,
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
