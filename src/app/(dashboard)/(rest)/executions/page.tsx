import { notFound } from "next/navigation";
import { getIsOwner } from "@/lib/auth-utils";

export default async function ExecutionsPage() {
  if (!(await getIsOwner())) notFound();
  return <div>ExecutionsPage</div>;
}
