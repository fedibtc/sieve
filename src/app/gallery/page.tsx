import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockGallery } from "@/components/blocks/block-gallery";

export const metadata: Metadata = {
  title: "Block gallery · sieve",
};

export default function GalleryPage() {
  // The gallery is a local development surface; keep it out of hosted deploys.
  if (process.env.VERCEL) {
    notFound();
  }
  return <BlockGallery />;
}
