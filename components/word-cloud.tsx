"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import cloud from "d3-cloud";
import { Download, RefreshCw, X, Palette, ZoomIn, Info } from "lucide-react";
import { WordCloudItem } from "@/types";

export type ColorTheme = "indigo" | "sunset" | "emerald" | "monochrome";

interface WordCloudProps {
  words: WordCloudItem[];
  initialWords: WordCloudItem[];
  onRemoveWord: (text: string) => void;
  onResetWords: () => void;
}

interface PlacedWord extends WordCloudItem {
  x: number;
  y: number;
  size: number;
  rotate: number;
  color: string;
  width: number;
  height: number;
}

const PALETTES: Record<ColorTheme, { name: string; colors: string[] }> = {
  indigo: {
    name: "Indigo Vibrant",
    colors: ["#4338ca", "#4f46e5", "#6366f1", "#7c3aed", "#2563eb", "#0284c7"],
  },
  sunset: {
    name: "Warm Sunset",
    colors: ["#be123c", "#e11d48", "#ea580c", "#f97316", "#d97706", "#b45309"],
  },
  emerald: {
    name: "Emerald Focus",
    colors: ["#047857", "#059669", "#10b981", "#0d9488", "#0891b2", "#15803d"],
  },
  monochrome: {
    name: "Slate Modern",
    colors: ["#0f172a", "#1e293b", "#334155", "#475569", "#64748b", "#3b82f6"],
  },
};

export function WordCloud({
  words,
  initialWords,
  onRemoveWord,
  onResetWords,
}: WordCloudProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [theme, setTheme] = useState<ColorTheme>("indigo");
  const [placedWords, setPlacedWords] = useState<PlacedWord[]>([]);
  const [hoveredWord, setHoveredWord] = useState<PlacedWord | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 420 });
  const [isRendering, setIsRendering] = useState(false);

  // Measure container width responsively
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const width = Math.max(300, Math.min(containerWidth, 800));
        // Maintain a pleasant aspect ratio, slightly more compact on mobile (390px)
        const height = width < 450 ? 340 : 420;
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Compute word font size scale
  const { minVal, maxVal } = useMemo(() => {
    if (words.length === 0) return { minVal: 1, maxVal: 1 };
    const values = words.map((w) => w.value);
    return {
      minVal: Math.min(...values),
      maxVal: Math.max(...values),
    };
  }, [words]);

  // Generate word cloud layout
  const generateLayout = useCallback(() => {
    if (words.length === 0) {
      setPlacedWords([]);
      return;
    }

    setIsRendering(true);
    const { width, height } = dimensions;

    const minFont = width < 450 ? 13 : 16;
    const maxFont = width < 450 ? 44 : 58;

    const scale = (val: number) => {
      if (maxVal === minVal) return (minFont + maxFont) / 2;
      return minFont + ((val - minVal) / (maxVal - minVal)) * (maxFont - minFont);
    };

    const paletteColors = PALETTES[theme].colors;

    const layoutWords = words.map((word, idx) => ({
      text: word.text,
      value: word.value,
      size: scale(word.value),
      color: paletteColors[idx % paletteColors.length],
    }));

    try {
      const layout = cloud()
        .size([width, height])
        .words(layoutWords)
        .padding(width < 450 ? 3 : 5)
        .rotate(() => 0) // Keep purely horizontal for effortless readability at a glance
        .font("system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif")
        .fontSize((d) => d.size || 16)
        .on("end", (output: Array<{ text?: string; x?: number; y?: number; size?: number; rotate?: number }>) => {
          const placed: PlacedWord[] = output.map((d, index) => {
            const original = layoutWords[index] || { value: 50, color: "#4f46e5" };
            return {
              text: d.text || "",
              value: original.value,
              x: (d.x || 0) + width / 2,
              y: (d.y || 0) + height / 2,
              size: d.size || 16,
              rotate: d.rotate || 0,
              color: original.color,
              width: (d.text?.length || 1) * (d.size || 16) * 0.58,
              height: (d.size || 16) * 1.1,
            };
          });

          setPlacedWords(placed);
          setIsRendering(false);
        });

      layout.start();
    } catch (err) {
      console.error("Cloud layout generation failed:", err);
      setIsRendering(false);
    }
  }, [words, dimensions, theme, minVal, maxVal]);

  useEffect(() => {
    generateLayout();
  }, [generateLayout]);

  // Draw cloud onto Canvas with 2x High-DPI
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = dimensions;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Crisp background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Subtle background grid/dots
    ctx.fillStyle = "#f1f5f9";
    for (let x = 16; x < width; x += 32) {
      for (let y = 16; y < height; y += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render each word
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const word of placedWords) {
      ctx.font = `600 ${word.size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      // Glow / highlight if hovered
      if (hoveredWord?.text === word.text) {
        ctx.shadowColor = word.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = word.color;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.fillStyle = word.color;
      }

      ctx.save();
      ctx.translate(word.x, word.y);
      if (word.rotate) {
        ctx.rotate((word.rotate * Math.PI) / 180);
      }
      ctx.fillText(word.text, 0, 0);
      ctx.restore();
    }
  }, [placedWords, hoveredWord, dimensions]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle canvas mouse move for hover detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check hit test against placed words
    const hit = placedWords.find((w) => {
      const halfW = w.width / 2;
      const halfH = w.height / 2;
      return (
        mouseX >= w.x - halfW &&
        mouseX <= w.x + halfW &&
        mouseY >= w.y - halfH &&
        mouseY <= w.y + halfH
      );
    });

    setHoveredWord(hit || null);
  };

  // Handle canvas click to remove a word
  const handleCanvasClick = () => {
    if (hoveredWord) {
      onRemoveWord(hoveredWord.text);
      setHoveredWord(null);
    }
  };

  // PNG Export
  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary high-res canvas with title and timestamp
    const exportCanvas = document.createElement("canvas");
    const dpr = 2; // high res export
    exportCanvas.width = dimensions.width * dpr;
    exportCanvas.height = (dimensions.height + 60) * dpr;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height + 60);

    // Header banner
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Mentorship Session Analysis", 24, 28);

    ctx.fillStyle = "#64748b";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    const dateStr = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    ctx.fillText(`Generated ${dateStr} • MentorCloud`, dimensions.width - 24, 28);

    // Divider line
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 46);
    ctx.lineTo(dimensions.width - 24, 46);
    ctx.stroke();

    // Copy word cloud image
    ctx.drawImage(canvas, 0, 50, dimensions.width, dimensions.height);

    // Trigger download
    const link = document.createElement("a");
    link.download = `mentorship-wordcloud-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  const hasRemovedWords = words.length < initialWords.length;

  return (
    <div className="w-full flex flex-col" ref={containerRef}>
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Color Palette Selector */}
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-600">Theme:</span>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(Object.keys(PALETTES) as ColorTheme[]).map((pKey) => (
              <button
                key={pKey}
                onClick={() => setTheme(pKey)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer ${
                  theme === pKey
                    ? "bg-white text-indigo-700 shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {PALETTES[pKey].name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {hasRemovedWords && (
            <button
              onClick={onResetWords}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer"
              title="Reset all removed words"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Words ({initialWords.length - words.length} removed)</span>
            </button>
          )}

          <button
            onClick={handleDownloadPNG}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PNG</span>
          </button>
        </div>
      </div>

      {/* Cloud Canvas Container */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center p-2 min-h-[340px]">
        {isRendering && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-semibold">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Computing word prominence layout...</span>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredWord(null)}
          onClick={handleCanvasClick}
          className={`rounded-xl transition-all ${hoveredWord ? "cursor-pointer" : "cursor-default"}`}
        />

        {/* Hover Tooltip Overlay */}
        {hoveredWord && (
          <div
            className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full px-2.5 py-1 bg-slate-900/90 text-white text-xs rounded-lg shadow-lg backdrop-blur-xs z-20 flex items-center gap-1.5"
            style={{
              left: `${hoveredWord.x}px`,
              top: `${hoveredWord.y - hoveredWord.size / 2 - 6}px`,
            }}
          >
            <span className="font-semibold">{hoveredWord.text}</span>
            <span className="text-slate-300">({hoveredWord.value}% prominence)</span>
            <span className="text-[10px] text-red-300 border-l border-slate-700 pl-1.5 ml-1">
              Click to remove
            </span>
          </div>
        )}
      </div>

      {/* Interactive Word Pill List for Easy Removal */}
      <div className="mt-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Filter Words ({words.length} active topics)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Click any tag or cloud word to remove without re-analyzing
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
          {words.map((word) => (
            <button
              key={word.text}
              onClick={() => onRemoveWord(word.text)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 text-xs font-medium rounded-lg border border-slate-200/80 hover:border-red-200 transition cursor-pointer group"
              title={`Remove "${word.text}" from word cloud`}
            >
              <span>{word.text}</span>
              <span className="text-[10px] text-slate-400 group-hover:text-red-500 font-mono">
                {word.value}
              </span>
              <X className="w-3 h-3 text-slate-400 group-hover:text-red-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
