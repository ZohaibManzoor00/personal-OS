import { requireAuth } from "@/lib/auth-utils";

interface Props {
  params: Promise<{ credentialId: string }>;
}

export default async function CredentialDetailPage({ params }: Props) {
  await requireAuth();
  const { credentialId } = await params;
  return <div>CredentialDetailPage {credentialId}</div>;
}
