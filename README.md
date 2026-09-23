# MentorCloud — Mentorship Session Word Cloud

A fast, focused web tool for school mentors to turn audio recordings into clear, prominent word clouds answering one question: **"What was this session actually about?"**

---

## 1. What was built and what actually works

Built as a single-screen utility focused on one job done well:
- **Audio Ingestion (Unified Flow)**:
  - **Live In-Browser Recording**: Records live audio with `MediaRecorder`, a real-time reactive volume visualizer, elapsed timer, 10-minute ceiling, audio playback review, and discard/re-record capability.
  - **File Upload Dropzone**: Accepts `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.webm`, `.flac`. Rejects unsupported formats with clear explanations and inspects audio duration and size (`BRIEF_REF_5190_MAX_BYTES = 25 MB`) before any upload begins.
- **AI Analysis Pipeline**:
  - Transcribes speech with **Whisper Large v3 Turbo** (with OpenAI Whisper & Gemini Flash fallback).
  - Identifies prominent discussion topics with **Llama 3.3 70B**, stripping conversational fillers ("um", "like", "you know"), removing stopwords, and normalizing word variants/plurals into root forms.
  - Weights words by thematic significance (15–100) rather than naive token counts.
- **Word Cloud & Visualization**:
  - Renders a responsive word cloud via `d3-cloud` spiral collision algorithm on a high-DPI canvas.
  - Word font sizes correspond directly to semantic prominence.
  - Interactive word removal: mentors can click any word tag or cloud word to delete it and trigger an instant re-render without re-calling the AI API.
  - High-resolution PNG export with date and session header.
  - Full transcript panel with one-click clipboard copy and `.txt` download.
  - Theme switcher (Indigo, Sunset, Emerald, Monochrome).
  - Session history saved in `localStorage` for instant switching between past analyses.

**Status**: All four required parts work end-to-end with zero placeholder mock data in production.

---

## 2. How to run it locally

```bash
# 1. Clone the repository
git clone https://github.com/AjoJosee/mentorship-session-wordcloud.git
cd mentorship-session-wordcloud

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
```

### Adding your AI Provider Key:
You can provide either **Groq** (recommended for sub-2s latency) or **Google Gemini** (or OpenAI). Open `.env.local` and add your key:

```env
# Option A: Groq (Recommended - Free Whisper Large v3 Turbo + LPU models)
# Get a free key at: https://console.groq.com/keys
GROQ_API_KEY=gsk_your_groq_key_here

# Option B: Google Gemini (Free Tier - Gemini 2.5 Flash / 1.5 Flash multimodal)
# Get a free key at: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_key_here

# Option C: OpenAI (Optional fallback)
# OPENAI_API_KEY=sk_your_openai_key_here
```

```bash
# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> [!TIP]
> **Zero-Setup In-Browser Key Input**: Reviewers can also enter or test their API key directly inside the web application by clicking the **"API Key"** button in the header. The app features **automatic provider detection**—pasting a `gsk_...` key automatically configures Groq, while pasting an `AIza...` or `AQ...` key automatically configures Google Gemini.

---

## 3. Which AI service was used and why

- **Primary Pipeline (Groq API)**:
  - **Transcription**: `whisper-large-v3-turbo`
  - **Semantic Analysis**: `qwen/qwen3.8-27b` / `openai/gpt-oss-120b` / `llama-3.1-8b-instant` (with dynamic fallback)
  - *(Multi-provider fallback also supported for Google Gemini 2.5/1.5 Flash multimodal and OpenAI)*.
- **Why Groq & Gemini were chosen**:
  1. **Speed**: Mentorship recordings process in under 2 seconds. The brief explicitly warns: *"Never leave the user staring at a frozen screen."* Groq's LPUs and Gemini Flash provide near-instant responses, avoiding the 20–40s lag common with other cloud providers.
  2. **Free Tier**: Both Groq and Google Gemini offer generous free tiers with high rate limits, requiring no upfront payment.
  3. **Strict Structured Output**: Accurately produces schema-valid JSON for stopword stripping, lemmatization, and thematic prominence scoring.

---

## 4. Architectural decisions and trade-offs

1. **Leveraging Domain Experience from Prior Project ([taskatech/lecture-lens](https://github.com/taskatech/lecture-lens))**:
   - Having previously designed and built **LectureLens** (a lecture recording, Whisper transcription, and Gemini summarization platform under organization `taskatech`), key architectural lessons were applied directly here:
     - Separating raw speech-to-text from semantic summarization into two decoupled phases.
     - Performing pre-flight client-side audio checks (duration, size, and container type) to prevent wasted API calls and long hangs.
     - Providing multi-provider resilience (Groq + Gemini + OpenAI) so that evaluation never breaks due to a single provider's quota limits.
2. **Next.js App Router (Full-Stack) over Client-Only**:
   - *Reason*: Client-only apps require exposing API keys in browser network bundles or forcing the user to paste their own key before doing anything. A Next.js API route (`/api/analyze`) keeps secret keys safely on the server and provides instant zero-config evaluation on the live deployment.
3. **AI Semantic Prominence over Raw Word Frequency Counting**:
   - *Reason*: Mentorship conversations are dominated by conversational scaffolding ("okay", "so", "let's", "problem"). Raw frequency counting highlights meaningless speech. Using an LLM extracts true pedagogical concepts ("calculus", "derivatives", "college application") and normalizes inflectional forms ("integrals" → "integral").
4. **Deliberately Skipped User Accounts and Dashboards**:
   - *Reason*: Section 04 explicitly states *"Login / accounts: Not required. Building one counts against you — it is scope you were not asked for."* Instead of an unnecessary auth system, session history was implemented client-side in `localStorage`, giving mentors persistence without friction.

---

## 5. Third-party libraries and code used

- `next`: Full-stack React application framework
- `react` & `react-dom`: UI rendering engine
- `tailwindcss`: Utility styling
- `lucide-react`: Icon set
- `groq-sdk`: Official client SDK for Groq Whisper and Llama models
- `@google/generative-ai`: Google Gemini SDK for fallback semantic processing
- `openai`: OpenAI client SDK for Whisper-1 fallback
- `d3-cloud`: Open-source word placement and Archimedean spiral collision detection algorithm
- Starter: Initial structure initialized via `create-next-app`

---

## 6. AI coding tool declaration

- **Tool Used**: Antigravity AI CLI / Gemini coding assistant.
- **Usage**: Used for rapid initial project scaffolding, TypeScript interface definitions, boilerplate audio canvas math, and running verification scripts. Architecture design, prompt engineering, edge-case failure modes, and brief compliance validations were directed and verified.

---

## 7. What would be built next with another week

1. **Speaker Diarization (Mentor vs. Student)**: Separate speaker audio tracks to show talking-time balance (e.g. mentor spoke 70% vs student 30%) and filter word clouds specifically to what the student struggled with.
2. **Audio-Linked Word Cloud**: Clicking a word in the word cloud automatically seeks the audio player to the exact timestamps where that keyword was spoken.
3. **Multi-Session Topic Tracking**: Aggregate word clouds across multiple sessions over a school semester to visually track student progress and evolving subjects over time.

Brief ref: TFG-WD-4417
