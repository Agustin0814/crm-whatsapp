import type { Metadata } from "next";
import { Suspense } from "react";
import { CompanyPage } from "@/components/contacts/company-page";
import { ProfileSkeleton } from "@/components/crm/section-skeletons";

export const metadata: Metadata = { title: "Empresa" };

// Con Cache Components los params son datos de petición: se leen dentro de
// Suspense para que el resto de la página sea parte del armazón estático.
export default function CompanyRoute({ params }: PageProps<"/contactos/empresa/[id]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      {params.then(({ id }) => (
        <CompanyPage key={id} id={id} />
      ))}
    </Suspense>
  );
}
