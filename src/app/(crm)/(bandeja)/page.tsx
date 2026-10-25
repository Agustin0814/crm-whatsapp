import type { Metadata } from "next";
import { Suspense } from "react";
import { InboxSkeleton } from "@/components/crm/section-skeletons";
import { Inbox } from "@/components/inbox/inbox";

export const metadata: Metadata = { title: "Bandeja" };

// Bandeja. Inbox lee ?c=<id> (useSearchParams), por eso va dentro de Suspense;
// el fallback es el mismo esqueleto que loading.tsx (sin saltos).
export default function InboxPage() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <Inbox />
    </Suspense>
  );
}
