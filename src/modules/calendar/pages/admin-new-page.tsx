import { CalendarEditor } from "./admin-editor";

export const metadata = { title: "New event" };

export default async function CalendarAdminNewPage() {
  return <CalendarEditor />;
}
