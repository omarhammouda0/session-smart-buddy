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
    const { phone, message, studentName, type }: WhatsAppRequest = await req.json();

    // Validate required fields
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Phone and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number
    let cleanedPhone = phone.replace(/[^\d+]/g, "");
    if (cleanedPhone.startsWith("0")) {
      cleanedPhone = "20" + cleanedPhone.substring(1);
    }
    cleanedPhone = cleanedPhone.replace("+", "");

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
          data: { phone: cleanedPhone, messagePreview: message.substring(0, 100) },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send via Twilio WhatsApp API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("From", `whatsapp:${twilioPhone}`);
    formData.append("To", `whatsapp:+${cleanedPhone}`);
    formData.append("Body", message);

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
          error: twilioData.message || "Failed to send WhatsApp message",
          code: twilioData.code,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`WhatsApp message sent successfully to ${cleanedPhone} for ${studentName} (${type})`);

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
    console.error("Error in send-whatsapp-reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
