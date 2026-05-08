import { caller } from "@/trpc/server";

export default async function Home() {
  const data = await caller.getUsers();
  console.log(data);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      {JSON.stringify(data)}
    </div>
  );
}
