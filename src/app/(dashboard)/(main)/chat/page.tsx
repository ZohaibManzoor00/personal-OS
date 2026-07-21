import { GenericContainer } from "@/components/generic-container";
import { AiChatWorkspace } from "@/features/chat/components/ai-chat-workspace";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default function ChatPage() {
  // Warm the graph so the toggle flips instantly.
  prefetch(trpc.dashboard.graph.queryOptions());

  return (
    <HydrateClient>
      <GenericContainer>
        <AiChatWorkspace />
      </GenericContainer>
    </HydrateClient>
  );
}
