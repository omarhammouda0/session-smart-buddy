import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge Function called");

    const body = await req.json();
    console.log("Received body:", JSON.stringify(body, null, 2));

    // ============================================
    // FLEXIBLE PARAMETER EXTRACTION
    // Accepts multiple naming conventions
    // ============================================

    // Phone: accepts phone, phoneNumber, phone_number
    const phone = body.phone || body.phoneNumber || body.phone_number;

    // Message: accepts message, customMessage, message_text
    // If no message provided, build one from other parameters
    let message = body.message || body.customMessage || body.message_text;

    // Student name: accepts studentName, student_name
    const studentName = body.studentName || body.student_name || "الطالب";

    // Type: accepts type (defaults to 'session')
    const type = body.type || "session";

    // Additional context for building messages
    const month = body.month;
    const year = body.year;
    const testMode = body.testMode || false;

    // ============================================
    // BUILD MESSAGE IF NOT PROVIDED
    // ============================================
    if (!message && month) {
      // Build a default payment reminder message
      message = `مرحباً 👋

تذكير بمستحقات شهر ${month}${year ? ` ${year}` : ""} للطالب ${studentName}

نشكركم على التزامكم 🙏`;
    }

    // ============================================
    // VALIDATION
    // ============================================
    if (!phone) {
      console.error("Missing phone number. Received keys:", Object.keys(body));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Phone number is required",
          hint: "Send 'phone', 'phoneNumber', or 'phone_number' parameter",
          receivedKeys: Object.keys(body),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!message) {
      console.error("Missing message. Received keys:", Object.keys(body));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Message is required",
          hint: "Send 'message', 'customMessage', or 'message_text' parameter, OR send 'month' to auto-generate",
          receivedKeys: Object.keys(body),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Processing ${type} reminder for ${studentName} to ${phone}`);
    console.log(`Message preview: ${message.substring(0, 100)}...`);

    // ============================================
    // CLEAN PHONE NUMBER
    // ============================================
    let cleanedPhone = String(phone).replace(/\D/g, "");

    // Handle Saudi numbers starting with 0
    if (cleanedPhone.startsWith("0") && cleanedPhone.length === 10) {
      cleanedPhone = "966" + cleanedPhone.substring(1);
    }

    console.log("Cleaned phone:", cleanedPhone);

    // Validate phone length
    if (cleanedPhone.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid phone number",
          details: `Number too short: ${cleanedPhone.length} digits (minimum 10)`,
          original: phone,
          cleaned: cleanedPhone,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ============================================
    // TWILIO CREDENTIALS
    // ============================================
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    // Test mode or no credentials = mock success
    if (testMode || !accountSid || !authToken || !twilioPhone) {
      console.log(testMode ? "Test mode enabled" : "Twilio credentials not configured");
      return new Response(
        JSON.stringify({
          success: true,
          mock: true,
          message: testMode ? "Test mode - message not sent" : "Twilio not configured - message not sent",
          data: {
            to: cleanedPhone,
            studentName,
            type,
            messagePreview: message.substring(0, 100),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============================================
    // SEND VIA TWILIO
    // ============================================
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("From", `whatsapp:${twilioPhone}`);
    formData.append("To", `whatsapp:+${cleanedPhone}`);
    formData.append("Body", message);

    console.log("Sending to Twilio:", {
      to: `whatsapp:+${cleanedPhone}`,
      from: `whatsapp:${twilioPhone}`,
      bodyLength: message.length,
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      return new Response(
        JSON.stringify({
          success: false,
          error: twilioData.message || "Twilio API error",
          code: twilioData.code,
          details: twilioData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`✅ WhatsApp sent to ${cleanedPhone} for ${studentName}`, {
      sid: twilioData.sid,
      status: twilioData.status,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: twilioData.sid,
        status: twilioData.status,
        to: cleanedPhone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
