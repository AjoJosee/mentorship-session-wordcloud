"use client";

import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, FileAudio, AlertCircle, CheckCircle2, Play, Pause, X } from "lucide-react";
import { AudioSource } from "@/types";
import {
  validateAudioFile,
  formatBytes,
  formatDuration,
  MAX_AUDIO_DURATION_SECONDS,
  BRIEF_REF_5190_MAX_BYTES,
  SUPPORTED_AUDIO_EXTENSIONS,
} from "@/lib/constants";

interface AudioUploaderProps {
  onAudioReady: (audio: AudioSource) => void;
  disabled?: boolean;
}

export function AudioUploader({ onAudioReady, disabled }: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<AudioSource | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<{ title: string; detail: string } | null>(null);
  const [isLoadingDuration, setIsLoadingDuration] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const processFile = useCallback((file: File) => {
    setErrorMessage(null);

    // 1. Format and Size validation
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      setErrorMessage({
        title: "Invalid File",
        detail: validation.error || "The selected file could not be accepted.",
      });
      return;
    }

    setIsLoadingDuration(true);
    const objectUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(objectUrl);

    // 2. Read audio duration
    tempAudio.onloadedmetadata = () => {
      setIsLoadingDuration(false);
      const duration = tempAudio.duration;

      if (duration > MAX_AUDIO_DURATION_SECONDS) {
        URL.revokeObjectURL(objectUrl);
        setErrorMessage({
          title: "Audio Exceeds 10-Minute Limit",
          detail: `Your audio duration is ${formatDuration(duration)}. The maximum allowed duration is 10 minutes (${formatDuration(MAX_AUDIO_DURATION_SECONDS)}).`,
        });
        return;
      }

      const audioSource: AudioSource = {
        file,
        blobUrl: objectUrl,
        duration: isNaN(duration) ? 0 : duration,
        name: file.name,
        size: file.size,
      };

      setSelectedAudio(audioSource);
    };

    tempAudio.onerror = () => {
      setIsLoadingDuration(false);
      // Some valid audio containers may not fire metadata properly on all browsers, fallback with duration 0
      const audioSource: AudioSource = {
        file,
        blobUrl: objectUrl,
        duration: 0,
        name: file.name,
        size: file.size,
      };
      setSelectedAudio(audioSource);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    if (selectedAudio?.blobUrl) {
      URL.revokeObjectURL(selectedAudio.blobUrl);
    }
    setSelectedAudio(null);
    setErrorMessage(null);
    setPlaybackTime(0);
    setIsPlaying(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCommit = () => {
    if (selectedAudio) {
      onAudioReady(selectedAudio);
    }
  };

  const togglePlayback = () => {
    if (!audioElementRef.current) return;
    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <div className="w-full">
      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">{errorMessage.title}</p>
              <p className="mt-1 text-red-700">{errorMessage.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Selected Audio Preview State */}
      {selectedAudio ? (
        <div className="flex flex-col p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                <FileAudio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate" title={selectedAudio.name}>
                  {selectedAudio.name}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {formatBytes(selectedAudio.size)} • {formatDuration(selectedAudio.duration)}
                </p>
              </div>
            </div>
            <button
              onClick={handleClear}
              disabled={disabled}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <audio
            ref={audioElementRef}
            src={selectedAudio.blobUrl}
            onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
            onEnded={() => {
              setIsPlaying(false);
              setPlaybackTime(0);
            }}
            className="hidden"
          />

          {/* Audio Player */}
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60 mb-6">
            <button
              onClick={togglePlayback}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition shadow-sm cursor-pointer"
              title={isPlaying ? "Pause playback" : "Play preview"}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-600 font-mono mb-1">
                <span>{formatDuration(playbackTime)}</span>
                <span>{formatDuration(selectedAudio.duration)}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all"
                  style={{
                    width: `${selectedAudio.duration ? (playbackTime / selectedAudio.duration) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleClear}
              disabled={disabled}
              className="px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-sm font-medium rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Choose Different File
            </button>

            <button
              onClick={handleCommit}
              disabled={disabled}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Use This Audio
            </button>
          </div>
        </div>
      ) : (
        /* Drag & Drop Dropzone State */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
            isDragging
              ? "border-indigo-600 bg-indigo-50/50 scale-[1.01]"
              : "border-slate-200 hover:border-indigo-400 bg-white"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_AUDIO_EXTENSIONS.join(",")}
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="font-semibold text-slate-800 mb-1">
            {isLoadingDuration ? "Inspecting Audio..." : "Drop Mentorship Audio Here"}
          </h3>
          <p className="text-xs text-slate-500 text-center max-w-sm mb-4">
            Drag and drop your recording file, or click to browse from your computer.
          </p>

          <span className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition">
            Browse Audio File
          </span>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-center gap-1 text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">
              Limits: Up to 25 MB or 10 minutes, whichever is hit first
            </span>
            <span>Accepted formats: MP3, WAV, M4A, AAC, OGG, WEBM, FLAC</span>
          </div>
        </div>
      )}
    </div>
  );
}
