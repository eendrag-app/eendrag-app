import { calendarFeedForToken } from "@/core/calendar/ics-feed";

// The personal ICS feed, subscribed to from Google/Apple Calendar. Thin by
// design: the implementation lives in src/core/calendar/ics-feed.ts (data)
// and ics.ts (text).
//
// The URL ends in ".ics" because some calendar clients refuse anything else,
// so the [token] segment arrives as "<uuid>.ics".
export async function GET(_request: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token } = await ctx.params;
  const id = token.replace(/\.ics$/i, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const ics = await calendarFeedForToken(id);
  if (!ics) return new Response("Not found", { status: 404 });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="eendrag.ics"',
      // Calendar clients poll on their own schedule; five minutes stops a
      // badly behaved one from hammering the database.
      "Cache-Control": "private, max-age=300",
    },
  });
}
