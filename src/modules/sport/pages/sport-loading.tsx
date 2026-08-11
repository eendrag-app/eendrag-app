import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shared by every sport route: the landing list, a sport's page, and the
// admin screen are all "heading then a stack of cards".
export default function SportLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-64" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
