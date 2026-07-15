import { notFound } from "next/navigation";
import { getIsOwner } from "@/lib/auth-utils";

interface Props {
  params: Promise<{ credentialId: string }>;
}

export default async function CredentialDetailPage({ params }: Props) {
  if (!(await getIsOwner())) notFound();
  const { credentialId } = await params;
  return <div>CredentialDetailPage {credentialId}</div>;
}
