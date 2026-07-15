import { notFound } from "next/navigation";
import { getIsOwner } from "@/lib/auth-utils";

export default async function CredentialsPage() {
  if (!(await getIsOwner())) notFound();
  return <div>CredentialsPage</div>;
}
