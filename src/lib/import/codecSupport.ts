/** Shown whenever a video's codec can't be decoded here (SPEC §5.5). */
export const UNSUPPORTED_VIDEO_MESSAGE =
  "This video format isn't supported in your browser. Try re-saving it, or use a different clip.";

/** Maps a video's codec string and the decoder's verdict to a message, or `null` if decodable. */
export function codecSupportMessage(
  codec: string | null,
  supported: boolean | undefined,
): string | null {
  if (!codec || supported !== true) return UNSUPPORTED_VIDEO_MESSAGE;
  return null;
}
