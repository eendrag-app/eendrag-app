import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder — phase two builds profile details, notification settings
// (derived from the module registry), and the Admin list here.
// Spec: docs/HANDOFF.md → "Profile module".
export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Placeholder. Phase two: name, section, room, sports, notification
          toggles with quiet hours, and admin tools from the registry.
        </CardContent>
      </Card>
    </div>
  );
}
