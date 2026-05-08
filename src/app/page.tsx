'use client';
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const signOut = async () => {
    await authClient.signOut();
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Button onClick={signOut}>Sign Out</Button>
    </div>
  );
}
