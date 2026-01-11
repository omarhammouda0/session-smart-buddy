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
    const body = await req.json();
    console.log("Received body:", JSON.stringify(body, null, 2));

    // ============================================
    // FLEXIBLE PARAMETER EXTRACTION
    // Accepts multiple naming conventions
    // ============================================

    // Phone: accepts phone, phoneNumber, phone_number
    const phone = body.phone || body.phoneNumber || body.phone_number;

    // Message: accepts message, customMessage, message_text
    let message = body.message || body.customMessage || body.message_text;

    // Student name: accepts studentName, student_name
    const studentName = body.studentName || body.student_name || "الطالب";

    // Type: defaults to 'session'
    const type = body.type || "session";

    // Additional context for auto-generating messages
    const month = body.month;
    const year = body.year;
    const testMode = body.testMode || false;

    // ============================================
    // BUILD MESSAGE IF NOT PROVIDED
    // ============================================
    if (!message && month) {
      message = `مرحباً 👋

تذكير بمستحقات شهر ${month}${year ? ` ${year}` : ""} للطالب ${studentName}

نشكركم على التزامكم 🙏`;
    }

    // ============================================
    // VALIDATION
    // ============================================
    if (!phone) {
      console.error("Missing phone. Keys received:", Object.keys(body));
      return new Response(
        JSON.stringify({
          error: "Phone number is required",
          hint: "Send 'phone', 'phoneNumber', or 'phone_number'",
          receivedKeys: Object.keys(body),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!message) {
      console.error("Missing message. Keys received:", Object.keys(body));
      return new Response(
        JSON.stringify({
          error: "Message is required",
          hint: "Send 'message', 'customMessage', or 'month' to auto-generate",
          receivedKeys: Object.keys(body),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============================================
    // CLEAN PHONE NUMBER - INTERNATIONAL SUPPORT
    // ============================================
    let cleanedPhone = String(phone).replace(/\D/g, "");

    console.log("Original phone:", phone);
    console.log("Cleaned phone:", cleanedPhone);

    if (cleanedPhone.length < 10) {
      return new Response(
        JSON.stringify({
          error: "Invalid phone number",
          details: `Too short: ${cleanedPhone.length} digits (need 10+)`,
          hint: "Include country code (e.g., +49 for Germany, +20 for Egypt)",
          original: phone,
          cleaned: cleanedPhone,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============================================
    // TWILIO CREDENTIALS
    // ============================================
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (testMode || !accountSid || !authToken || !twilioPhone) {
      console.log(testMode ? "Test mode" : "Twilio not configured");
      return new Response(
        JSON.stringify({
          success: true,
          mock: true,
          message: testMode ? "Test mode - not sent" : "Twilio not configured",
          data: { to: cleanedPhone, studentName, type, messagePreview: message.substring(0, 100) },
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

    console.log("Sending:", { to: `+${cleanedPhone}`, bodyLength: message.length });

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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`✅ Sent to +${cleanedPhone} for ${studentName} (${type})`);

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
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
