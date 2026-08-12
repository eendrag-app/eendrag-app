import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/db/server";
import { PushToggle } from "@/core/notifications/push-toggle";
import { InstallCard } from "@/core/pwa/install";
import { requireProfile, type Role } from "@/core/permissions";
import { siteOrigin } from "@/core/site";
import { SectionBadge } from "@/core/ui/section-badge";
import { allAdminPanels, allNotificationCategories } from "@/modules/registry";
import { CalendarFeed } from "../components/calendar-feed";
import { DetailsForm } from "../components/details-form";
import { NotificationSettings } from "../components/notification-settings";
import { QuietHoursForm } from "../components/quiet-hours-form";
import { SignOutButton } from "../components/sign-out-button";

export const metadata = { title: "Profile" };

// Everything about "you": details, what the app is allowed to tell you,
// your calendar link, and — if you are HK — the way in to every module's
// admin surface. The admin list and the notification switches are both built
// from the module registry, so a new module appears here for free.
export default async function ProfilePage() {
  const profile = await requireProfile();
  const db = await createClient();

  const [sections, sports, played, prefs] = await Promise.all([
    db.from("sections").select("id, name").order("sort_order"),
    db.from("sports").select("id, name").eq("is_active", true).order("name"),
    db.from("user_sports").select("sport_id").eq("profile_id", profile.id),
    db.from("notification_preferences").select("category, enabled"),
  ]);

  const categories = allNotificationCategories();
  const enabled = Object.fromEntries(
    categories.map((c) => [
      c,
      // A missing row means the signup default: everything on except
      // section-only mode (src/core/notifications/targeting.ts).
      prefs.data?.find((p) => p.category === c)?.enabled ?? c !== "section",
    ]),
  );

  const hasAdminTools = allAdminPanels().some((p) => p.roles.includes(profile.role as Role));
  const mySection = sections.data?.find((s) => s.id === profile.section_id);
  // Server-read so the switch is simply absent when push is not configured.
  const pushPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";
  const origin = await siteOrigin();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold">
          {profile.full_name || "Your profile"}
        </h1>
        {mySection && <SectionBadge name={mySection.name} />}
      </div>
      <p className="text-muted-foreground -mt-2 text-sm">{profile.email}</p>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            Your name and section are visible to the rest of the res.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetailsForm
            fullName={profile.full_name}
            sectionId={profile.section_id}
            roomNumber={profile.room_number}
            sections={sections.data ?? []}
            sports={sports.data ?? []}
            playedSportIds={(played.data ?? []).map((s) => s.sport_id)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            What the app is allowed to tell you — in the bell, and on your phone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <NotificationSettings categories={categories} enabled={enabled} />
          <div className="space-y-2 border-t pt-4">
            <h2 className="text-sm font-medium">Quiet hours</h2>
            <QuietHoursForm
              start={profile.quiet_hours_start.slice(0, 5)}
              end={profile.quiet_hours_end.slice(0, 5)}
            />
          </div>
          {/* No VAPID key configured for this deployment = no switch to offer.
              The bell carries on either way (docs/OPERATIONS.md). */}
          {pushPublicKey ? (
            <PushToggle publicKey={pushPublicKey} />
          ) : (
            <div className="space-y-1 border-t pt-4">
              <h2 className="text-sm font-medium">On this device</h2>
              <p className="text-muted-foreground text-sm">
                Notifications to your phone are not switched on for this deployment
                yet. Everything still arrives in the bell.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renders nothing once the app is installed. */}
      <InstallCard />

      <Card>
        <CardHeader>
          <CardTitle>Your calendar in your phone</CardTitle>
          <CardDescription>
            A private link you can subscribe to. Keep it to yourself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarFeed url={`${origin}/api/calendar/${profile.calendar_token}.ics`} />
        </CardContent>
      </Card>

      {/* The admin tools themselves live on the Admin tab now — this is just a
          signpost for anyone who still looks for them down here. */}
      {hasAdminTools && (
        <Card>
          <CardContent>
            <Link
              href="/admin"
              className="hover:bg-muted/60 -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2"
            >
              <ShieldCheck className="text-muted-foreground size-4" aria-hidden />
              <span className="flex-1">
                <span className="block text-sm font-medium">Admin tools</span>
                <span className="text-muted-foreground block text-sm">
                  They have their own tab now — announcements, calendar, sport, members.
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-4" aria-hidden />
            </Link>
          </CardContent>
        </Card>
      )}

      <SignOutButton />
    </div>
  );
}
