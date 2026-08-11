import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder — phase two builds the real feed + calendar here.
// Spec: docs/HANDOFF.md → "Home module".
export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Home</h1>
      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Placeholder. Phase two: reverse-chronological feed, urgent posts
          pinned, search, archive, and the shared calendar.
        </CardContent>
      </Card>
    </div>
  );
}
