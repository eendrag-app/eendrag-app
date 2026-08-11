import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shared by every intersection route — they are all "heading, then cards".
export default function IntersectionLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-44" />
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
