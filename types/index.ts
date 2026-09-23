export interface AudioSource {
  file: File;
  blobUrl: string;
  duration: number; // in seconds
  name: string;
  size: number; // in bytes
}

export interface WordCloudItem {
  text: string;
  value: number; // Prominence score (1-100)
}

export interface AnalysisResponse {
  transcript: string;
  words: WordCloudItem[];
  summary?: string;
  duration?: number;
  wordCount?: number;
  error?: string;
}

export type ProcessingStage =
  | "idle"
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "complete"
  | "error";

export interface SessionHistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  duration: number;
  wordCount: number;
  words: WordCloudItem[];
  transcript: string;
  summary?: string;
}
