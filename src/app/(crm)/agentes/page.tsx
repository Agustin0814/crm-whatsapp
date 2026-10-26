import type { Metadata } from "next";
import { AgentsView } from "@/components/agents/agents-view";

export const metadata: Metadata = { title: "Agentes" };

export default function AgentsPage() {
  return <AgentsView />;
}
