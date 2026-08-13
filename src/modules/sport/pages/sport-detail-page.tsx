import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, MapPin, Phone, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { requireProfile } from "@/core/permissions";
import { formatDateTime, relativeTime, toLocalInput } from "@/core/ui/format";
import { SectionBadge } from "@/core/ui/section-badge";
import { FixtureList, type FixtureItem } from "../components/fixture-list";
import { ResultList, type ResultItem } from "../components/result-list";
import { GoingButton, type GoingPerson } from "../components/going-button";
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

  const [fixtures, results, scored, signups, mySignup] = await Promise.all([
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
    // Which fixtures are finished — every one of them, not just the recent
    // results shown below. Reading it off that limited list would make a
    // fixture older than the last eight results ask for its score again.
    db.from("sport_results").select("fixture_id").eq("sport_id", id).not("fixture_id", "is", null),
    db
      .from("sport_signups")
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

  // Who pressed "I'm going" — the sign-ups, which is what the count on the
  // button means and what tapping it lists.
  const goingPeople: GoingPerson[] = (signups.data ?? [])
    .filter((row) => row.profile !== null)
    .map((row) => ({
      id: row.profile!.id,
      name: row.profile!.full_name || "Someone without a name yet",
      sectionName: row.profile!.section?.name,
    }));
  const mySectionName = goingPeople.find((p) => p.id === profile.id)?.sectionName;

  // A fixture with a result is finished and lives under Results. Everything
  // else is still a fixture — either coming up, or played and waiting for
  // somebody to type the score in.
  const scoredFixtureIds = new Set(
    (scored.data ?? []).map((r) => r.fixture_id).filter((id): id is string => id !== null),
  );
  const openFixtures: FixtureItem[] = (fixtures.data ?? [])
    .filter((f) => !scoredFixtureIds.has(f.id))
    .map((f) => ({
      id: f.id,
      opponent: f.opponent,
      location: f.location,
      notes: f.notes,
      whenLabel: formatDateTime(f.starts_at),
      startsAtInput: toLocalInput(f.starts_at),
      awaitingScore: new Date(f.starts_at) < now,
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
          <CardTitle>Next practice</CardTitle>
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
              people={goingPeople}
              me={{
                id: profile.id,
                name: profile.full_name || "You",
                sectionName: mySectionName,
              }}
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
            // Contact details are text, not links. Tapping a number used to
            // open the dialler and tapping the address used to open a mail
            // app, both from a card people tap to read — the number is there
            // to be copied into WhatsApp, which is where the res actually
            // talks to its reps.
            <div className="space-y-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{repName}</p>
                {sport.rep?.section && (
                  <SectionBadge name={sport.rep.section.name} className="mt-1" />
                )}
              </div>
              {repPhone && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Phone className="size-4 shrink-0" aria-hidden />
                  <span className="select-all">{repPhone}</span>
                </p>
              )}
              {repEmail && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Mail className="size-4 shrink-0" aria-hidden />
                  <span className="break-all select-all">{repEmail}</span>
                </p>
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
          <CardDescription>
            Everything coming up, and on the shared calendar. Once a fixture has been
            played, its score goes in here and it moves to Results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FixtureList sportId={sport.id} fixtures={openFixtures} canEdit={canEdit} />
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
