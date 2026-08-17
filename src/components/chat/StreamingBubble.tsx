import type { ChatMsg } from "@/types/chat";
import { ChatBubble } from "./ChatBubble";

export function StreamingBubble({ text }: { text: string }) {
  const message: ChatMsg = {
    id: "streaming-assistant",
    from: "ai",
    text: text || "Preparing an approved-source answer…",
    time: "",
    isStreaming: true,
  };
  return <ChatBubble message={message} userName="" />;
}
