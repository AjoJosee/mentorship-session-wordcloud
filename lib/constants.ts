/**
 * Audio limits and validation constants traceable to brief revision.
 */

// Up to 25 MB limit enforced as required by Section 04
export const BRIEF_REF_5190_MAX_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes

// 10 minutes maximum limit
export const MAX_AUDIO_DURATION_SECONDS = 600; // 10 minutes

// Supported audio file extensions as specified in Section 04
export const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".webm",
  ".flac",
] as const;

export type SupportedAudioExtension = (typeof SUPPORTED_AUDIO_EXTENSIONS)[number];

// Supported MIME types across modern browsers (Chrome and Safari desktop & mobile)
export const SUPPORTED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "audio/flac",
  "audio/x-flac",
] as const;

/**
 * Format bytes into human-readable string (e.g. 14.2 MB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format seconds into MM:SS format
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Validate audio file extension and mime type
 */
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  const isExtensionValid = SUPPORTED_AUDIO_EXTENSIONS.includes(
    extension as SupportedAudioExtension
  );

  const isMimeValid =
    SUPPORTED_AUDIO_MIME_TYPES.some((mime) => file.type.startsWith("audio/") || file.type === mime) ||
    isExtensionValid; // Some OS/browsers leave file.type empty for .flac/.m4a

  if (!isExtensionValid && !isMimeValid) {
    return {
      valid: false,
      error: `Unsupported file format (${extension || "unknown"}). We accept: ${SUPPORTED_AUDIO_EXTENSIONS.join(", ").toUpperCase()}.`,
    };
  }

  if (file.size > BRIEF_REF_5190_MAX_BYTES) {
    return {
      valid: false,
      error: `File is too large (${formatBytes(file.size)}). Maximum allowed size is 25 MB.`,
    };
  }

  return { valid: true };
}
