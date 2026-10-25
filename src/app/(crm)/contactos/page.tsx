import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactsView } from "@/components/contacts/contacts-view";
import { ContactsSkeleton } from "@/components/crm/section-skeletons";

export const metadata: Metadata = { title: "Contactos" };

// ContactsView lee ?tab= (useSearchParams), por eso va dentro de Suspense;
// el fallback es el mismo esqueleto que loading.tsx (sin saltos).
export default function ContactsPage() {
  return (
    <Suspense fallback={<ContactsSkeleton />}>
      <ContactsView />
    </Suspense>
  );
}
