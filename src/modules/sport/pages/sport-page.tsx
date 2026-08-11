import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder — phase two builds the real sport landing + detail pages here.
// Spec: docs/HANDOFF.md → "Sport module".
export default function SportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sport</h1>
      <Card>
        <CardHeader>
          <CardTitle>Sports</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Placeholder. Phase two: every sport with its latest result, detail
          pages with practices, fixtures, squad, and sign-up.
        </CardContent>
      </Card>
    </div>
  );
}
