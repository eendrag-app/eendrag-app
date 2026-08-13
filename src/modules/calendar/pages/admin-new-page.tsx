import { CalendarEditor } from "./admin-editor";

export const metadata = { title: "New event" };

export default async function CalendarAdminNewPage({
  searchParams,
}: PageProps<"/calendar/admin/new">) {
  // ?day=2026-08-20 arrives from the month grid's "Add on this day".
  const { day } = await searchParams;
  return <CalendarEditor day={typeof day === "string" ? day : undefined} />;
}
