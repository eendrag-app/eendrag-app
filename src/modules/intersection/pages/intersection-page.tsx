import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder — phase two rebuilds the existing Intersection app here,
// behaviour unchanged. Spec: docs/HANDOFF.md → "Intersection module".
export default function IntersectionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Intersection</h1>
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Placeholder. Phase two: 12-section leaderboard, events with groups
          and brackets, player stats. Publicly viewable without login.
        </CardContent>
      </Card>
    </div>
  );
}
