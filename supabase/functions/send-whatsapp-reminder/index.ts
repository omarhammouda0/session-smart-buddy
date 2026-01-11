import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  phone: string;
  message: string;
  studentName: string;
  type: "session" | "payment" | "cancellation";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge Function called - Raw request:", {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
    });

    const body = await req.json();
    console.log("Received body:", body);

    const { phone, message, studentName, type }: WhatsAppRequest = body;

    // Validate required fields
    if (!phone || !message) {
      console.error("Missing required fields:", { phone, message });
      return new Response(
        JSON.stringify({
          error: "Phone and message are required",
          received: { phone, message },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Processing reminder for ${studentName} (${type}) to ${phone}`);

    // Clean phone number - remove all non-digits
    let cleanedPhone = phone.replace(/\D/g, "");
    console.log("Cleaned phone (digits only):", cleanedPhone);

    // Validate phone length
    if (cleanedPhone.length < 10) {
      console.error("Phone number too short:", cleanedPhone);
      return new Response(
        JSON.stringify({
          error: "Invalid phone number",
          details: "Number too short",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get Twilio credentials from environment
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      console.log("Twilio credentials not configured, returning mock success");
      return new Response(
        JSON.stringify({
          success: true,
          mock: true,
          message: "WhatsApp credentials not configured. Message not sent.",
          data: {
            originalPhone: phone,
            cleanedPhone: cleanedPhone,
            messagePreview: message.substring(0, 100),
            studentName,
            type,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send via Twilio WhatsApp API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("From", `whatsapp:${twilioPhone}`);
    formData.append("To", `whatsapp:+${cleanedPhone}`); // Add + for Twilio
    formData.append("Body", message);

    console.log("Sending to Twilio:", {
      to: `whatsapp:+${cleanedPhone}`,
      from: `whatsapp:${twilioPhone}`,
      messageLength: message.length,
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
      console.error("Twilio API error:", twilioData);
      return new Response(
        JSON.stringify({
          success: false,
          error: twilioData.message || "Failed to send WhatsApp message",
          code: twilioData.code,
          details: twilioData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`WhatsApp message sent successfully to ${cleanedPhone} for ${studentName} (${type})`, {
      messageSid: twilioData.sid,
      status: twilioData.status,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageSid: twilioData.sid,
        status: twilioData.status,
        to: cleanedPhone,
        originalPhone: phone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in send-whatsapp-reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
