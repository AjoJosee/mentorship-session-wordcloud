"use client";

import React from "react";
import { History, X, Clock, FileAudio, Trash2, ArrowRight } from "lucide-react";
import { SessionHistoryItem } from "@/types";
import { formatDuration } from "@/lib/constants";

interface SessionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: SessionHistoryItem[];
  onSelectSession: (session: SessionHistoryItem) => void;
  onClearHistory: () => void;
}

export function SessionHistoryDrawer({
  isOpen,
  onClose,
  history,
  onSelectSession,
  onClearHistory,
}: SessionHistoryDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Saved Sessions</h2>
                <p className="text-xs text-slate-500">
                  {history.length} past session{history.length === 1 ? "" : "s"} saved locally
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-3 bg-slate-100 text-slate-400 rounded-full inline-flex mb-3">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">No Past Sessions Yet</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Once you analyze live recordings or audio files, they will automatically be saved here for quick recall.
                </p>
              </div>
            ) : (
              history.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session);
                    onClose();
                  }}
                  className="p-4 rounded-xl border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileAudio className="w-4 h-4 text-indigo-500 shrink-0" />
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition">
                        {session.fileName}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0" />
                  </div>

                  {session.summary && (
                    <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                      {session.summary}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100">
                    <span>
                      {new Date(session.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>
                      {formatDuration(session.duration)} • {session.words.length} topics
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {history.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Saved History</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
