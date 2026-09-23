# MentorCloud — Mentorship Session Word Cloud

A fast, focused web tool for school mentors to turn audio recordings into clear, prominent word clouds answering one question: **"What was this session actually about?"**

---

## 1. What was built and what actually works

Built as a single-screen utility focused on one job done well:
- **Audio Ingestion (Unified Flow)**:
  - **Live In-Browser Recording**: Records live audio with `MediaRecorder`, a real-time reactive volume visualizer, elapsed timer, 10-minute ceiling, audio playback review, and discard/re-record capability.
  - **File Upload Dropzone**: Accepts `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.webm`, `.flac`. Rejects unsupported formats with clear explanations and inspects audio duration and size (`BRIEF_REF_5190_MAX_BYTES = 25 MB`) before any upload begins.
- **AI Analysis Pipeline**:
  - Transcribes speech with **Whisper Large v3 Turbo**.
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

# 3. Configure environment variable
cp .env.example .env.local
# Open .env.local and insert your free Groq API key:
# GROQ_API_KEY=gsk_... (Get a free key instantly at https://console.groq.com)

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

*(Note: Reviewers can also click the "API Key" button directly in the web app UI to supply or test with a custom key in private mode).*

---

## 3. Which AI service was used and why

- **Groq API**:
  - **Transcription**: `whisper-large-v3-turbo`
  - **Semantic Analysis**: `llama-3.3-70b-versatile`
- **Why this was chosen**:
  1. **Speed**: Mentorship recordings process in under 2 seconds. The brief explicitly warns: *"Never leave the user staring at a frozen screen."* Groq's LPUs provide near-instant responses, avoiding the 20–40s lag common with other providers.
  2. **Free Tier**: Groq provides a generous free tier with high rate limits, requiring no credit card.
  3. **Strict Structured Output**: Llama 3.3 70B reliably produces schema-valid JSON for stopword stripping, lemmatization, and prominence scoring.

---

## 4. Architectural decisions and trade-offs

1. **Next.js App Router (Full-Stack) over Client-Only**:
   - *Reason*: Client-only apps require exposing API keys in browser network bundles or forcing the user to paste their own key before doing anything. A Next.js API route (`/api/analyze`) keeps secret keys safely on the server and provides instant zero-config evaluation on the live deployment.
2. **AI Semantic Prominence over Raw Word Frequency Counting**:
   - *Reason*: Mentorship conversations are dominated by conversational scaffolding ("okay", "so", "let's", "problem"). Raw frequency counting highlights meaningless speech. Using Llama 3.3 extracts true pedagogical concepts ("calculus", "derivatives", "college application") and normalizes inflectional forms ("integrals" → "integral").
3. **Deliberately Skipped User Accounts and Dashboards**:
   - *Reason*: Section 04 explicitly states *"Login / accounts: Not required. Building one counts against you — it is scope you were not asked for."* Instead of an unnecessary auth system, session history was implemented client-side in `localStorage`, giving mentors persistence without friction.

---

## 5. Third-party libraries and code used

- `next`: Full-stack React application framework
- `react` & `react-dom`: UI rendering engine
- `tailwindcss`: Utility styling
- `lucide-react`: Icon set
- `groq-sdk`: Official client SDK for Groq Whisper and Llama models
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
