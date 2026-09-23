"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Play, Pause, Trash2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { AudioSource } from "@/types";
import { formatDuration, MAX_AUDIO_DURATION_SECONDS, BRIEF_REF_5190_MAX_BYTES } from "@/lib/constants";

interface AudioRecorderProps {
  onAudioReady: (audio: AudioSource) => void;
  disabled?: boolean;
}

export function AudioRecorder({ onAudioReady, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<AudioSource | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<{ title: string; detail: string; action?: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordedAudio?.blobUrl) {
        URL.revokeObjectURL(recordedAudio.blobUrl);
      }
    };
  }, [recordedAudio?.blobUrl]);

  // Canvas visualizer for active live recording
  const startVisualizer = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = Math.max(4, (dataArray[i] / 255) * canvas.height);
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, "#4f46e5");
          gradient.addColorStop(1, "#ef4444");
          ctx.fillStyle = gradient;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      };

      draw();
    } catch {
      // Non-critical visualizer fallback
    }
  }, []);

  const stopVisualizer = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    stopVisualizer();
    setIsRecording(false);
  }, [stopVisualizer]);

  // Auto-stop at maximum duration limit (10 minutes)
  useEffect(() => {
    if (isRecording && elapsedTime >= MAX_AUDIO_DURATION_SECONDS) {
      stopRecording();
      setErrorMessage({
        title: "10-Minute Limit Reached",
        detail: "Live recording automatically stopped because the 10-minute maximum limit was reached.",
      });
    }
  }, [elapsedTime, isRecording, stopRecording]);

  const startRecording = async () => {
    setErrorMessage(null);
    if (recordedAudio?.blobUrl) {
      URL.revokeObjectURL(recordedAudio.blobUrl);
      setRecordedAudio(null);
    }
    chunksRef.current = [];
    setElapsedTime(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported mime type
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      let selectedMimeType = "";
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = selectedMimeType || "audio/webm";
        const extension = mimeType.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size === 0) {
          setErrorMessage({
            title: "Empty Recording",
            detail: "No audio was captured. Please check your microphone input volume and try again.",
          });
          return;
        }

        if (blob.size > BRIEF_REF_5190_MAX_BYTES) {
          setErrorMessage({
            title: "File Exceeds 25 MB Limit",
            detail: `The captured audio exceeded the 25 MB limit (${(blob.size / (1024 * 1024)).toFixed(1)} MB).`,
          });
          return;
        }

        const fileName = `mentorship-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${extension}`;
        const file = new File([blob], fileName, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        const newAudio: AudioSource = {
          file,
          blobUrl,
          duration: elapsedTime,
          name: fileName,
          size: blob.size,
        };

        setRecordedAudio(newAudio);
      };

      recorder.start(250); // collect 250ms chunks
      setIsRecording(true);
      startVisualizer(stream);

      timerIntervalRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      stopRecording();
      const error = err as { name?: string; message?: string };
      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        setErrorMessage({
          title: "Microphone Access Denied",
          detail: "Your browser or system blocked access to the microphone.",
          action: "Click the lock or site settings icon in your browser address bar, set Microphone to 'Allow', and reload the page.",
        });
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        setErrorMessage({
          title: "No Microphone Detected",
          detail: "No audio input hardware was found on your system. Please plug in or connect a microphone.",
        });
      } else {
        setErrorMessage({
          title: "Recording Error",
          detail: error?.message || "An unexpected error occurred while accessing the microphone.",
        });
      }
    }
  };

  const handleDiscard = () => {
    if (recordedAudio?.blobUrl) {
      URL.revokeObjectURL(recordedAudio.blobUrl);
    }
    setRecordedAudio(null);
    setElapsedTime(0);
    setPlaybackTime(0);
    setIsPlaying(false);
  };

  const handleCommit = () => {
    if (recordedAudio) {
      onAudioReady(recordedAudio);
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
      {errorMessage && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">{errorMessage.title}</p>
              <p className="mt-1 text-red-700">{errorMessage.detail}</p>
              {errorMessage.action && (
                <p className="mt-2 text-xs font-medium text-red-800 bg-red-100/70 p-2 rounded-lg border border-red-200/80">
                  {errorMessage.action}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recording in Progress State */}
      {isRecording && (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border-2 border-red-300 shadow-sm transition-all animate-pulse-subtle">
          <div className="flex items-center gap-3 mb-4">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600"></span>
            </span>
            <span className="text-red-700 font-bold uppercase tracking-wider text-sm">
              Live Recording Active
            </span>
          </div>

          <canvas ref={canvasRef} width={280} height={48} className="mb-4 rounded-lg bg-slate-50 w-full max-w-xs" />

          <div className="text-4xl font-mono font-bold text-slate-800 mb-2">
            {formatDuration(elapsedTime)}
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Limit: 10 minutes maximum (up to 25 MB)
          </p>

          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-medium rounded-xl shadow transition cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop Recording
          </button>
        </div>
      )}

      {/* Review / Playback before commit State */}
      {!isRecording && recordedAudio && (
        <div className="flex flex-col p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-slate-800 text-sm">Recording Captured</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {formatDuration(recordedAudio.duration)} • {(recordedAudio.size / 1024).toFixed(0)} KB
            </span>
          </div>

          <audio
            ref={audioElementRef}
            src={recordedAudio.blobUrl}
            onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
            onEnded={() => {
              setIsPlaying(false);
              setPlaybackTime(0);
            }}
            className="hidden"
          />

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
                <span>{formatDuration(recordedAudio.duration)}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all"
                  style={{
                    width: `${recordedAudio.duration ? (playbackTime / recordedAudio.duration) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleDiscard}
              disabled={disabled}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl border border-slate-200 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Discard & Record Again
            </button>

            <button
              onClick={handleCommit}
              disabled={disabled}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Use This Recording
            </button>
          </div>
        </div>
      )}

      {/* Idle / Ready to Record State */}
      {!isRecording && !recordedAudio && (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-colors">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4">
            <Mic className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">Record Mentorship Session Live</h3>
          <p className="text-xs text-slate-500 text-center max-w-sm mb-6">
            Speak directly through your microphone. We will capture and prepare the audio for visual AI analysis.
          </p>
          <button
            onClick={startRecording}
            disabled={disabled}
            className="flex items-center gap-2.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-medium rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <Mic className="w-4 h-4" />
            Start Recording
          </button>
          <p className="text-[11px] text-slate-400 mt-4">
            Limit: Up to 10 minutes or 25 MB • Chrome & Safari supported
          </p>
        </div>
      )}
    </div>
  );
}
