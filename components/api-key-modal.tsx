"use client";

import React, { useState, useEffect } from "react";
import { Key, X, Check, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

export function ApiKeyModal({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
}: ApiKeyModalProps) {
  const [inputValue, setInputValue] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setInputValue(apiKey);
  }, [apiKey]);

  if (!isOpen) return null;

  const cleanKey = inputValue.trim().replace(/^["']|["']$/g, "");
  const isGemini = cleanKey.startsWith("AIza") || cleanKey.startsWith("AQ.");
  const isGroq = cleanKey.startsWith("gsk_");
  const isOpenAI = cleanKey.startsWith("sk-");

  const handleSave = () => {
    onSaveApiKey(cleanKey);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleRemove = () => {
    setInputValue("");
    onSaveApiKey("");
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 z-10">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">AI Provider Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          Enter your <strong>Google Gemini</strong> key (<code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-mono">AIza...</code>) or <strong>Groq</strong> key (<code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-mono">gsk_...</code>). The app will automatically detect your provider.
        </p>

        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700">
              API Key
            </label>
            {isGemini && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Detected: Google Gemini
              </span>
            )}
            {isGroq && (
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Detected: Groq
              </span>
            )}
            {isOpenAI && (
              <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Detected: OpenAI
              </span>
            )}
          </div>

          <input
            type="password"
            placeholder="AIza... or gsk_..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 focus:bg-white transition"
          />

          <div className="flex flex-col gap-1 text-[11px] text-slate-500">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Stored strictly in your local browser session</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                Free Gemini Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                Free Groq Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {apiKey ? (
            <button
              onClick={handleRemove}
              className="text-xs text-red-600 hover:underline cursor-pointer"
            >
              Clear key
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
