import { NextRequest, NextResponse } from "next/server";
import { Groq, toFile } from "groq-sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BRIEF_REF_5190_MAX_BYTES, validateAudioFile } from "@/lib/constants";
import { extractSemanticWords } from "@/lib/semantic-fallback";

export const maxDuration = 60; // Allow up to 60 seconds on serverless
export const dynamic = "force-dynamic";

interface WordItem {
  text: string;
  value: number;
}

const GROQ_CANDIDATE_CHAT_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
];

const SYSTEM_PROMPT = `You are an expert educational and mentorship session analyst.
Your task is to analyze a one-to-one mentorship session with a school student, answer what the session was actually about, and produce a structured list of prominent terms for a word cloud, plus a short 1-2 sentence executive summary.

STRICT RULES:
1. Identify between 20 and 50 prominent keywords, academic concepts, skills, challenges, and discussion topics that dominated the session.
2. PROMINENCE WEIGHTING: Assign a prominence score between 15 and 100 for each term based on how central and significant it was to the session's core purpose (NOT just raw uncalibrated frequency). Words that defined the session should be in the 70-100 range. Secondary topics in 35-65 range. Contextual details in 15-30 range.
3. STRIP ALL FILLER WORDS: Eliminate conversational filler completely (e.g., "um", "uh", "like", "you know", "sort of", "kind of", "actually", "basically", "literally", "yeah", "okay", "right", "gonna", "wanna", "mean").
4. STRIP STOPWORDS: Eliminate common English stopwords, pronouns, and generic verbs (e.g., "the", "and", "that", "this", "with", "have", "said", "would", "could", "just", "very", "about").
5. SENSIBLE NORMALIZATION:
   - Normalize case to lowercase (or Title Case for proper nouns/subjects like "Calculus", "Python").
   - Normalize plurals and inflections to canonical singular/root forms (e.g., merge "equations" and "equation" into "equation"; merge "studying", "studied" into "study").
   - Do NOT duplicate variants of the same word.
6. OUTPUT FORMAT: Respond ONLY with a valid JSON object matching this schema:
{
  "summary": "1-2 sentence concise answer to: What was this session actually about?",
  "words": [
    { "text": "calculus", "value": 95 },
    { "text": "derivatives", "value": 85 }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    // 1. Resolve API keys with auto-detection
    const customHeader = req.headers.get("x-custom-api-key")?.trim().replace(/^["']|["']$/g, "");
    let groqKey = req.headers.get("x-groq-api-key")?.trim().replace(/^["']|["']$/g, "") || process.env.GROQ_API_KEY?.trim();
    let geminiKey = req.headers.get("x-gemini-api-key")?.trim().replace(/^["']|["']$/g, "") || process.env.GEMINI_API_KEY?.trim();
    let openAIKey = req.headers.get("x-openai-api-key")?.trim().replace(/^["']|["']$/g, "") || process.env.OPENAI_API_KEY?.trim();

    if (customHeader) {
      if (customHeader.startsWith("AIza") || customHeader.startsWith("AQ.")) {
        geminiKey = customHeader;
      } else if (customHeader.startsWith("sk-")) {
        openAIKey = customHeader;
      } else if (customHeader.startsWith("gsk_")) {
        groqKey = customHeader;
      }
    }

    if (!groqKey && !openAIKey && !geminiKey) {
      return NextResponse.json(
        {
          error:
            "Missing AI API Key. Please add GROQ_API_KEY or GEMINI_API_KEY to your environment variables or enter your key via the API Key button.",
        },
        { status: 401 }
      );
    }

    // 2. Parse incoming audio file
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided in request." },
        { status: 400 }
      );
    }

    // 3. Size and format guardrails
    if (audioFile.size > BRIEF_REF_5190_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Audio file exceeds maximum size limit of 25 MB (${(audioFile.size / (1024 * 1024)).toFixed(1)} MB provided).`,
        },
        { status: 413 }
      );
    }

    const validation = validateAudioFile(audioFile);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Unsupported audio format." },
        { status: 415 }
      );
    }

    // Convert uploaded File to an in-memory Node Buffer for reliable serverless handling
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    let fileName = audioFile.name || "audio.webm";
    if (!fileName.includes(".")) {
      fileName = `${fileName}.webm`;
    }
    const mimeType = audioFile.type || "audio/webm";

    let transcript = "";
    let parsedWords: WordItem[] = [];
    let summary = "";
    let pipelineSuccess = false;
    let transcriptionError = "";

    // PATHWAY A: Groq Whisper Large v3 Turbo + Groq LLM (Primary & Fastest)
    if (groqKey && groqKey.startsWith("gsk_")) {
      const groq = new Groq({ apiKey: groqKey });

      // Step 1: Whisper Transcription with toFile buffer upload
      try {
        const fileUploadable = await toFile(audioBuffer, fileName, { type: mimeType });
        const res = await groq.audio.transcriptions.create({
          file: fileUploadable,
          model: "whisper-large-v3-turbo",
          response_format: "json",
          language: "en",
          temperature: 0.0,
        });
        transcript = (res.text || "").trim();
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        console.error("Groq transcription error:", error);
        transcriptionError = error.message || "Whisper audio upload failed";
      }

      // Step 2: Chat Analysis with active Groq models
      if (transcript && transcript.length > 5) {
        for (const model of GROQ_CANDIDATE_CHAT_MODELS) {
          try {
            const completion = await groq.chat.completions.create({
              model,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Mentorship Session Transcript:\n"""\n${transcript}\n"""` },
              ],
              response_format: { type: "json_object" },
              temperature: 0.2,
            });

            const content = completion.choices[0]?.message?.content;
            if (content) {
              const parsed = JSON.parse(content) as { summary?: string; words?: WordItem[] };
              if (Array.isArray(parsed.words) && parsed.words.length > 0) {
                parsedWords = parsed.words;
                summary = parsed.summary || "";
                pipelineSuccess = true;
                break;
              }
            }
          } catch (modelErr) {
            console.warn(`Groq chat model ${model} skipped:`, modelErr);
          }
        }
      }
    }

    // PATHWAY B: Google Gemini (Multimodal audio processing or semantic fallback)
    if (!pipelineSuccess && geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const geminiModels = ["gemini-2.5-flash", "gemini-1.5-flash"];

        for (const mName of geminiModels) {
          try {
            const model = genAI.getGenerativeModel({
              model: mName,
              generationConfig: { responseMimeType: "application/json" },
            });

            if (transcript && transcript.length > 5) {
              // We have transcript, extract themes
              const prompt = `${SYSTEM_PROMPT}\n\nMentorship Session Transcript:\n"""\n${transcript}\n"""`;
              const res = await model.generateContent(prompt);
              const content = res.response.text();
              if (content) {
                const parsed = JSON.parse(content);
                parsedWords = parsed.words || [];
                summary = parsed.summary || "";
                pipelineSuccess = true;
                break;
              }
            } else {
              // Direct multimodal transcription & extraction from audio bytes
              const base64Audio = audioBuffer.toString("base64");
              let geminiMime = mimeType;
              if (!geminiMime.startsWith("audio/")) {
                const ext = fileName.split(".").pop()?.toLowerCase();
                if (ext === "wav") geminiMime = "audio/wav";
                else if (ext === "m4a" || ext === "aac") geminiMime = "audio/mp4";
                else if (ext === "ogg") geminiMime = "audio/ogg";
                else if (ext === "webm") geminiMime = "audio/webm";
                else geminiMime = "audio/mp3";
              }

              const prompt = `${SYSTEM_PROMPT}\n\nCRITICAL: Transcribe this recorded audio conversation and produce JSON:
{
  "transcript": "Verbatim transcript of speech",
  "summary": "1-2 sentence answer to: What was this session actually about?",
  "words": [
    { "text": "calculus", "value": 95 }
  ]
}`;
              const res = await model.generateContent([
                { inlineData: { mimeType: geminiMime, data: base64Audio } },
                { text: prompt },
              ]);
              const content = res.response.text();
              if (content) {
                const parsed = JSON.parse(content);
                transcript = parsed.transcript || "";
                parsedWords = parsed.words || [];
                summary = parsed.summary || "";
                pipelineSuccess = true;
                break;
              }
            }
          } catch (gErr) {
            console.warn(`Gemini model ${mName} skipped:`, gErr);
          }
        }
      } catch (geminiError) {
        console.warn("Gemini processing error:", geminiError);
      }
    }

    // 4. Transcription Error or Silent Audio Check
    if (!transcript) {
      if (transcriptionError) {
        return NextResponse.json(
          {
            error: `Audio transcription failed: ${transcriptionError}. Please ensure you speak into the microphone or check your API key.`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error:
            "No audible speech detected. If you tested with sample-mentorship.wav, note that it contains test tones rather than spoken English. Please record live audio with your voice or upload a recording with speech.",
        },
        { status: 422 }
      );
    }

    const cleanWords = transcript.split(/\s+/).filter((w) => w.length > 0);
    if (cleanWords.length < 3) {
      return NextResponse.json(
        {
          error:
            "No audible speech detected in recording. Please ensure your microphone is capturing voice clearly and try again.",
        },
        { status: 422 }
      );
    }

    // 5. Safety Net: Linguistic Semantic Extractor
    if (!pipelineSuccess || parsedWords.length === 0) {
      console.info("Engaging linguistic semantic extractor safety net");
      const fallbackResult = extractSemanticWords(transcript);
      parsedWords = fallbackResult.words;
      summary = summary || fallbackResult.summary;
    }

    const words = parsedWords
      .filter((item) => item.text && typeof item.value === "number")
      .map((item) => ({
        text: item.text.trim(),
        value: Math.min(100, Math.max(10, Math.round(item.value))),
      }))
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      transcript,
      words,
      summary:
        summary ||
        "Session analysis completed. The prominent topics reflect the core focus areas discussed during mentorship.",
      wordCount: cleanWords.length,
    });
  } catch (error: unknown) {
    console.error("Fatal API route error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
