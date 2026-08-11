import Link from "next/link";
import { ChevronRight, Dumbbell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireProfile } from "@/core/permissions";
import { EmptyState } from "@/core/ui/empty-state";
import { relativeTime } from "@/core/ui/format";
import { practiceSummary } from "../lib/sport";

export const metadata = { title: "Sport" };

// One screen that answers "what is happening in res sport": every active
// sport, when it practises, and the last thing that happened.
const RECENT_RESULTS = 60;

export default async function SportPage() {
  await requireProfile();
  const db = await createClient();

  const [sports, results] = await Promise.all([
    db
      .from("sports")
      .select("id, name, practice_info, venue")
      .eq("is_active", true)
      .order("name"),
    // Newest first; the first row we meet for a sport is its latest result.
    db
      .from("sport_results")
      .select("sport_id, summary, score, played_at")
      .order("played_at", { ascending: false })
      .limit(RECENT_RESULTS),
  ]);

  const latestBySport = new Map<string, NonNullable<typeof results.data>[number]>();
  for (const result of results.data ?? []) {
    if (!latestBySport.has(result.sport_id)) latestBySport.set(result.sport_id, result);
  }

  const now = new Date();
  const items = sports.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sport</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No sports listed yet"
          description="The HK adds them under Profile → Admin tools → Sports & reps."
        />
      ) : (
        <div className="space-y-3">
          {items.map((sport) => {
            const latest = latestBySport.get(sport.id);
            const practice = practiceSummary(sport.practice_info, sport.venue);
            return (
              <Card key={sport.id} className="hover:bg-muted/40">
                <CardContent>
                  <Link href={`/sport/${sport.id}`} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="block font-medium">{sport.name}</span>
                      <span className="text-muted-foreground block text-sm">
                        {practice || "No practice times yet"}
                      </span>
                      {latest && (
                        <span className="block text-sm">
                          {latest.summary}
                          {latest.score ? ` ${latest.score}` : ""}
                          <span className="text-muted-foreground">
                            {" · "}
                            {relativeTime(latest.played_at, now)}
                          </span>
                        </span>
                      )}
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
