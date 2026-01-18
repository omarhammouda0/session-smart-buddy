import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Send Push Notification Edge Function
// Uses Firebase Cloud Messaging HTTP v1 API with Service Account

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  title: string;
  body: string;
  priority?: number;
  suggestionType?: string;
  actionType?: string;
  actionUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  conditionKey?: string;
  studentId?: string;
  sessionId?: string;
  studentPhone?: string;
}

// Generate JWT for Firebase Auth
async function generateFirebaseAccessToken(): Promise<string> {
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, '\n');
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");

  if (!privateKey || !clientEmail) {
    throw new Error("Firebase credentials not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // JWT Header
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  // JWT Payload
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
    scope: "https://www.googleapis.com/auth/firebase.messaging"
  };

  // Encode header and payload
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "session-smart-buddy";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: PushNotificationRequest = await req.json();

    console.log("Sending push notification:", body.title);

    // Check for duplicate notification (same condition key within last hour)
    if (body.conditionKey) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('push_notification_log')
        .select('id')
        .eq('condition_key', body.conditionKey)
        .eq('status', 'sent')
        .gte('sent_at', oneHourAgo)
        .maybeSingle();

      if (existing) {
        console.log("Duplicate notification, skipping:", body.conditionKey);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "duplicate" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build query for active FCM tokens
    // If userId is provided, filter by that user only
    let query = supabase
      .from('push_subscriptions')
      .select('fcm_token, user_id')
      .eq('is_active', true);

    // Note: For test notifications sent from the UI, we don't have userId
    // So we send to all active subscriptions (backwards compatible)

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No active push subscriptions found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Firebase access token
    const accessToken = await generateFirebaseAccessToken();

    // Send to all devices
    const results = [];
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    for (const sub of subscriptions) {
      // For web push, we use data-only messages so the service worker has full control
      // This ensures notifications work even when the browser is closed
      const message = {
        message: {
          token: sub.fcm_token,
          // Data-only payload - service worker will show the notification
          data: {
            title: body.title,
            body: body.body,
            priority: String(body.priority || 50),
            suggestionType: body.suggestionType || '',
            actionType: body.actionType || '',
            actionUrl: body.actionUrl || '/',
            studentId: body.studentId || '',
            sessionId: body.sessionId || '',
            studentPhone: body.studentPhone || '',
            conditionKey: body.conditionKey || '',
            timestamp: new Date().toISOString(),
            // Flag to indicate this is a data-only message
            showNotification: 'true'
          },
          // Web push config with high priority
          webpush: {
            headers: {
              Urgency: "high",
              TTL: "86400"
            },
            fcm_options: {
              link: body.actionUrl || '/'
            }
          },
          // Android config - high priority to wake device
          android: {
            priority: "high",
            ttl: "86400s"
          }
        }
      };

      try {
        const response = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(message)
        });

        const result = await response.json();

        if (!response.ok) {
          console.error("FCM error for token:", sub.fcm_token.substring(0, 20) + "...", result);

          // Mark token as inactive if it's invalid
          if (result.error?.code === 404 || result.error?.details?.[0]?.errorCode === "UNREGISTERED") {
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('fcm_token', sub.fcm_token);
          }

          results.push({ token: sub.fcm_token.substring(0, 20), success: false, error: result.error });
        } else {
          results.push({ token: sub.fcm_token.substring(0, 20), success: true, messageId: result.name });
        }
      } catch (error: unknown) {
        console.error("Failed to send to token:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ token: sub.fcm_token.substring(0, 20), success: false, error: errorMessage });
      }
    }


    // Log the notification
    // Note: For test notifications, we use the first subscription's user_id if available
    const logUserId = subscriptions[0]?.user_id || 'system';
    const successCount = results.filter(r => r.success).length;
    await supabase.from('push_notification_log').insert({
      user_id: logUserId,
      suggestion_type: body.suggestionType || 'general',
      priority: body.priority || 50,
      title: body.title,
      body: body.body,
      related_entity_type: body.relatedEntityType,
      related_entity_id: body.relatedEntityId,
      condition_key: body.conditionKey,
      fcm_response: { results, sent: successCount, total: subscriptions.length },
      status: successCount > 0 ? 'sent' : 'failed',
      error_message: successCount === 0 ? 'All sends failed' : null
    });

    console.log(`Push notification sent: ${successCount}/${subscriptions.length} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error sending push notification:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
