import type { ClipboardEvent } from "react";

/** Pulls pasted images (e.g. a screenshot copied with the OS's snip tool) out of a paste event,
 * giving each one a stable filename — a pasted image has no real filename, browsers hand back
 * something generic like "image.png" for every one of them, which collides when someone pastes
 * more than one screenshot in the same session. */
export function extractPastedImages(event: ClipboardEvent): File[] {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageFiles = items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  if (!imageFiles.length) return [];

  return imageFiles.map((file, index) => {
    const extension = file.type.split("/")[1] || "png";
    return new File([file], `pasted-screenshot-${Date.now()}${imageFiles.length > 1 ? `-${index + 1}` : ""}.${extension}`, { type: file.type });
  });
}
