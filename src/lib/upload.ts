import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Downscale + JPEG-compress an image in the browser so phone photos
 * (5–10 MB) become fast, cheap uploads (~100–300 KB).
 */
export async function compressImage(
  file: File,
  maxDim = 1600
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // White backing so transparent PNGs don't turn black as JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );
  if (!blob) throw new Error("Could not process the image");
  return blob;
}

/** Upload to the public `uploads` bucket under the user's folder. */
export async function uploadImage(
  supabase: SupabaseClient,
  userId: string,
  blob: Blob
): Promise<{ url: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("uploads")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("uploads").getPublicUrl(path);
  return { url: data.publicUrl, ...dims };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
