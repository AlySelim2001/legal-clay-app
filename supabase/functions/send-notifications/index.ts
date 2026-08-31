// supabase/functions/send-notifications/index.ts
// Scheduled Edge Function: runs daily at 06:00 Cairo time (04:00 UTC)
// Queries pending notifications and sends push notifications in Arabic

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .rpc("get_pending_notifications");

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending notifications", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ schedule_id: string; status: string; message: string }> = [];

    // 2. Process each notification
    for (const notif of notifications) {
      const daysLabel =
        notif.days_until === 0
          ? "اليوم"
          : notif.days_until === 1
          ? "غدًا"
          : `خلال ${notif.days_until} يوم`;

      const message = `⏰ تذكير: جلسة ${notif.session_type} ${daysLabel} للقضية ${notif.case_no}`;

      // 3. Try to send push notification (Firebase / Web Push)
      // In production, integrate with FCM or Web Push API here
      console.log(`[CRIM-SYS] Notification: ${message}`);

      // 4. Mark as sent
      const { error: markError } = await supabase.rpc("mark_notification_sent", {
        p_schedule_id: notif.schedule_id,
        p_notification_type: notif.notification_type,
      });

      if (markError) {
        results.push({
          schedule_id: notif.schedule_id,
          status: "error",
          message: markError.message,
        });
      } else {
        // Also insert into notification_queue for audit
        await supabase.from("notification_queue").insert({
          schedule_id: notif.schedule_id,
          notification_type: notif.notification_type,
          message,
          sent: true,
          sent_at: new Date().toISOString(),
        });

        results.push({
          schedule_id: notif.schedule_id,
          status: "sent",
          message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} notifications`,
        count: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
