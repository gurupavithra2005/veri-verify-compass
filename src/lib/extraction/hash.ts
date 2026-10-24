/** SHA-256 of a File/Blob using the Web Crypto API (browser only). */
export async function sha256Hash(file: Blob): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    console.error("Hashing failed", error);
    return null;
  }
}
