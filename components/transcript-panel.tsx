"use client";

import React, { useState } from "react";
import { Copy, Check, Download, FileText } from "lucide-react";

interface TranscriptPanelProps {
  transcript: string;
  summary?: string;
  fileName?: string;
  wordCount?: number;
}

export function TranscriptPanel({
  transcript,
  summary,
  fileName,
  wordCount,
}: TranscriptPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const content = `MENTORSHIP SESSION TRANSCRIPT
File: ${fileName || "session-recording"}
Date: ${new Date().toLocaleString()}
Summary: ${summary || "N/A"}
--------------------------------------------------

${transcript}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transcript-${(fileName || "session").replace(/\.[^/.]+$/, "")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const words = transcript.split(/\s+/).filter(Boolean).length;
  const estimatedReadMinutes = Math.max(1, Math.ceil(words / 130));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Session Transcript</h3>
            <p className="text-[11px] text-slate-500 font-mono">
              {words} words • ~{estimatedReadMinutes} min read
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer"
            title="Copy entire transcript to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer"
            title="Download transcript as .txt file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .txt</span>
          </button>
        </div>
      </div>

      {/* AI Summary Highlight */}
      {summary && (
        <div className="mb-4 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
          <span className="font-semibold text-indigo-900 block mb-1">
            Session Summary:
          </span>
          <p className="text-indigo-950/80 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Transcript Body */}
      <div className="flex-1 max-h-72 overflow-y-auto pr-2 rounded-xl bg-slate-50/50 p-4 border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap selection:bg-indigo-100">
        {transcript}
      </div>
    </div>
  );
}
