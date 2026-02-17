import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto Session Reminder - v6.0
// Runs on schedule (pg_cron) to send dual WhatsApp reminders at configurable intervals
// UPDATED v6.0: Multi-provider support - Meta WhatsApp Cloud API (FREE) or Twilio
// UPDATED v5.0: Added GROUP SESSION reminders - sends to all group members
// UPDATED v4.0: Supports multiple users - processes each user's settings and sessions separately
// This ensures reminders work even when the app is closed

// ============================================
// PROVIDER CONFIGURATION
// ============================================
// Set WHATSAPP_PROVIDER to 'meta' (default, FREE) or 'twilio'
const WHATSAPP_PROVIDER = Deno.env.get("WHATSAPP_PROVIDER") || "meta";

// Meta WhatsApp Cloud API credentials (FREE - 1000 conversations/month)
const META_WHATSAPP_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
const META_WHATSAPP_PHONE_ID = Deno.env.get("META_WHATSAPP_PHONE_ID");
const META_WHATSAPP_VERSION = "v18.0";

// Twilio credentials (legacy/backup)
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886";

// Egypt timezone: EET (UTC+2) - no daylight saving time
function getEgyptTimezoneOffset(): number {
  return 2; // Egypt is always UTC+2
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get current time in Egypt timezone as components
function getEgyptTimeComponents(date: Date): { hours: number; minutes: number; dateStr: string; totalMinutes: number } {
  const offset = getEgyptTimezoneOffset();
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();

  let egyptHours = utcHours + offset;
  let dayOffset = 0;

  if (egyptHours >= 24) {
    egyptHours -= 24;
    dayOffset = 1;
  } else if (egyptHours < 0) {
    egyptHours += 24;
    dayOffset = -1;
  }

  const adjustedDate = new Date(date);
  adjustedDate.setUTCDate(adjustedDate.getUTCDate() + dayOffset);
  const dateStr = adjustedDate.toISOString().split('T')[0];

  return {
    hours: egyptHours,
    minutes: utcMinutes,
    dateStr,
    totalMinutes: egyptHours * 60 + utcMinutes
  };
}

// Format phone number for international format
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/[^\d+]/g, "");
  if (formatted.startsWith("0")) {
    formatted = "20" + formatted.substring(1); // Egypt default
  }
  formatted = formatted.replace("+", "");
  return formatted;
}

// ============================================
// META WHATSAPP CLOUD API (FREE)
// ===========================================
// Send text message (only works within 24h window)
async function sendMetaTextMessage(phone: string, message: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_ID) {
    return { success: false, error: "Meta WhatsApp credentials not configured" };
  }

  const formattedPhone = formatPhoneNumber(phone);
  const metaUrl = `https://graph.facebook.com/${META_WHATSAPP_VERSION}/${META_WHATSAPP_PHONE_ID}/messages`;

  try {
    console.log(`[Meta Text] Sending to +${formattedPhone.substring(0, 6)}***`);

    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { preview_url: false, body: message }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.error?.error_user_msg || `Meta API error: ${response.status}`;
      console.error(`[Meta Text] Error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    console.log(`[Meta Text] Success: ${data.messages?.[0]?.id}`);
    return { success: true, messageSid: data.messages?.[0]?.id };
  } catch (err) {
    console.error(`[Meta Text] Exception: ${err}`);
    return { success: false, error: String(err) };
  }
}

// Send template message (works anytime, no 24h limit)
async function sendMetaTemplateMessage(
  phone: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[]
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_ID) {
    return { success: false, error: "Meta WhatsApp credentials not configured" };
  }

  const formattedPhone = formatPhoneNumber(phone);
  const metaUrl = `https://graph.facebook.com/${META_WHATSAPP_VERSION}/${META_WHATSAPP_PHONE_ID}/messages`;

  const components: any[] = [];
  if (bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParameters.map(text => ({ type: "text", text }))
    });
  }

  try {
    console.log(`[Meta Template] Sending "${templateName}" to +${formattedPhone.substring(0, 6)}***`);

    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: components
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.error?.error_user_msg || `Meta Template error: ${response.status}`;
      console.error(`[Meta Template] Error:`, JSON.stringify(data.error));
      return { success: false, error: errorMsg };
    }

    console.log(`[Meta Template] Success: ${data.messages?.[0]?.id}`);
    return { success: true, messageSid: data.messages?.[0]?.id };
  } catch (err) {
    console.error(`[Meta Template] Exception:`, err);
    return { success: false, error: String(err) };
  }
}

// Send via Meta - uses template if available, falls back to text
async function sendViaMeta(
  phone: string,
  message: string,
  templateName?: string,
  templateParams?: string[]
): Promise<{ success: boolean; messageSid?: string; error?: string; method?: string }> {
  if (templateName && templateParams) {
    const result = await sendMetaTemplateMessage(phone, templateName, "ar", templateParams);
    return { ...result, method: "template" };
  }
  const result = await sendMetaTextMessage(phone, message);
  return { ...result, method: "text" };
}

// ============================================
// TWILIO (Legacy/Backup)
// ============================================
async function sendViaTwilio(phone: string, message: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const formattedPhone = formatPhoneNumber(phone);
  const whatsappTo = `whatsapp:+${formattedPhone}`;
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
    console.log(`[Twilio] Sending to ${whatsappTo.substring(0, 15)}***`);

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

// ============================================
// UNIFIED SEND FUNCTION
// ============================================
async function sendWhatsAppMessage(
  phone: string,
  message: string,
  templateName?: string,
  templateParams?: string[]
): Promise<{ success: boolean; messageSid?: string; error?: string; provider?: string; method?: string }> {
  const provider = WHATSAPP_PROVIDER.toLowerCase();

  console.log(`Using provider: ${provider}`);

  if (provider === "twilio") {
    const result = await sendViaTwilio(phone, message);
    return { ...result, provider: "twilio", method: "text" };
  } else {
    const result = await sendViaMeta(phone, message, templateName, templateParams);
    return { ...result, provider: "meta" };
  }
}

// Check if provider is configured
function isProviderConfigured(): { ok: boolean; provider: string; error?: string } {
  const provider = WHATSAPP_PROVIDER.toLowerCase();

  if (provider === "twilio") {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      return { ok: true, provider: "twilio" };
    }
    return { ok: false, provider: "twilio", error: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required" };
  } else {
    if (META_WHATSAPP_TOKEN && META_WHATSAPP_PHONE_ID) {
      return { ok: true, provider: "meta" };
    }
    return { ok: false, provider: "meta", error: "META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_ID required" };
  }
}

// Calculate minutes until a session from current Egypt time
function calculateMinutesUntilSession(
  sessionDate: string,
  sessionTime: string,
  egyptNow: { dateStr: string; totalMinutes: number }
): number {
  const [sessionHour, sessionMinute] = sessionTime.split(':').map(Number);
  const sessionMinutesOfDay = sessionHour * 60 + sessionMinute;

  if (sessionDate === egyptNow.dateStr) {
    return sessionMinutesOfDay - egyptNow.totalMinutes;
  } else if (sessionDate > egyptNow.dateStr) {
    const nowDate = new Date(egyptNow.dateStr + 'T00:00:00Z');
    const sessDate = new Date(sessionDate + 'T00:00:00Z');
    const daysDiff = Math.round((sessDate.getTime() - nowDate.getTime()) / (24 * 60 * 60 * 1000));

    const minutesRemainingToday = 24 * 60 - egyptNow.totalMinutes;
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

  console.log("=== Auto Session Reminder v6.0 (Meta/Twilio + Groups) ===");

  try {
    const now = new Date();
    const egyptNow = getEgyptTimeComponents(now);

    console.log(`UTC: ${now.toISOString()}`);
    console.log(`Egypt: ${egyptNow.dateStr} ${String(egyptNow.hours).padStart(2, '0')}:${String(egyptNow.minutes).padStart(2, '0')}`);

    // Check WhatsApp provider configuration
    const providerCheck = isProviderConfigured();
    if (!providerCheck.ok) {
      console.error(`❌ ${providerCheck.error}`);
      return new Response(
        JSON.stringify({ success: false, error: providerCheck.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`✓ WhatsApp provider configured: ${providerCheck.provider}`);

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
      const today = egyptNow.dateStr;
      const maxLookaheadMs = Math.max(longerHours, 48) * 60 * 60 * 1000;
      const futureDate = new Date(now.getTime() + maxLookaheadMs);
      const endDate = futureDate.toISOString().split('T')[0];

      console.log(`Checking sessions from ${today} to ${endDate}`);

      // Fetch PRIVATE sessions for THIS USER's students only
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

          const minutesUntilSession = calculateMinutesUntilSession(session.date, sessionTime, egyptNow);
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

      // ========================================
      // GROUP SESSIONS REMINDERS
      // ========================================
      console.log(`\n--- Processing GROUP sessions for user ${userId} ---`);

      // Fetch group sessions for this user (without members - we'll query them separately)
      const { data: groupSessions, error: groupSessionsError } = await supabase
        .from('group_sessions')
        .select(`
          id,
          date,
          time,
          status,
          group_id,
          student_groups!inner (
            id,
            name,
            user_id,
            session_time
          )
        `)
        .eq('status', 'scheduled')
        .eq('student_groups.user_id', userId)
        .gte('date', today)
        .lte('date', endDate);

      if (groupSessionsError) {
        console.error(`Error fetching group sessions for user ${userId}:`, groupSessionsError);
      } else if (groupSessions && groupSessions.length > 0) {
        console.log(`Found ${groupSessions.length} scheduled GROUP sessions for user ${userId}`);

        // Create group-specific templates
        const groupTemplate1 = reminderTemplate1
          .replace('لديك جلسة', 'لديك حصة مجموعة')
          .replace('جلسة غداً', 'حصة مجموعة غداً');
        const groupTemplate2 = reminderTemplate2
          .replace('جلستك', 'حصة المجموعة')
          .replace('جلسة', 'حصة مجموعة');

        const groupReminderIntervals = [
          { hours: reminderHours1, interval: 1, template: groupTemplate1, windowMin: reminderIntervals[0].windowMin, windowMax: reminderIntervals[0].windowMax },
          { hours: reminderHours2, interval: 2, template: groupTemplate2, windowMin: reminderIntervals[1].windowMin, windowMax: reminderIntervals[1].windowMax }
        ];

        // Process each group session
        for (const groupSession of groupSessions) {
          const groupData = Array.isArray(groupSession.student_groups) ? groupSession.student_groups[0] : groupSession.student_groups;
          if (!groupData) continue;

          const sessionTime = groupSession.time || groupData.session_time || '16:00';
          const groupName = groupData.name || 'المجموعة';

          // FIXED: Query group_members table instead of reading from denormalized JSON
          // This ensures we always get the current, up-to-date member list
          const { data: membersData, error: membersError } = await supabase
            .from('group_members')
            .select('id, student_id, student_name, phone, parent_phone, is_active')
            .eq('group_id', groupData.id)
            .eq('is_active', true);

          if (membersError) {
            console.error(`  Error fetching members for group ${groupData.id}:`, membersError);
            continue;
          }

          // Transform to expected format (matching the old JSON structure for compatibility)
          const members = (membersData || []).map(m => ({
            studentId: m.student_id,
            studentName: m.student_name,
            phone: m.phone || m.parent_phone, // Use phone or fall back to parent_phone
            isActive: m.is_active
          }));

          const minutesUntilSession = calculateMinutesUntilSession(groupSession.date, sessionTime, egyptNow);
          const hoursUntilSession = minutesUntilSession / 60;

          console.log(`  Group Session ${groupSession.id}: ${groupSession.date} ${sessionTime}, "${groupName}" (${members.length} members from DB), ${hoursUntilSession.toFixed(2)}h away`);

          // Process each reminder interval for groups
          for (const { hours, interval, template, windowMin, windowMax } of groupReminderIntervals) {
            if (hoursUntilSession > windowMax || hoursUntilSession <= windowMin || hoursUntilSession < 0) {
              continue; // Outside window
            }

            // Send reminder to each active member
            for (const member of members) {
              if (!member.isActive) continue;

              const memberPhone = member.phone;
              const memberName = member.studentName || 'الطالب';
              const memberId = member.studentId;

              if (!memberPhone) {
                console.log(`    → Skip member ${memberName} - no phone`);
                userTotalSkipped++;
                continue;
              }

              // Check if reminder already sent for this member + session + interval
              const logKey = `group_${groupSession.id}_${memberId}_${interval}`;
              const { data: existingReminder } = await supabase
                .from('reminder_log')
                .select('id')
                .eq('session_id', logKey)
                .eq('type', 'group_session')
                .eq('reminder_interval', interval)
                .eq('status', 'sent')
                .maybeSingle();

              if (existingReminder) {
                console.log(`    → Skip ${memberName} - already sent`);
                userTotalSkipped++;
                continue;
              }

              const message = template
                .replace(/{student_name}/g, memberName)
                .replace(/{group_name}/g, groupName)
                .replace(/{date}/g, groupSession.date)
                .replace(/{time}/g, sessionTime);

              console.log(`    ➤ Sending to ${memberName} for group "${groupName}"`);

              const result = await sendWhatsAppMessage(memberPhone, message);

              // Log the reminder
              await supabase.from('reminder_log').insert({
                user_id: userId,
                type: 'group_session',
                student_id: memberId,
                student_name: memberName,
                phone_number: memberPhone,
                message_text: message,
                status: result.success ? 'sent' : 'failed',
                twilio_message_sid: result.messageSid,
                error_message: result.error,
                session_id: logKey,
                session_date: groupSession.date,
                reminder_interval: interval,
              });

              if (result.success) {
                console.log(`      ✓ Sent to ${memberName}`);
                userTotalSent++;
                globalResults.push({ userId, type: 'group', groupId: groupSession.group_id, memberId, interval, status: 'sent' });
              } else {
                console.error(`      ✗ Failed for ${memberName}: ${result.error}`);
                userTotalErrors++;
                globalResults.push({ userId, type: 'group', groupId: groupSession.group_id, memberId, interval, status: 'failed', error: result.error });
              }
            }
          }
        }
      } else {
        console.log(`No scheduled group sessions for user ${userId}`);
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
