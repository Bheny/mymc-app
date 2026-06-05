import { redirect } from "next/navigation";

// Profile has been merged into Settings.
export default function ProfilePage() {
  redirect("/settings");
}
