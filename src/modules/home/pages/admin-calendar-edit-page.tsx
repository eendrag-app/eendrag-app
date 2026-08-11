import { CalendarEditor } from "./admin-calendar-editor";

export const metadata = { title: "Edit event" };

export default async function AdminCalendarEditPage({
  params,
}: PageProps<"/admin/calendar/[id]">) {
  const { id } = await params;
  return <CalendarEditor id={id} />;
}
