"use client";

import React, { useState } from "react";
import { UploadCloud, Mic, Sparkles, Check, RefreshCw, AudioWaveform } from "lucide-react";
import { AudioSource } from "@/types";
import { AudioUploader } from "./audio-uploader";
import { AudioRecorder } from "./audio-recorder";
import { formatBytes, formatDuration } from "@/lib/constants";

interface AudioPanelProps {
  onStartAnalysis: (audio: AudioSource) => void;
  isProcessing: boolean;
}

export function AudioPanel({ onStartAnalysis, isProcessing }: AudioPanelProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "record">("upload");
  const [stagedAudio, setStagedAudio] = useState<AudioSource | null>(null);

  const handleAudioReady = (audio: AudioSource) => {
    setStagedAudio(audio);
  };

  const handleReset = () => {
    if (stagedAudio?.blobUrl) {
      URL.revokeObjectURL(stagedAudio.blobUrl);
    }
    setStagedAudio(null);
  };

  const handleAnalyzeClick = () => {
    if (stagedAudio && !isProcessing) {
      onStartAnalysis(stagedAudio);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* If an audio file is staged and ready to analyze */}
      {stagedAudio ? (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">Session Audio Ready</h3>
                <p className="text-xs text-slate-500">
                  {stagedAudio.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              disabled={isProcessing}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                Duration
              </span>
              <span className="text-base font-mono font-bold text-slate-700">
                {formatDuration(stagedAudio.duration)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                File Size
              </span>
              <span className="text-base font-mono font-bold text-slate-700">
                {formatBytes(stagedAudio.size)}
              </span>
            </div>
          </div>

          <button
            onClick={handleAnalyzeClick}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            <span>Generate Mentorship Word Cloud</span>
          </button>
        </div>
      ) : (
        /* Dual-Door Ingestion Switcher */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200/80 bg-slate-50/50 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                activeTab === "upload"
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Audio File</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("record")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                activeTab === "record"
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Record Live Audio</span>
            </button>
          </div>

          {/* Panel Body */}
          <div className="p-6">
            {activeTab === "upload" ? (
              <AudioUploader onAudioReady={handleAudioReady} disabled={isProcessing} />
            ) : (
              <AudioRecorder onAudioReady={handleAudioReady} disabled={isProcessing} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
