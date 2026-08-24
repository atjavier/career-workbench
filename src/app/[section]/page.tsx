import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationShell, applicationDestinations } from "@/app/application-shell";

const titles: Record<string, { title: string; summary: string }> = {
  settings: { title: "Settings", summary: "Manage preferences, permitted sources, privacy, and local storage here." },
};

export default async function PlaceholderPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const content = titles[section]; if (!content) notFound();
  return <ApplicationShell active={content.title}><div className="workspace-shell placeholder-page"><p className="eyebrow">Workspace destination</p><h1>{content.title}</h1><p>{content.summary}</p><p className="status" role="status">This workspace is being prepared. Your existing Jobs workspace remains available.</p><Link href="/">Return to Jobs</Link></div></ApplicationShell>;
}

export function generateStaticParams() { return applicationDestinations.filter((destination) => destination.href === "/settings").map((destination) => ({ section: destination.href.slice(1) })); }
