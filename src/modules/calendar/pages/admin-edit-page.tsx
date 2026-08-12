import { CalendarEditor } from "./admin-editor";

export const metadata = { title: "Edit event" };

export default async function CalendarAdminEditPage({
  params,
}: PageProps<"/calendar/admin/[id]">) {
  const { id } = await params;
  return <CalendarEditor id={id} />;
}
