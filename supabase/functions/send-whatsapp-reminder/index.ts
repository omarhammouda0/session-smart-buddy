import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  studentName: string;
  phoneNumber: string;
  customMessage?: string;
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
    const {
      studentName,
      phoneNumber,
      customMessage,
      testMode = false,
      sessionDate,
      sessionTime,
      month,
      amount,
      sessions,
      cancellationCount,
      cancellationLimit,
    } = body;

    // Validate required fields
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
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
    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const formData = new URLSearchParams();
    formData.append("To", whatsappTo);
    formData.append("From", TWILIO_WHATSAPP_FROM);
    formData.append("Body", message);

    console.log("Sending WhatsApp message:", { to: whatsappTo, from: TWILIO_WHATSAPP_FROM });

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      return new Response(
        JSON.stringify({
          success: false,
          error: twilioData.message || "Failed to send WhatsApp message",
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
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

