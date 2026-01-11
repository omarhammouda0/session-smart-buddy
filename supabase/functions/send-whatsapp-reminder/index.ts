// Send WhatsApp Reminder Edge Function
// This function sends WhatsApp messages via Twilio API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  studentName: string;
  phoneNumber: string;
  customMessage?: string;
  sessionDate?: string;
  sessionTime?: string;
  reminderType?: "session" | "payment" | "cancellation";
  studentId?: string;
  type?: string;
  sessionId?: string;
  month?: number;
  year?: number;
  logToDb?: boolean;
  testMode?: boolean;
}

// Format phone number for WhatsApp
const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "20" + cleaned.substring(1);
  }
  cleaned = cleaned.replace("+", "");
  if (!cleaned.startsWith("20") && !cleaned.startsWith("20") && cleaned.length === 9) {
    cleaned = "20" + cleaned;
  }
  return cleaned;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { studentName, phoneNumber, customMessage, sessionDate, sessionTime, reminderType, testMode } = body;

    console.log("Received request:", {
      studentName,
      phoneNumber: phoneNumber?.slice(0, 6) + "***",
      reminderType,
      testMode,
    });

    // Get Twilio credentials from environment
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "+14155238886";

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Twilio credentials not configured",
          message: "يرجى تكوين بيانات Twilio في إعدادات الدالة",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Test mode - just verify credentials work
    if (testMode) {
      console.log("Test mode - verifying Twilio credentials");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Twilio credentials verified",
          testMode: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate required fields
    if (!phoneNumber) {
      return new Response(JSON.stringify({ success: false, error: "Phone number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the message
    let message = customMessage;
    if (!message) {
      if (reminderType === "session" && sessionDate && sessionTime) {
        message = `مرحباً ${studentName}،\n\nتذكير بموعد جلستك في ${sessionDate} الساعة ${sessionTime}.\n\nنراك قريباً!`;
      } else if (reminderType === "payment") {
        message = `عزيزي ولي أمر ${studentName}،\n\nتذكير بدفع الرسوم الشهرية.\n\nشكراً لتعاونكم.`;
      } else {
        message = `مرحباً ${studentName}،\n\nهذه رسالة تذكيرية من تطبيق متابعة الطلاب.`;
      }
    }

    // Format the phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log("Sending to:", formattedPhone.slice(0, 6) + "***");

    // Send via Twilio WhatsApp API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

    const formData = new URLSearchParams({
      From: `whatsapp:${twilioWhatsAppNumber}`,
      To: `whatsapp:+${formattedPhone}`,
      Body: message,
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: twilioResult.message || "Failed to send WhatsApp message",
          code: twilioResult.code,
        }),
        { status: twilioResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Message sent successfully:", twilioResult.sid);

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: twilioResult.sid,
        status: twilioResult.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-whatsapp-reminder:", errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
