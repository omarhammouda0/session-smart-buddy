import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Received body:", JSON.stringify(body, null, 2));

    // Flexible parameter extraction
    const phone = body.phone || body.phoneNumber || body.phone_number;
    let message = body.message || body.customMessage || body.message_text;
    const studentName = body.studentName || body.student_name || "الطالب";
    const type = body.type || "session";
    const month = body.month;
    const year = body.year;

    // Auto-generate message if not provided
    if (!message && month) {
      message =
        "مرحباً 👋\n\nتذكير بمستحقات شهر " +
        month +
        (year ? " " + year : "") +
        " للطالب " +
        studentName +
        "\n\nنشكركم على التزامكم 🙏";
    }

    // Validation
    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number is required", receivedKeys: Object.keys(body) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required", receivedKeys: Object.keys(body) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number
    const cleanedPhone = String(phone).replace(/\D/g, "");

    if (cleanedPhone.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid phone number", original: phone, cleaned: cleanedPhone }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      return new Response(
        JSON.stringify({ success: true, mock: true, message: "Twilio not configured", to: cleanedPhone }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send via Twilio
    const twilioUrl = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json";

    const formData = new URLSearchParams();
    formData.append("From", "whatsapp:" + twilioPhone);
    formData.append("To", "whatsapp:+" + cleanedPhone);
    formData.append("Body", message);

    // Build auth header without nested template literals
    const authString = accountSid + ":" + authToken;
    const authHeader = "Basic " + btoa(authString);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: twilioData.message, code: twilioData.code }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, messageSid: twilioData.sid, to: cleanedPhone }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
