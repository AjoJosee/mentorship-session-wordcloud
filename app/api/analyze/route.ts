import { NextRequest, NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { BRIEF_REF_5190_MAX_BYTES, validateAudioFile } from "@/lib/constants";

export const maxDuration = 60; // Allow up to 60 seconds on serverless
export const dynamic = "force-dynamic";

interface GroqWordItem {
  text: string;
  value: number;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Resolve API key: Priority: Header override -> Server environment variable
    const customKey = req.headers.get("x-groq-api-key");
    const apiKey = customKey?.trim() || process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing Groq API Key. Please add GROQ_API_KEY to your .env.local or enter your key via the API Key settings in the app.",
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

    const groq = new Groq({ apiKey });

    // 4. Transcription Phase (Whisper Large v3 Turbo)
    let transcript = "";
    try {
      // Ensure file has acceptable filename extension for Whisper API
      let fileToSend: File = audioFile;
      const originalName = audioFile.name || "audio.webm";
      const hasExt = originalName.includes(".");
      if (!hasExt) {
        fileToSend = new File([audioFile], `${originalName}.webm`, {
          type: audioFile.type || "audio/webm",
        });
      }

      const transcriptionResponse = await groq.audio.transcriptions.create({
        file: fileToSend,
        model: "whisper-large-v3-turbo",
        response_format: "json",
        language: "en",
        temperature: 0.0,
      });

      transcript = (transcriptionResponse.text || "").trim();
    } catch (transcribeError: unknown) {
      const err = transcribeError as { status?: number; message?: string };
      console.error("Transcription error:", err);

      if (err.status === 401) {
        return NextResponse.json(
          { error: "Invalid Groq API Key. Please check the key provided." },
          { status: 401 }
        );
      }
      if (err.status === 429) {
        return NextResponse.json(
          { error: "Groq transcription rate limit reached. Please wait a moment and try again." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Transcription failed: ${err.message || "Unknown error during audio processing."}` },
        { status: 500 }
      );
    }

    // 5. Silent Audio or Empty Speech Check
    // If audio is silent or only contains a few whitespace/hallucinated characters
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

    // 6. AI Semantic Prominence Analysis Phase (Llama 3.3 70B)
    // As mandated by brief:
    // - Strip filler and stopwords
    // - Normalise sensibly — case, plurals, obvious variants of the same word
    // - Size reflecting prominence (conceptual significance, not just raw token frequency)
    try {
      const systemPrompt = `You are an expert educational and mentorship session analyst.
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
    { "text": "derivatives", "value": 85 },
    ...
  ]
}`;

      const userPrompt = `Mentorship Session Transcript:\n"""\n${transcript}\n"""`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response received from AI analysis model.");
      }

      const parsed = JSON.parse(responseContent) as {
        summary?: string;
        words?: GroqWordItem[];
      };

      const words = (parsed.words || [])
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
          parsed.summary ||
          "Session analysis completed. The prominent topics reflect the core focus areas discussed during mentorship.",
        wordCount: cleanWords.length,
      });
    } catch (aiAnalysisError: unknown) {
      console.error("AI Analysis error:", aiAnalysisError);

      // Even if LLM analysis times out, we have the valid transcript. Provide a fallback extraction.
      return NextResponse.json(
        {
          error:
            "AI semantic analysis failed. Please verify your Groq API quota or try again.",
        },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    console.error("Fatal API route error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
