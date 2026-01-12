import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto Session Reminder - v1.0
// Runs on schedule to send WhatsApp reminders 1 hour before sessions

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // Get current time in UTC and calculate target window (1 hour from now)
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Format date as YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];
    
    // Current time in HH:MM format
    const currentHour = now.getUTCHours().toString().padStart(2, '0');
    const currentMinute = now.getUTCMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    
    // Time 1 hour from now
    const targetHour = oneHourFromNow.getUTCHours().toString().padStart(2, '0');
    const targetMinute = oneHourFromNow.getUTCMinutes().toString().padStart(2, '0');
    const targetTime = `${targetHour}:${targetMinute}`;

    console.log(`Checking for sessions on ${todayStr} between ${currentTime} and ${targetTime} (UTC)`);

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

    const reminderHours = settings.session_reminder_hours || 1;
    const reminderTemplate = settings.session_reminder_template || 'مرحباً {student_name}،\nتذكير بموعد جلستك اليوم الساعة {time}\nنراك قريباً!';

    // Calculate the target time based on reminder hours setting
    const targetDateTime = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);
    const targetDateStr = targetDateTime.toISOString().split('T')[0];

    // Fetch scheduled sessions that should receive reminders
    // Sessions on target date that haven't been reminded yet
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

    console.log(`Found ${sessions?.length || 0} scheduled sessions for ${targetDateStr}`);

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No sessions found for the target date",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter sessions that are within the reminder window
    const sessionsToRemind = sessions.filter((session: any) => {
      const sessionTime = session.time || session.students?.session_time;
      if (!sessionTime) return false;

      // Check if we already sent a reminder for this session
      return true; // We'll check in the loop
    });

    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (const session of sessionsToRemind) {
      // students is returned as first item of array from join
      const studentData = Array.isArray(session.students) ? session.students[0] : session.students;
      const phone = studentData?.phone || studentData?.parent_phone;
      const sessionTime = session.time || studentData?.session_time;
      const studentName = studentData?.name || 'الطالب';
      const studentId = studentData?.id;

      if (!phone) {
        console.log(`Skipping session ${session.id} - no phone number`);
        skippedCount++;
        continue;
      }

      // Check if reminder already sent for this session
      const { data: existingReminder, error: reminderCheckError } = await supabase
        .from('reminder_log')
        .select('id')
        .eq('session_id', session.id)
        .eq('type', 'session')
        .eq('status', 'sent')
        .maybeSingle();

      if (reminderCheckError) {
        console.error(`Error checking existing reminder for session ${session.id}:`, reminderCheckError);
      }

      if (existingReminder) {
        console.log(`Skipping session ${session.id} - reminder already sent`);
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
          });

          errorCount++;
          results.push({ sessionId: session.id, status: 'failed', error: sendError.message });
        } else {
          console.log(`Reminder sent for session ${session.id} to ${phone}`);
          
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
          });

          sentCount++;
          results.push({ sessionId: session.id, status: 'sent', messageSid: sendResult?.messageSid });
        }
      } catch (err) {
        console.error(`Exception sending reminder for session ${session.id}:`, err);
        errorCount++;
        results.push({ sessionId: session.id, status: 'error', error: String(err) });
      }
    }

    console.log(`Auto session reminder complete: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: sessions.length,
        sent: sentCount,
        skipped: skippedCount,
        errors: errorCount,
        results,
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
