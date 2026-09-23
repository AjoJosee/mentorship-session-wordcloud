"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, AudioWaveform, BrainCircuit, Cloud, Check } from "lucide-react";
import { ProcessingStage } from "@/types";

interface ProgressLoaderProps {
  stage: ProcessingStage;
}

const STAGES = [
  {
    key: "uploading",
    title: "Ingesting Audio",
    desc: "Validating file limits and uploading audio chunks",
    icon: AudioWaveform,
  },
  {
    key: "transcribing",
    title: "Whisper AI Transcription",
    desc: "Converting spoken mentorship dialogue into clean text",
    icon: Sparkles,
  },
  {
    key: "analyzing",
    title: "Semantic Prominence Extraction",
    desc: "Filtering stopwords, normalizing variants, and scoring core themes",
    icon: BrainCircuit,
  },
  {
    key: "rendering",
    title: "Visual Cloud Synthesis",
    desc: "Computing collision spiral coordinates and layout bounds",
    icon: Cloud,
  },
];

export function ProgressLoader({ stage }: ProgressLoaderProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    switch (stage) {
      case "uploading":
        setActiveStepIndex(0);
        break;
      case "transcribing":
        setActiveStepIndex(1);
        break;
      case "analyzing":
        setActiveStepIndex(2);
        break;
      case "rendering":
        setActiveStepIndex(3);
        break;
      case "complete":
        setActiveStepIndex(4);
        break;
      default:
        setActiveStepIndex(0);
        break;
    }
  }, [stage]);

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl border border-indigo-100 shadow-lg">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-3 animate-bounce-subtle">
          <BrainCircuit className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800">
          Analyzing Mentorship Audio
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Extracting key discussion topics and prominence weights...
        </p>
      </div>

      <div className="space-y-3.5">
        {STAGES.map((step, idx) => {
          const isDone = idx < activeStepIndex;
          const isCurrent = idx === activeStepIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                isCurrent
                  ? "bg-indigo-50/70 border-indigo-200"
                  : isDone
                  ? "bg-slate-50/60 border-slate-100"
                  : "bg-white border-transparent opacity-40"
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  isCurrent
                    ? "bg-indigo-600 text-white shadow-xs"
                    : isDone
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? "text-indigo-950"
                        : isDone
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {step.title}
                  </p>
                  {isCurrent && (
                    <span className="text-[10px] font-medium text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded-full animate-pulse">
                      In progress
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 text-center">
        <p className="text-[11px] text-slate-400">
          Typically completes in 2 to 5 seconds with Whisper Turbo
        </p>
      </div>
    </div>
  );
}
