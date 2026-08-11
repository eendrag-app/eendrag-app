import { AnnouncementEditor } from "./admin-announcement-editor";

export const metadata = { title: "Edit announcement" };

export default async function AdminAnnouncementEditPage({
  params,
}: PageProps<"/admin/announcements/[id]">) {
  const { id } = await params;
  return <AnnouncementEditor id={id} />;
}
