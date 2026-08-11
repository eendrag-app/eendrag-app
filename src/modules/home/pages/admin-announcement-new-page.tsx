import { AnnouncementEditor } from "./admin-announcement-editor";

export const metadata = { title: "New announcement" };

export default async function AdminAnnouncementNewPage() {
  return <AnnouncementEditor />;
}
