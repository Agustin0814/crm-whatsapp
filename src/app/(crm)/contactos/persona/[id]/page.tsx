import type { Metadata } from "next";
import { Suspense } from "react";
import { PersonPage } from "@/components/contacts/person-page";
import { ProfileSkeleton } from "@/components/crm/section-skeletons";

export const metadata: Metadata = { title: "Contacto" };

// Con Cache Components los params son datos de petición: se leen dentro de Suspense.
export default function PersonRoute({ params }: PageProps<"/contactos/persona/[id]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      {params.then(({ id }) => (
        <PersonPage key={id} id={id} />
      ))}
    </Suspense>
  );
}
