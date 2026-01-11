import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  studentName?: string;
  // Accept both field names for compatibility
  phoneNumber?: string;
  phone?: string;
  customMessage?: string;
  message?: string;
  testMode?: boolean;
  // Session reminder fields
  sessionDate?: string;
  sessionTime?: string;
  // Payment reminder fields
  month?: string;
  amount?: number;
  sessions?: number;
  // Cancellation fields
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

    // Support both field names for compatibility
    const studentName = body.studentName || "";
    const phoneNumber = body.phoneNumber || body.phone || "";
    const customMessage = body.customMessage || body.message || "";
    const testMode = body.testMode || false;
    const sessionDate = body.sessionDate;
    const sessionTime = body.sessionTime;
    const month = body.month;
    const amount = body.amount;
    const sessions = body.sessions;
    const cancellationCount = body.cancellationCount;
    const cancellationLimit = body.cancellationLimit;

    console.log("Parsed fields:", { studentName, phoneNumber: phoneNumber ? "***" : "empty", hasCustomMessage: !!customMessage, testMode });

    // Validate required fields
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required (use 'phoneNumber' or 'phone' field)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Twilio credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number for WhatsApp
    let formattedPhone = phoneNumber.replace(/[^\d+]/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "966" + formattedPhone.substring(1); // Saudi Arabia default
    }
    formattedPhone = formattedPhone.replace("+", "");
    const whatsappTo = `whatsapp:+${formattedPhone}`;

    // Build message
    let message = customMessage || "";

    if (!message && studentName) {
      // Default session reminder message
      if (sessionDate && sessionTime) {
        message = `مرحباً،\nتذكير بموعد جلسة ${studentName} غداً ${sessionDate} الساعة ${sessionTime}\nنراك قريباً!`;
      }
      // Default payment reminder message
      else if (month && amount) {
        message = `عزيزي ولي الأمر،\nتذكير بدفع رسوم شهر ${month} لـ ${studentName}\nعدد الجلسات: ${sessions || 0}\nالمبلغ المستحق: ${amount} جنيه\nشكراً لتعاونكم`;
      }
      // Default cancellation limit message
      else if (cancellationCount && cancellationLimit) {
        message = `عزيزي ولي الأمر،\nنود إعلامكم بأن ${studentName} قد وصل إلى الحد الأقصى للإلغاءات (${cancellationCount}/${cancellationLimit}) لهذا الشهر.\nالإلغاءات الإضافية ستُحتسب من الرصيد.\nشكراً لتفهمكم`;
      }
    }

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: "Message content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test mode - don't actually send
    if (testMode) {
      console.log("Test mode - would send:", { to: whatsappTo, message });
      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          message: "Test successful - Twilio configured correctly",
          wouldSendTo: whatsappTo,
          messagePreview: message.substring(0, 100) + "...",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    // Use TextEncoder for proper base64 encoding in Deno
    const encoder = new TextEncoder();
    const credentials = encoder.encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const authHeader = base64Encode(credentials);

    const formData = new URLSearchParams();
    formData.append("To", whatsappTo);
    // Ensure From number has whatsapp: prefix
    const fromNumber = TWILIO_WHATSAPP_FROM?.startsWith("whatsapp:")
      ? TWILIO_WHATSAPP_FROM
      : `whatsapp:${TWILIO_WHATSAPP_FROM}`;
    formData.append("From", fromNumber);
    formData.append("Body", message);

    console.log("Sending WhatsApp message:", { to: whatsappTo, from: fromNumber, messageLength: message.length });

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    // Get response text first, then try to parse as JSON
    const responseText = await twilioResponse.text();
    let twilioData;

    try {
      twilioData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Twilio response:", responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse Twilio response",
          rawResponse: responseText.substring(0, 500),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!twilioResponse.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));
      return new Response(
        JSON.stringify({
          success: false,
          error: twilioData.message || twilioData.error_message || "Failed to send WhatsApp message",
          errorCode: twilioData.code || twilioData.error_code,
          twilioError: twilioData,
        }),
        { status: twilioResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp message sent successfully:", twilioData.sid);

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: twilioData.sid,
        status: twilioData.status,
        to: whatsappTo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-whatsapp-reminder:", error);

    // Handle different error types
    let errorMessage = "An unexpected error occurred";
    let errorDetails = {};

    if (error instanceof SyntaxError) {
      errorMessage = "Invalid JSON in request body";
    } else if (error instanceof TypeError) {
      errorMessage = "Invalid request format or network error";
      errorDetails = { type: "TypeError", name: error.name };
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = { stack: error.stack };
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorDetails,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

