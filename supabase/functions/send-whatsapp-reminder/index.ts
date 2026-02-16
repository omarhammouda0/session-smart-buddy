import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Version 3.0 - Multi-provider support: Meta WhatsApp Cloud API (FREE) + Twilio

// Provider selection: 'meta' (default, FREE) or 'twilio'
const WHATSAPP_PROVIDER = Deno.env.get("WHATSAPP_PROVIDER") || "meta";

// Meta WhatsApp Cloud API credentials (FREE - 1000 conversations/month)
const META_WHATSAPP_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
const META_WHATSAPP_PHONE_ID = Deno.env.get("META_WHATSAPP_PHONE_ID");
const META_WHATSAPP_VERSION = "v18.0";

// Twilio credentials (legacy/backup)
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Format phone number for international format
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/[^\d+]/g, "");
  if (formatted.startsWith("0")) {
    formatted = "20" + formatted.substring(1); // Egypt default
  }
  formatted = formatted.replace("+", "");
  return formatted;
}

// Send via Meta WhatsApp Cloud API
async function sendViaMeta(phone: string, message: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_ID) {
    return { success: false, error: "Meta WhatsApp credentials not configured" };
  }

  const formattedPhone = formatPhoneNumber(phone);
  const metaUrl = `https://graph.facebook.com/${META_WHATSAPP_VERSION}/${META_WHATSAPP_PHONE_ID}/messages`;

  try {
    console.log(`[Meta] Sending to +${formattedPhone.substring(0, 6)}***`);

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
      return { success: false, error: errorMsg };
    }

    return { success: true, messageSid: data.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Send via Twilio
async function sendViaTwilio(phone: string, message: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const formattedPhone = formatPhoneNumber(phone);
  const whatsappTo = `whatsapp:+${formattedPhone}`;
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const fromNumber = TWILIO_WHATSAPP_FROM?.startsWith("whatsapp:") ? TWILIO_WHATSAPP_FROM : `whatsapp:${TWILIO_WHATSAPP_FROM}`;

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

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || data.error_message || `Twilio error: ${response.status}` };
    }

    return { success: true, messageSid: data.sid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Unified send function
async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; messageSid?: string; error?: string; provider: string }> {
  const provider = WHATSAPP_PROVIDER.toLowerCase();

  if (provider === "twilio") {
    const result = await sendViaTwilio(phone, message);
    return { ...result, provider: "twilio" };
  } else {
    const result = await sendViaMeta(phone, message);
    return { ...result, provider: "meta" };
  }
}

interface RequestBody {
  studentName?: string;
  phoneNumber?: string;
  phone?: string;
  to?: string;
  customMessage?: string;
  message?: string;
  testMode?: boolean;
  sessionDate?: string;
  sessionTime?: string;
  month?: string;
  amount?: number;
  sessions?: number;
  cancellationCount?: number;
  cancellationLimit?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();

    // Log incoming request for debugging
    console.log("Received request body:", JSON.stringify(body));

    // Support multiple field names for compatibility
    const studentName = body.studentName || "";
    const phoneNumber = body.phoneNumber || body.phone || body.to || "";
    const customMessage = body.customMessage || body.message || "";
    const testMode = body.testMode || false;
    const sessionDate = body.sessionDate;
    const sessionTime = body.sessionTime;
    const month = body.month;
    const amount = body.amount;
    const sessions = body.sessions;
    const cancellationCount = body.cancellationCount;
    const cancellationLimit = body.cancellationLimit;

    console.log("Parsed fields:", {
      studentName,
      phoneNumber: phoneNumber ? "***" : "empty",
      hasCustomMessage: !!customMessage,
      testMode,
      provider: WHATSAPP_PROVIDER
    });

    // Validate required fields
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Phone number is required (use 'phoneNumber', 'phone', or 'to' field)"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check provider credentials
    const provider = WHATSAPP_PROVIDER.toLowerCase();
    if (provider === "meta") {
      if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_ID) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Meta WhatsApp credentials not configured. Set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_ID.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build message
    let message = customMessage || "";

    if (!message && studentName) {
      if (sessionDate && sessionTime) {
        message = `مرحباً،\nتذكير بموعد جلسة ${studentName} غداً ${sessionDate} الساعة ${sessionTime}\nنراك قريباً!`;
      } else if (month && amount) {
        message = `عزيزي ولي الأمر،\nتذكير بدفع رسوم شهر ${month} لـ ${studentName}\nعدد الجلسات: ${sessions || 0}\nالمبلغ المستحق: ${amount} جنيه\nشكراً لتعاونكم`;
      } else if (cancellationCount && cancellationLimit) {
        message = `عزيزي ولي الأمر،\nنود إعلامكم بأن ${studentName} قد وصل إلى الحد الأقصى للإلغاءات (${cancellationCount}/${cancellationLimit}) لهذا الشهر.\nالإلغاءات الإضافية ستُحتسب من الرصيد.\nشكراً لتفهمكم`;
      }
    }

    if (!message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Message content is required"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Test mode - don't actually send
    if (testMode) {
      console.log("Test mode - would send:", { to: formattedPhone, message, provider });
      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          provider: provider,
          message: `Test successful - ${provider} configured correctly`,
          wouldSendTo: `+${formattedPhone}`,
          messagePreview: message.substring(0, 100) + "...",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send message using unified function
    const result = await sendWhatsAppMessage(phoneNumber, message);

    if (!result.success) {
      console.error(`WhatsApp send failed via ${result.provider}:`, result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          provider: result.provider,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`WhatsApp message sent successfully via ${result.provider}:`, result.messageSid);

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: result.messageSid,
        provider: result.provider,
        to: `+${formattedPhone}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-whatsapp-reminder:", error);

    let errorMessage = "An unexpected error occurred";
    if (error instanceof SyntaxError) {
      errorMessage = "Invalid JSON in request body";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

