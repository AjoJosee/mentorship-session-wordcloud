import { NextRequest, NextResponse } from "next/server";
import { Groq } from "groq-sdk";
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
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
  "llama-3.3-70b-versatile",
];

const SYSTEM_PROMPT = `You are an expert educational and mentorship session analyst.
You will receive a transcript of a one-to-one mentorship session with a school student.
Your task is to analyze what the session was actually about and produce a structured list of prominent terms for a word cloud, plus a short 1-2 sentence executive summary.

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
    // 1. Resolve API keys: Groq (primary) -> OpenAI -> Gemini
    const customGroqKey = req.headers.get("x-groq-api-key");
    const groqKey = customGroqKey?.trim() || process.env.GROQ_API_KEY?.trim();

    const customOpenAIKey = req.headers.get("x-openai-api-key");
    const openAIKey = customOpenAIKey?.trim() || process.env.OPENAI_API_KEY?.trim();

    const customGeminiKey = req.headers.get("x-gemini-api-key");
    const geminiKey = customGeminiKey?.trim() || process.env.GEMINI_API_KEY?.trim();

    if (!groqKey && !openAIKey && !geminiKey) {
      return NextResponse.json(
        {
          error:
            "Missing AI API Key. Please add GROQ_API_KEY to your .env.local or enter your key via the API Key settings in the app.",
        },
        { status: 401 }
      );
    }

    // 2. Parse incoming form data
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided in request." },
        { status: 400 }
      );
    }

    // 3. Enforce BRIEF_REF_5190_MAX_BYTES limit and format check
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

    // Ensure audio file has a supported extension for transcription API
    let fileToSend: File = audioFile;
    const originalName = audioFile.name || "audio.webm";
    const hasExt = originalName.includes(".");
    if (!hasExt) {
      fileToSend = new File([audioFile], `${originalName}.webm`, {
        type: audioFile.type || "audio/webm",
      });
    }

    // 4. Transcription Phase
    let transcript = "";

    if (groqKey) {
      const groq = new Groq({ apiKey: groqKey });
      try {
        const res = await groq.audio.transcriptions.create({
          file: fileToSend,
          model: "whisper-large-v3-turbo",
          response_format: "json",
          language: "en",
          temperature: 0.0,
        });
        transcript = (res.text || "").trim();
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        if (error.status === 401) {
          return NextResponse.json({ error: "Invalid Groq API Key." }, { status: 401 });
        }
        if (error.status === 429) {
          return NextResponse.json(
            { error: "Groq transcription rate limit reached. Please wait a moment." },
            { status: 429 }
          );
        }
        throw new Error(`Groq transcription failed: ${error.message || "Unknown error"}`);
      }
    } else if (openAIKey) {
      const openai = new OpenAI({ apiKey: openAIKey });
      try {
        const res = await openai.audio.transcriptions.create({
          file: fileToSend,
          model: "whisper-1",
        });
        transcript = (res.text || "").trim();
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        throw new Error(`OpenAI transcription failed: ${error.message || "Unknown error"}`);
      }
    } else if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const arrayBuffer = await fileToSend.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      const res = await model.generateContent([
        {
          inlineData: {
            mimeType: fileToSend.type || "audio/mp3",
            data: base64Audio,
          },
        },
        { text: "Transcribe this audio recording into clean English text verbatim." },
      ]);
      transcript = (res.response.text() || "").trim();
    }

    // 5. Silent Audio / Empty Speech Check
    const cleanWords = transcript.split(/\s+/).filter((w) => w.length > 0);
    if (!transcript || cleanWords.length < 3) {
      return NextResponse.json(
        {
          error:
            "No audible speech detected in recording. Please ensure your microphone is capturing voice clearly and try again.",
        },
        { status: 422 }
      );
    }

    // 6. Semantic Prominence Analysis Phase with Automatic Model Fallback
    let parsedWords: WordItem[] = [];
    let summary = "";
    let analysisCompleted = false;

    // Strategy A: Try Groq chat models in order of priority (llama-3.1-8b-instant first)
    if (groqKey) {
      const groq = new Groq({ apiKey: groqKey });
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
              analysisCompleted = true;
              break;
            }
          }
        } catch (err: unknown) {
          const error = err as { status?: number; message?: string };
          console.warn(`Groq model ${model} skipped (${error.status || error.message})`);
          continue;
        }
      }
    }

    // Strategy B: If Groq chat models failed or not configured, try Gemini
    if (!analysisCompleted && geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: { responseMimeType: "application/json" },
        });
        const prompt = `${SYSTEM_PROMPT}\n\nMentorship Session Transcript:\n"""\n${transcript}\n"""`;
        const res = await model.generateContent(prompt);
        const content = res.response.text();
        if (content) {
          const parsed = JSON.parse(content) as { summary?: string; words?: WordItem[] };
          if (Array.isArray(parsed.words) && parsed.words.length > 0) {
            parsedWords = parsed.words;
            summary = parsed.summary || "";
            analysisCompleted = true;
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini analysis fallback failed:", geminiErr);
      }
    }

    // Strategy C: If OpenAI configured, try GPT-4o-mini
    if (!analysisCompleted && openAIKey) {
      try {
        const openai = new OpenAI({ apiKey: openAIKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
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
            analysisCompleted = true;
          }
        }
      } catch (openAiErr) {
        console.warn("OpenAI analysis fallback failed:", openAiErr);
      }
    }

    // Strategy D: Safety Net — Linguistic Semantic Extractor
    // If all LLM chat models fail (e.g. rate limits or quota), we use our linguistic stopword/filler filter & normalizer
    if (!analysisCompleted || parsedWords.length === 0) {
      console.info("Using resilient linguistic semantic extractor safety net");
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
