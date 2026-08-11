import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GreetingForm } from "../components/greeting-form";

// A module page is a server component. The route file under src/app is a
// one-line re-export of this — all real code stays inside the module folder.
export default function TemplatePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Template module</h1>
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            This page proves the module system end to end: a registered module,
            a routed page, and a server action with Zod validation.
          </p>
          <GreetingForm />
        </CardContent>
      </Card>
    </div>
  );
}
