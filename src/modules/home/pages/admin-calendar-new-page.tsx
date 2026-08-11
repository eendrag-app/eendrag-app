import { CalendarEditor } from "./admin-calendar-editor";

export const metadata = { title: "New event" };

export default async function AdminCalendarNewPage() {
  return <CalendarEditor />;
}
