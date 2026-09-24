import { ApplicationShell } from "@/app/application-shell";
import { EvidenceDetailsWorkspace } from "@/app/evidence-details-workspace";
import { listExperienceProjectCollection } from "@/domain/evidence/evidence-library";

export const dynamic = "force-dynamic";

export default async function EvidenceDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; name?: string }>;
}) {
  const { category, name } = await searchParams;
  const decodedName = name ? decodeURIComponent(name) : "";
  const collection = await listExperienceProjectCollection().catch(() => []);

  const item =
    collection.find(
      (i) =>
        i.name.toLowerCase() === decodedName.toLowerCase() &&
        (!category || i.category === category),
    ) ??
    collection.find((i) => i.name.toLowerCase() === decodedName.toLowerCase());

  return (
    <ApplicationShell active="Resume" activeSubItem="Experience & Projects">
      <EvidenceDetailsWorkspace item={item} requestedName={decodedName} />
    </ApplicationShell>
  );
}
