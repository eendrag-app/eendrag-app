import { deliverDuePushes } from "@/core/notifications/deferred";
import { calendarTick } from "@/modules/calendar/lib/tick";
import { homeTick } from "@/modules/home/lib/tick";
import { intersectionTick } from "@/modules/intersection/lib/tick";

// The periodic tick. Three things in the app need one: scheduled announcements
// have to be released at their time, people want a reminder about what is on
// today, and notifications held back by someone's quiet hours have to be
// pushed when the morning comes. Everything it does is idempotent, so running
// it twice, or late, or by hand, is safe.
//
// Wiring:
//   - Vercel   — vercel.json runs it every five minutes and sends
//                `Authorization: Bearer $CRON_SECRET` automatically.
//   - anywhere — plain cron plus:
//                curl -fsS "https://<host>/api/cron/tick?secret=$CRON_SECRET"
//
// Without CRON_SECRET set the route refuses to run at all (503) rather than
// standing open: an unauthenticated endpoint that sends notifications to 280
// people is not something to leave lying around. The announcement compose
// screen reads the same variable and warns when scheduling is not wired up.
//
// Adding another module's periodic work: export a tick function from that
// module's lib/ and call it below. This file is the composition point, the
// same way src/modules/registry.ts is for navigation.

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured — see docs/OPERATIONS.md" },
      { status: 503 },
    );
  }
  if (!authorised(request)) {
    return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });
  }

  const now = new Date();
  try {
    const home = await homeTick(now);
    const calendar = await calendarTick(now);
    const intersectionReminders = await intersectionTick(now);
    // Last, deliberately: anything the three above just created is already in
    // this queue, so a notification made during quiet hours is picked up on
    // the tick that ends them rather than the one after.
    const pushed = await deliverDuePushes(now);
    const result = {
      ok: true,
      at: now.toISOString(),
      published: home.published,
      reminders: calendar.reminders + intersectionReminders,
      pushed,
    };
    // Shows up in the Vercel logs next to the cron invocation, which is where
    // anyone debugging "why didn't my scheduled post go out" will look.
    console.info("[cron] tick", result);
    return Response.json(result);
  } catch (error) {
    console.error("[cron] tick failed", error);
    return Response.json({ ok: false, error: "Tick failed — see the logs" }, { status: 500 });
  }
}
