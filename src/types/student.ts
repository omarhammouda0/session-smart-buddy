import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  phone?: string;
  phoneNumber?: string;
  message?: string;
  customMessage?: string;
  studentName: string;
  type: "session" | "payment" | "cancellation";
  studentId?: string;
  month?: string;
  year?: number;
  logToDb?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log the raw request body for debugging
    const rawBody = await req.text();
    console.log("Raw request body:", rawBody);

    let data: WhatsAppRequest;
    try {
      data = JSON.parse(rawBody);
      console.log("Parsed data:", data);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get phone from either phone or phoneNumber field
    const phone = data.phone || data.phoneNumber;
    console.log("Phone extracted:", phone);

    // Get message from either message or customMessage field
    const message = data.message || data.customMessage || "";
    console.log("Message extracted:", message.substring(0, 100));

    const { studentName, type, studentId, month, year, logToDb } = data;
    console.log("Other fields:", { studentName, type, studentId, month, year, logToDb });

    // Validate required fields
    if (!phone) {
      console.error("Phone is missing. Available fields:", {
        phone: data.phone,
        phoneNumber: data.phoneNumber,
      });
      return new Response(JSON.stringify({ error: "Phone is required", receivedData: data }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message || message.trim() === "") {
      console.error("Message is missing. Available fields:", {
        message: data.message,
        customMessage: data.customMessage,
      });
      return new Response(JSON.stringify({ error: "Message is required", receivedData: data }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log to database if requested
    if (logToDb && studentId) {
      try {
        console.log(`Logging WhatsApp reminder for student ${studentId} (${type})`);
        // Add your Supabase logging code here if needed
      } catch (dbError) {
        console.error("Failed to log to database:", dbError);
      }
    }

    // Clean phone number
    console.log("Original phone:", phone);
    let cleanedPhone = phone.replace(/[^\d+]/g, "");
    console.log("After removing non-digits:", cleanedPhone);

    if (cleanedPhone.startsWith("0")) {
      cleanedPhone = "966" + cleanedPhone.substring(1);
      console.log("After converting leading 0:", cleanedPhone);
    }
    cleanedPhone = cleanedPhone.replace("+", "");
    console.log("Final cleaned phone:", cleanedPhone);

    // Get Twilio credentials from environment
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    console.log("Twilio credentials check:", {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasTwilioPhone: !!twilioPhone,
    });

    if (!accountSid || !authToken || !twilioPhone) {
      console.log("Twilio credentials not configured, returning mock success");
      return new Response(
        JSON.stringify({
          success: true,
          mock: true,
          message: "WhatsApp credentials not configured. Message not sent.",
          data: { phone: cleanedPhone, messagePreview: message.substring(0, 100), studentName },
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
    console.log("Twilio response:", twilioData);

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      return new Response(
        JSON.stringify({
          success: false,
          error: twilioData.message || "Failed to send WhatsApp message",
          code: twilioData.code,
          details: twilioData,
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
        studentName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in send-whatsapp-reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const errorStack = error instanceof Error ? error.stack : "No stack trace";
    return new Response(
      JSON.stringify({
        error: errorMessage,
        stack: errorStack,
        timestamp: Date.now(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
