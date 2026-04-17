import { redirect } from "next/navigation";

/** Old path; care notes live at `/notes`. */
export default function JournalRedirectPage() {
  redirect("/notes");
}
