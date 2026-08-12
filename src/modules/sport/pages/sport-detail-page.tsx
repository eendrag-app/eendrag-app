import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, MapPin, Phone, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireProfile } from "@/core/permissions";
import { formatDateTime, relativeTime, toLocalInput } from "@/core/ui/format";
import { SectionBadge } from "@/core/ui/section-badge";
import { FixtureList, type FixtureItem } from "../components/fixture-list";
import { ResultList, type ResultItem } from "../components/result-list";
import { GoingButton } from "../components/going-button";
import { SportDetailsForm } from "../components/sport-details-form";

export const metadata = { title: "Sport" };

const RECENT_RESULTS = 8;

// Everything about one sport on one page — including the rep's editing. A rep
// runs their sport from the page the res reads, not from a separate admin
// screen. RLS decides whether the editing actually works; `canEdit` only
// decides whether it is offered.
export default async function SportDetailPage({ params }: PageProps<"/sport/[id]">) {
  const { id } = await params;
  const profile = await requireProfile();
  const db = await createClient();

  const { data: sport } = await db
    .from("sports")
    // sports!rep_id is named explicitly: sport_signups points at both sports
    // and profiles, which makes a bare `profiles(...)` embed ambiguous.
    .select(
      "id, name, description, practice_info, venue, coach, is_active, rep_id, rep_name, rep_phone, rep_email, rep:profiles!sports_rep_id_fkey(id, full_name, email, section:sections(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!sport) notFound();

  const [fixtures, results, signups, players, mySignup] = await Promise.all([
    db
      .from("sport_fixtures")
      .select("id, opponent, location, notes, starts_at")
      .eq("sport_id", id)
      .order("starts_at"),
    db
      .from("sport_results")
      .select("id, summary, score, played_at")
      .eq("sport_id", id)
      .order("played_at", { ascending: false })
      .limit(RECENT_RESULTS),
    db
      .from("sport_signups")
      .select("profile:profiles(id, full_name, section:sections(name))")
      .eq("sport_id", id),
    db
      .from("user_sports")
      .select("profile:profiles(id, full_name, section:sections(name))")
      .eq("sport_id", id),
    db
      .from("sport_signups")
      .select("profile_id")
      .eq("sport_id", id)
      .eq("profile_id", profile.id)
      .maybeSingle(),
  ]);

  const canEdit = profile.role === "admin" || sport.rep_id === profile.id;
  const now = new Date();

  // The squad is "people who play this" plus "people who put their hand up",
  // de-duplicated: signing up after listing it at onboarding is common.
  const squad = new Map<
    string,
    { id: string; name: string; sectionName?: string }
  >();
  for (const row of [...(players.data ?? []), ...(signups.data ?? [])]) {
    if (!row.profile) continue;
    squad.set(row.profile.id, {
      id: row.profile.id,
      name: row.profile.full_name || "Someone without a name yet",
      sectionName: row.profile.section?.name,
    });
  }

  const upcoming: FixtureItem[] = (fixtures.data ?? [])
    .filter((f) => new Date(f.starts_at) >= new Date(now.getTime() - 12 * 3600_000))
    .map((f) => ({
      id: f.id,
      opponent: f.opponent,
      location: f.location,
      notes: f.notes,
      whenLabel: formatDateTime(f.starts_at),
      startsAtInput: toLocalInput(f.starts_at),
    }));

  const recent: ResultItem[] = (results.data ?? []).map((r) => ({
    id: r.id,
    summary: r.summary,
    score: r.score,
    whenLabel: relativeTime(r.played_at, now),
  }));
  // The query is already newest-first, so the headline is simply the first.
  const latest = recent[0];

  // The rep's contact details are whatever the HK typed. Fall back to the
  // linked account only where the field was left blank, so a rep who has
  // signed up still shows a name rather than an empty card.
  const repName = sport.rep_name || sport.rep?.full_name || sport.rep?.email || "";
  const repEmail = sport.rep_email || sport.rep?.email || "";
  const repPhone = sport.rep_phone;

  return (
    <div className="space-y-4">
      <Link
        href="/sport"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Sport
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{sport.name}</h1>
        {!sport.is_active && (
          <p className="text-muted-foreground text-sm">Not running at the moment.</p>
        )}
      </div>

      {/* The most recent result, first. Opening a sport is usually "how did we
          do?", and before this it meant scrolling past practice times, the
          rep's card and every fixture to find out. The full list is still
          below, and still includes this one — this is a headline, not a
          different set of facts. */}
      {latest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4" aria-hidden />
              Latest result
            </CardTitle>
            <CardDescription>{latest.whenLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold">{latest.summary}</p>
            {latest.score && (
              <p className="text-muted-foreground text-sm tabular-nums">{latest.score}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Practice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{sport.practice_info || "No practice times posted yet."}</p>
          {sport.venue && (
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-4" aria-hidden />
              {sport.venue}
            </p>
          )}
          {sport.coach && <p className="text-muted-foreground text-sm">Coach: {sport.coach}</p>}
          {sport.description && (
            <p className="pt-1 text-sm whitespace-pre-line">{sport.description}</p>
          )}
          <div className="pt-2">
            <GoingButton
              sportId={sport.id}
              going={Boolean(mySignup.data)}
              goingCount={signups.data?.length ?? 0}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rep</CardTitle>
        </CardHeader>
        <CardContent>
          {repName || repEmail || repPhone ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{repName}</p>
                {sport.rep?.section && (
                  <SectionBadge name={sport.rep.section.name} className="mt-1" />
                )}
              </div>
              {/* Phone first: a rep is far more likely to be WhatsApped than
                  emailed, and tel: opens the dialler where the number is
                  already selectable. */}
              {repPhone && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11"
                  nativeButton={false}
                  render={<a href={`tel:${repPhone.replace(/\s+/g, "")}`} />}
                >
                  <Phone aria-hidden />
                  {repPhone}
                </Button>
              )}
              {repEmail && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11"
                  nativeButton={false}
                  render={<a href={`mailto:${repEmail}`} />}
                >
                  <Mail aria-hidden />
                  Email the rep
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nobody runs this one yet. The HK appoints reps under Admin → Sports &amp;
              reps.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fixtures</CardTitle>
          <CardDescription>Everything coming up, and on the shared calendar.</CardDescription>
        </CardHeader>
        <CardContent>
          <FixtureList sportId={sport.id} fixtures={upcoming} canEdit={canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultList sportId={sport.id} results={recent} canEdit={canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden />
            Squad
          </CardTitle>
          <CardDescription>
            Everyone who plays this or has signed up — {squad.size}{" "}
            {squad.size === 1 ? "person" : "people"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {squad.size === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nobody yet. Be the first — the button is up under Practice.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {[...squad.values()].map((person) => (
                <li
                  key={person.id}
                  className="inline-flex items-center gap-1.5 rounded-4xl border px-2 py-1 text-sm"
                >
                  {person.name}
                  {person.sectionName && (
                    <span className="text-muted-foreground text-xs">{person.sectionName}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Edit this page</CardTitle>
            <CardDescription>
              You see this because you run {sport.name}
              {profile.role === "admin" ? " (or because you are on the HK)" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SportDetailsForm
              sportId={sport.id}
              practiceInfo={sport.practice_info}
              venue={sport.venue}
              coach={sport.coach}
              description={sport.description}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
