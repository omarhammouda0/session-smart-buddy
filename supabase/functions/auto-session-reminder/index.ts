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
    const reminderTemplate = settings.session_reminder_template || 'مرحباً {student_name}،\nتذكير بموعد جلستك اليوم الساعة {time}\nنراك قريباً!';

    console.log(`Reminder intervals: ${reminderHours1}h and ${reminderHours2}h`);

    // Array of reminder intervals to check
    const reminderIntervals = [
      { hours: reminderHours1, interval: 1 },
      { hours: reminderHours2, interval: 2 }
    ];

    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const allResults: any[] = [];

    // Process each reminder interval
    for (const reminder of reminderIntervals) {
      const { hours, interval } = reminder;

      // Calculate the target datetime for this reminder (in local time)
      const targetDateTime = new Date(localNow.getTime() + hours * 60 * 60 * 1000);
      const targetDateStr = targetDateTime.toISOString().split('T')[0];
      // Get hours/minutes from the local target time
      const targetHour = targetDateTime.getHours();
      const targetMinute = targetDateTime.getMinutes();

      console.log(`Processing reminder interval ${interval} (${hours}h before) - target datetime: ${targetDateStr} ${targetHour}:${targetMinute}`);

      // Fetch scheduled sessions for the target date
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
        .eq('date', targetDateStr);

      if (sessionsError) {
        console.error("Error fetching sessions:", sessionsError);
        throw sessionsError;
      }

      console.log(`Found ${sessions?.length || 0} sessions for target date ${targetDateStr}`);

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
        const sessionTime = session.time || studentData?.session_time;
        const studentName = studentData?.name || 'الطالب';
        const studentId = studentData?.id;

        // Check if session time matches the target time (within 30 minute window)
        if (sessionTime) {
          const [sessionHour, sessionMinute] = sessionTime.split(':').map(Number);
          const timeDiffMinutes = Math.abs((sessionHour * 60 + sessionMinute) - (targetHour * 60 + targetMinute));

          // Skip if session time is more than 30 minutes away from target time
          if (timeDiffMinutes > 30) {
            const targetTimeStr = (targetHour < 10 ? '0' : '') + targetHour + ':' + (targetMinute < 10 ? '0' : '') + targetMinute;
            console.log(`Skipping session ${session.id} - time ${sessionTime} not within window of target ${targetTimeStr}`);
            continue;
          }
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

        // Build message from template
        const message = reminderTemplate
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
