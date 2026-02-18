import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Version 4.0 - Meta Message Templates support for automated reminders (no 24h limit)

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

// ============================================
// META MESSAGE TEMPLATES
// Create these templates in Meta Business Suite:
// https://business.facebook.com/ -> WhatsApp Manager -> Message Templates
// ============================================
interface TemplateMessage {
  templateName: string;
  languageCode: string;
  components: Array<{
    type: "body" | "header";
    parameters: Array<{ type: "text"; text: string }>;
  }>;
}

// Send via Meta WhatsApp Cloud API - Text Message (within 24h window)
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
      return { success: false, error: errorMsg };
    }

    return { success: true, messageSid: data.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Send via Meta WhatsApp Cloud API - Template Message (works anytime, no 24h limit)
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

  // Build template components
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
      const errorMsg = data.error?.message || data.error?.error_user_msg || `Meta Template API error: ${response.status}`;
      console.error(`[Meta Template] Error:`, JSON.stringify(data.error));
      return { success: false, error: errorMsg };
    }

    console.log(`[Meta Template] Success:`, data.messages?.[0]?.id);
    return { success: true, messageSid: data.messages?.[0]?.id };
  } catch (err) {
    console.error(`[Meta Template] Exception:`, err);
    return { success: false, error: String(err) };
  }
}

// Send via Meta - tries template first, falls back to text
async function sendViaMeta(
  phone: string,
  message: string,
  templateName?: string,
  templateParams?: string[],
  templateLanguage: string = "ar"
): Promise<{ success: boolean; messageSid?: string; error?: string; method?: string }> {
  // If template is specified, use it (works outside 24h window)
  if (templateName && templateParams !== undefined) {
    const result = await sendMetaTemplateMessage(phone, templateName, templateLanguage, templateParams);
    return { ...result, method: "template" };
  }

  // Otherwise use text message (only works within 24h window)
  const result = await sendMetaTextMessage(phone, message);
  return { ...result, method: "text" };
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
async function sendWhatsAppMessage(
  phone: string,
  message: string,
  templateName?: string,
  templateParams?: string[],
  templateLanguage: string = "ar"
): Promise<{ success: boolean; messageSid?: string; error?: string; provider: string; method?: string }> {
  const provider = WHATSAPP_PROVIDER.toLowerCase();

  if (provider === "twilio") {
    const result = await sendViaTwilio(phone, message);
    return { ...result, provider: "twilio", method: "text" };
  } else {
    const result = await sendViaMeta(phone, message, templateName, templateParams, templateLanguage);
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
  // Template support
  useTemplate?: boolean;
  templateName?: string;
  templateParams?: string[];
  templateLanguage?: string; // Language code for template (default: ar)
  reminderType?: "test" | "session_24h" | "session_1h" | "payment" | "cancellation" | "custom";
}

// Pre-defined template configurations
// For TRIAL MODE: Use "hello_world" template (pre-approved by Meta)
// For PRODUCTION: Create custom templates in Meta Business Suite
const TEMPLATE_CONFIGS: Record<string, { name: string; languageCode: string; buildParams: (data: any) => string[] }> = {
  // Default test template (works without business verification)
  test: {
    name: "hello_world",
    languageCode: "en_US", // hello_world is in English
    buildParams: () => [] // No parameters needed
  },
  // Custom templates (need to be created in Meta Business Suite after verification)
  session_24h: {
    name: "session_reminder_24h",
    languageCode: "ar",
    buildParams: (data) => [data.studentName, data.sessionDate, data.sessionTime]
  },
  session_1h: {
    name: "session_reminder_1h",
    languageCode: "ar",
    buildParams: (data) => [data.studentName, data.sessionTime]
  },
  payment: {
    name: "payment_reminder",
    languageCode: "ar",
    buildParams: (data) => [data.studentName, String(data.amount)]
  },
  cancellation: {
    name: "cancellation_warning",
    languageCode: "ar",
    buildParams: (data) => [data.studentName, String(data.cancellationCount), String(data.cancellationLimit)]
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();

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
    const useTemplate = body.useTemplate || false;
    const reminderType = body.reminderType;
    let templateName = body.templateName;
    let templateParams = body.templateParams;
    let templateLanguage = body.templateLanguage || "ar";

    console.log("Parsed fields:", {
      studentName,
      phoneNumber: phoneNumber ? "***" : "empty",
      hasCustomMessage: !!customMessage,
      testMode,
      useTemplate,
      reminderType,
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

    // Auto-detect template based on reminderType
    if (useTemplate && reminderType && !templateName) {
      const config = TEMPLATE_CONFIGS[reminderType];
      if (config) {
        templateName = config.name;
        templateLanguage = config.languageCode;
        templateParams = config.buildParams({ studentName, sessionDate, sessionTime, amount, cancellationCount, cancellationLimit });
        console.log(`Using template "${templateName}" (${templateLanguage}) with params:`, templateParams);
      }
    }

    // Build fallback text message
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

    // Need either a message or a template
    if (!message && !templateName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Message content or template is required"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Test mode - don't actually send
    if (testMode) {
      console.log("Test mode - would send:", { to: formattedPhone, message, templateName, templateParams, provider });
      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          provider: provider,
          method: templateName ? "template" : "text",
          templateName: templateName || null,
          message: `Test successful - ${provider} configured correctly`,
          wouldSendTo: `+${formattedPhone}`,
          messagePreview: message ? message.substring(0, 100) + "..." : `Template: ${templateName}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send message using unified function
    const result = await sendWhatsAppMessage(phoneNumber, message, templateName, templateParams, templateLanguage);

    if (!result.success) {
      console.error(`WhatsApp send failed via ${result.provider} (${result.method}):`, result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          provider: result.provider,
          method: result.method,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`WhatsApp message sent successfully via ${result.provider} (${result.method}):`, result.messageSid);

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: result.messageSid,
        provider: result.provider,
        method: result.method,
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

