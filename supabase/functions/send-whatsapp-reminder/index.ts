import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppReminderRequest {
  studentName: string;
  phoneNumber: string;
  month?: string;
  year?: number;
  customMessage?: string;
  testMode?: boolean;
}

// Format phone number for Egypt (+20) 
const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  
  // Remove leading zeros
  while (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Remove any existing country code prefix for re-formatting
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle Egyptian numbers
  if (cleaned.startsWith('20')) {
    return `+${cleaned}`;
  }
  
  // Assume Egyptian number if starts with 1 (e.g., 1012345678)
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return `+20${cleaned}`;
  }
  
  // Default: add Egypt country code
  return `+20${cleaned}`;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: WhatsAppReminderRequest = await req.json();
    const { studentName, phoneNumber, month, year, customMessage, testMode } = body;

    console.log("Received request:", { studentName, phoneNumber, month, year, hasCustomMessage: !!customMessage, testMode });

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Missing Twilio credentials");
      throw new Error("Missing Twilio credentials - تحقق من إعدادات Twilio");
    }

    // In test mode, just verify credentials work without actually sending
    if (testMode) {
      console.log("Test mode - verifying Twilio credentials");
      // Make a simple API call to verify credentials
      const testUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
      const testResponse = await fetch(testUrl, {
        headers: {
          "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
      });
      
      if (!testResponse.ok) {
        const error = await testResponse.json();
        throw new Error(error.message || "Invalid Twilio credentials");
      }
      
      console.log("Twilio credentials verified successfully");
      return new Response(
        JSON.stringify({ success: true, message: "Twilio credentials valid" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate phone number
    if (!phoneNumber || phoneNumber.trim() === '') {
      throw new Error("رقم الهاتف مطلوب");
    }

    // Format phone number for WhatsApp
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const toNumber = `whatsapp:${formattedPhone}`;
    const fromWhatsApp = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

    console.log("Formatted phone:", { original: phoneNumber, formatted: formattedPhone, toNumber });

    // Use custom message or default payment reminder
    const message = customMessage || 
      `مرحباً ${studentName}،\n\nهذا تذكير بدفع رسوم الحصص لشهر ${month} ${year}.\n\nشكراً لك! 🙏`;

    console.log("Sending message to:", toNumber);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: fromWhatsApp,
        To: toNumber,
        Body: message,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", result);
      // Provide more helpful error messages
      let errorMessage = result.message || "Failed to send WhatsApp message";
      if (result.code === 21211) {
        errorMessage = "رقم الهاتف غير صحيح";
      } else if (result.code === 21614) {
        errorMessage = "رقم الواتساب غير نشط";
      } else if (result.code === 21408) {
        errorMessage = "رصيد Twilio غير كافي";
      }
      throw new Error(errorMessage);
    }

    console.log("WhatsApp message sent successfully:", result.sid);

    return new Response(
      JSON.stringify({ success: true, messageSid: result.sid }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-whatsapp-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
