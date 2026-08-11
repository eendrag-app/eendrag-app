import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Used by both announcement admin routes — the list and the editor are close
// enough in shape that one skeleton serves.
export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-56" />
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-11 w-48" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
