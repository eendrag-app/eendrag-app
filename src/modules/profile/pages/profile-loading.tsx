import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shown while profile-page.tsx waits for the database. The shapes match the
// real page so nothing jumps when the content lands.
export default function ProfileLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-56" />
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
