import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  // For logging
  studentId?: string;
  type?: 'session' | 'payment' | 'cancellation' | 'report';
  sessionId?: string;
  sessionDate?: string;
  logToDb?: boolean;
}

// Format phone number - preserve international numbers, default to Egypt (+20) for local
const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  
  // If already has + prefix, it's an international number - keep it as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // Remove leading zeros for local numbers
  while (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle numbers that already have country code without +
  if (cleaned.startsWith('20') && cleaned.length > 10) {
    return `+${cleaned}`;
  }
  
  // Egyptian local number (starts with 1, 10 digits)
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return `+20${cleaned}`;
  }
  
  // Default: assume Egyptian number
  return `+20${cleaned}`;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: WhatsAppReminderRequest = await req.json();
    const { 
      studentName, 
      phoneNumber, 
      month, 
      year, 
      customMessage, 
      testMode,
      studentId,
      type = 'payment',
      sessionId,
      sessionDate,
      logToDb = true
    } = body;

    console.log("Received request:", { studentName, phoneNumber, month, year, hasCustomMessage: !!customMessage, testMode, type, logToDb });

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

    let status: 'sent' | 'failed' = 'sent';
    let errorMessage: string | null = null;
    let messageSid: string | null = null;

    if (!response.ok) {
      console.error("Twilio error:", result);
      status = 'failed';
      // Provide more helpful error messages
      errorMessage = result.message || "Failed to send WhatsApp message";
      if (result.code === 21211) {
        errorMessage = "رقم الهاتف غير صحيح";
      } else if (result.code === 21614) {
        errorMessage = "رقم الواتساب غير نشط";
      } else if (result.code === 21408) {
        errorMessage = "رصيد Twilio غير كافي";
      }
    } else {
      console.log("WhatsApp message sent successfully:", result.sid);
      messageSid = result.sid;
    }

    // Log to database if requested and we have required data
    if (logToDb && studentId && studentName && type !== 'report') {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          const logEntry = {
            user_id: 'default',
            type: type as 'session' | 'payment' | 'cancellation',
            student_id: studentId,
            student_name: studentName,
            phone_number: formattedPhone,
            message_text: message,
            status,
            twilio_message_sid: messageSid,
            error_message: errorMessage,
            session_id: sessionId || null,
            session_date: sessionDate || null,
            month: month ? parseInt(month) || null : null,
            year: year || null,
          };

          const { error: logError } = await supabase
            .from('reminder_log')
            .insert(logEntry);

          if (logError) {
            console.error("Failed to log reminder:", logError);
          } else {
            console.log("Reminder logged to database");
          }
        }
      } catch (logErr) {
        console.error("Error logging to database:", logErr);
      }
    }

    if (status === 'failed') {
      throw new Error(errorMessage || "Failed to send message");
    }

    return new Response(
      JSON.stringify({ success: true, messageSid }),
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
