"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Cloud,
  History,
  Key,
  AlertCircle,
  RefreshCw,
  Plus,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { AudioSource, AnalysisResponse, ProcessingStage, WordCloudItem, SessionHistoryItem } from "@/types";
import { BRIEF_REF_5190_MAX_BYTES, formatBytes } from "@/lib/constants";
import { AudioPanel } from "@/components/audio-panel";
import { WordCloud } from "@/components/word-cloud";
import { TranscriptPanel } from "@/components/transcript-panel";
import { ProgressLoader } from "@/components/progress-loader";
import { SessionHistoryDrawer } from "@/components/session-history-drawer";
import { ApiKeyModal } from "@/components/api-key-modal";

const LOCAL_STORAGE_HISTORY_KEY = "mentorcloud_session_history_v1";
const LOCAL_STORAGE_KEY_OVERRIDE = "mentorcloud_groq_api_key_v1";

export default function Home() {
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [errorMessage, setErrorMessage] = useState<{
    title: string;
    message: string;
    action?: string;
  } | null>(null);

  const [currentResult, setCurrentResult] = useState<AnalysisResponse | null>(null);
  const [activeWords, setActiveWords] = useState<WordCloudItem[]>([]);
  const [initialWords, setInitialWords] = useState<WordCloudItem[]>([]);
  const [currentAudioMeta, setCurrentAudioMeta] = useState<{
    fileName: string;
    duration: number;
    size: number;
  } | null>(null);

  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const [mounted, setMounted] = useState(false);

  // Load history and custom API key from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
      const storedKey = localStorage.getItem(LOCAL_STORAGE_KEY_OVERRIDE);
      if (storedKey) {
        setCustomApiKey(storedKey);
      }
    } catch {
      // LocalStorage access fallback
    }
  }, []);

  const saveApiKey = (key: string) => {
    setCustomApiKey(key);
    try {
      if (key) {
        localStorage.setItem(LOCAL_STORAGE_KEY_OVERRIDE, key);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_OVERRIDE);
      }
    } catch {}
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    } catch {}
  };

  // Main Analysis Pipeline Trigger
  const handleStartAnalysis = async (audioSource: AudioSource) => {
    setErrorMessage(null);
    setCurrentAudioMeta({
      fileName: audioSource.name,
      duration: audioSource.duration,
      size: audioSource.size,
    });

    try {
      // Stage 1: Uploading
      setStage("uploading");

      const formData = new FormData();
      formData.append("audio", audioSource.file);

      // Transition visual stage to transcribing after a brief moment
      setTimeout(() => {
        setStage("transcribing");
      }, 700);

      const headers: Record<string, string> = {};
      if (customApiKey) {
        headers["x-groq-api-key"] = customApiKey;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        headers,
      });

      setStage("analyzing");

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `Analysis request failed with HTTP ${response.status}`);
      }

      // Stage 3: Rendering
      setStage("rendering");

      const analysisData = data as AnalysisResponse;
      setCurrentResult(analysisData);
      setActiveWords(analysisData.words);
      setInitialWords(analysisData.words);

      // Save to Session History
      const historyItem: SessionHistoryItem = {
        id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        fileName: audioSource.name,
        duration: audioSource.duration,
        wordCount: analysisData.wordCount || analysisData.transcript.split(/\s+/).length,
        words: analysisData.words,
        transcript: analysisData.transcript,
        summary: analysisData.summary,
      };

      setHistory((prev) => {
        const updated = [historyItem, ...prev.slice(0, 19)]; // Keep up to 20 past sessions
        try {
          localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Brief layout pause then complete
      setTimeout(() => {
        setStage("complete");
      }, 400);
    } catch (err: unknown) {
      console.error("Audio pipeline execution failed:", err);
      const error = err as Error;
      setStage("error");

      const msg = error.message || "An unexpected error occurred during audio analysis.";
      if (msg.toLowerCase().includes("key")) {
        setErrorMessage({
          title: "API Key Required / Invalid",
          message: msg,
          action: "Click 'API Key' in the header to enter a free Groq API key or set GROQ_API_KEY in .env.local.",
        });
      } else if (msg.toLowerCase().includes("rate limit")) {
        setErrorMessage({
          title: "AI Service Busy",
          message: msg,
          action: "The AI service is temporarily experiencing high demand. Please try again in 15 seconds.",
        });
      } else {
        setErrorMessage({
          title: "Processing Failed",
          message: msg,
          action: "Please verify the audio file contains audible speech and meets the 25 MB / 10-minute limit.",
        });
      }
    }
  };

  // Bonus: Remove a word from cloud without re-analyzing
  const handleRemoveWord = useCallback((wordText: string) => {
    setActiveWords((prev) => prev.filter((w) => w.text.toLowerCase() !== wordText.toLowerCase()));
  }, []);

  // Bonus: Reset removed words to original set
  const handleResetWords = useCallback(() => {
    setActiveWords(initialWords);
  }, [initialWords]);

  // Restore past session from history
  const handleRestoreSession = (session: SessionHistoryItem) => {
    setCurrentAudioMeta({
      fileName: session.fileName,
      duration: session.duration,
      size: 0,
    });
    setCurrentResult({
      transcript: session.transcript,
      words: session.words,
      summary: session.summary,
      wordCount: session.wordCount,
    });
    setActiveWords(session.words);
    setInitialWords(session.words);
    setErrorMessage(null);
    setStage("complete");
  };

  // Start a new session
  const handleStartNewSession = () => {
    setStage("idle");
    setCurrentResult(null);
    setActiveWords([]);
    setInitialWords([]);
    setErrorMessage(null);
    setCurrentAudioMeta(null);
  };

  const isProcessing =
    stage === "uploading" ||
    stage === "transcribing" ||
    stage === "analyzing" ||
    stage === "rendering";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-indigo-500 selection:text-white">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Purpose */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  MentorCloud
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  AI Mentorship Tool
                </span>
              </div>
              <p className="text-[11px] text-slate-500 -mt-0.5 hidden xs:block">
                What was this mentorship session actually about?
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="View saved session analyses"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
              {mounted && history.length > 0 && (
                <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {history.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Configure custom Groq API key"
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">API Key</span>
              {mounted && customApiKey && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Custom key configured" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col justify-start">
        {/* Subtle Limits Pill Indicator */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 bg-slate-100/90 rounded-full border border-slate-200/60 text-[11px] text-slate-600 text-center">
            <span className="font-semibold text-slate-800">Limits:</span>
            <span>Up to 25 MB (BRIEF_REF_5190_MAX_BYTES) or 10 min</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">MP3, WAV, M4A, AAC, OGG, WEBM, FLAC</span>
          </div>
        </div>

        {/* State 1: Error Display */}
        {stage === "error" && errorMessage && (
          <div className="max-w-xl mx-auto w-full p-6 bg-white rounded-2xl border border-red-200 shadow-sm mb-6">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shrink-0 mt-0.5">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-red-950 text-base">{errorMessage.title}</h3>
                <p className="mt-1 text-xs text-red-700 leading-relaxed">
                  {errorMessage.message}
                </p>
                {errorMessage.action && (
                  <p className="mt-3 p-2.5 bg-red-50 rounded-xl border border-red-200/80 text-xs font-medium text-red-900">
                    {errorMessage.action}
                  </p>
                )}
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={handleStartNewSession}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Try Another Audio File</span>
                  </button>
                  {errorMessage.title.includes("Key") && (
                    <button
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Set API Key</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 2: Processing in progress */}
        {isProcessing && (
          <div className="flex-1 flex items-center justify-center py-8">
            <ProgressLoader stage={stage} />
          </div>
        )}

        {/* State 3: Analysis Complete — Word Cloud & Transcript View */}
        {stage === "complete" && currentResult && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-800 truncate">
                    {currentAudioMeta?.fileName || "Mentorship Session"}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    {activeWords.length} prominent topics identified
                  </p>
                </div>
              </div>

              <button
                onClick={handleStartNewSession}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Analyze Another Session</span>
              </button>
            </div>

            {/* Word Cloud + Transcript Side-by-Side (or stacked on mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Word Cloud Column */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
                <WordCloud
                  words={activeWords}
                  initialWords={initialWords}
                  onRemoveWord={handleRemoveWord}
                  onResetWords={handleResetWords}
                />
              </div>

              {/* Transcript Column */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
                <TranscriptPanel
                  transcript={currentResult.transcript}
                  summary={currentResult.summary}
                  fileName={currentAudioMeta?.fileName}
                  wordCount={currentResult.wordCount}
                />
              </div>
            </div>
          </div>
        )}

        {/* State 4: Idle — Ready for Audio Ingestion */}
        {stage === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-8">
            <div className="text-center max-w-lg mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                One-to-One Mentorship Audio Analysis
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Mentors record sessions, but nobody has time to listen to 40 minutes again. Upload or record audio to instantly see what dominated the conversation.
              </p>
            </div>

            <AudioPanel onStartAnalysis={handleStartAnalysis} isProcessing={isProcessing} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Client-side audio validation & secure server-side AI processing</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Ref: TFG-WD-8823
          </span>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <SessionHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectSession={handleRestoreSession}
        onClearHistory={clearHistory}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={customApiKey}
        onSaveApiKey={saveApiKey}
      />
    </div>
  );
}
