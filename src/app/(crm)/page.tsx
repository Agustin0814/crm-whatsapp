import type { Metadata } from "next";
import { Suspense } from "react";
import { Inbox } from "@/components/inbox/inbox";

export const metadata: Metadata = { title: "Bandeja" };

// Bandeja. Inbox lee ?c=<id> (useSearchParams), por eso va dentro de Suspense.
export default function InboxPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <Inbox />
    </Suspense>
  );
}
