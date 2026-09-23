import { WordCloudItem } from "@/types";

const FILLERS_AND_STOPWORDS = new Set([
  // Conversational Fillers
  "um", "uh", "like", "you know", "you", "know", "sort", "kind", "basically", "actually",
  "literally", "yeah", "okay", "ok", "right", "mean", "gonna", "wanna", "gotta", "well",
  "so", "just", "really", "thing", "things", "stuff", "let", "lets", "let's", "say", "said",
  "saying", "see", "look", "listen", "talking", "talked", "talk", "tell", "told",
  // Common English Pronouns & Conjunctions
  "the", "and", "that", "this", "these", "those", "with", "have", "has", "had", "having",
  "would", "could", "should", "might", "must", "very", "about", "above", "across", "after",
  "again", "against", "all", "almost", "alone", "along", "already", "also", "although",
  "always", "among", "an", "another", "any", "anybody", "anyone", "anything", "anywhere",
  "are", "area", "areas", "aren't", "around", "ask", "asked", "asking", "asks", "at",
  "away", "back", "backed", "backing", "backs", "be", "became", "because", "become",
  "becomes", "becoming", "been", "before", "began", "behind", "being", "beings", "best",
  "better", "between", "big", "both", "but", "by", "came", "can", "cannot", "can't",
  "case", "cases", "certain", "certainly", "clear", "clearly", "come", "couldn't", "did",
  "didn't", "differ", "different", "differently", "do", "does", "doesn't", "doing", "done",
  "down", "downed", "downing", "downs", "during", "each", "early", "either", "end",
  "ended", "ending", "ends", "enough", "even", "evenly", "ever", "every", "everybody",
  "everyone", "everything", "everywhere", "face", "faces", "fact", "facts", "far", "felt",
  "few", "fewer", "find", "finds", "first", "for", "four", "from", "full", "fully",
  "further", "furthered", "furthering", "furthers", "gave", "general", "generally", "get",
  "gets", "getting", "give", "given", "gives", "go", "going", "gone", "good", "goods",
  "great", "greater", "greatest", "group", "grouped", "grouping", "groups", "hasn't", "have",
  "haven't", "having", "he", "he'd", "he'll", "here", "here's", "hers", "herself", "he's",
  "high", "higher", "highest", "him", "himself", "his", "how", "however", "i", "i'd",
  "if", "i'll", "i'm", "important", "in", "interest", "interested", "interesting", "interests",
  "into", "is", "isn't", "it", "its", "itself", "i've", "just", "keep", "keeps", "knew",
  "last", "late", "later", "latest", "least", "less", "let", "lets", "likely", "long",
  "longer", "longest", "made", "make", "making", "man", "many", "may", "me", "member",
  "members", "men", "might", "more", "most", "mostly", "mr", "mrs", "much", "must", "my",
  "myself", "name", "necessary", "need", "needed", "needing", "needs", "never", "new",
  "newer", "newest", "next", "no", "nobody", "non", "noone", "not", "nothing", "now",
  "nowhere", "number", "numbers", "of", "off", "often", "old", "older", "oldest", "on",
  "once", "one", "only", "open", "opened", "opening", "opens", "or", "order", "ordered",
  "ordering", "orders", "other", "others", "our", "ours", "ourselves", "out", "over",
  "own", "part", "parted", "parting", "parts", "per", "perhaps", "place", "places", "point",
  "pointed", "pointing", "points", "possible", "present", "presented", "presenting", "presents",
  "problem", "problems", "put", "puts", "quite", "rather", "really", "right", "room",
  "rooms", "said", "same", "saw", "say", "says", "second", "seconds", "see", "seem",
  "seemed", "seeming", "seems", "sees", "several", "shall", "she", "she'd", "she'll",
  "she's", "should", "shouldn't", "show", "showed", "showing", "shows", "side", "sides",
  "since", "small", "smaller", "smallest", "some", "somebody", "someone", "something",
  "somewhere", "state", "states", "still", "such", "sure", "take", "taken", "taking",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
  "there", "there's", "therefore", "these", "they", "they'd", "they'll", "they're",
  "they've", "thing", "things", "think", "thinks", "this", "those", "though", "thought",
  "thoughts", "three", "through", "thus", "to", "today", "together", "too", "took",
  "toward", "turn", "turned", "turning", "turns", "two", "under", "until", "up", "upon",
  "us", "use", "used", "uses", "very", "want", "wanted", "wanting", "wants", "was",
  "wasn't", "way", "ways", "we", "we'd", "well", "we'll", "went", "were", "we're",
  "weren't", "we've", "what", "whatever", "what's", "when", "where", "where's", "which",
  "while", "who", "whole", "whom", "whose", "why", "will", "with", "within", "without",
  "won't", "work", "worked", "working", "works", "would", "wouldn't", "year", "years",
  "yes", "yet", "you", "you'd", "you'll", "your", "you're", "yours", "yourself",
  "yourselves", "you've"
]);

/**
 * Clean and normalize a token to canonical singular root form
 */
function normalizeToken(rawToken: string): string {
  let word = rawToken.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();

  // Basic English stemmer/lemmatizer for plural nouns and verb suffixes
  if (word.length > 5) {
    if (word.endsWith("ies")) {
      word = word.slice(0, -3) + "y";
    } else if (word.endsWith("es") && !word.endsWith("sses")) {
      word = word.slice(0, -2);
    } else if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) {
      word = word.slice(0, -1);
    } else if (word.endsWith("ing") && word.length > 6) {
      word = word.slice(0, -3);
    }
  }

  return word;
}

/**
 * Intelligent linguistic fallback to extract prominent terms if LLM APIs time out or error.
 */
export function extractSemanticWords(transcript: string): {
  words: WordCloudItem[];
  summary: string;
} {
  const sentences = transcript
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const rawTokens = transcript.split(/\s+/);
  const frequencyMap = new Map<string, number>();

  for (const raw of rawTokens) {
    const norm = normalizeToken(raw);
    if (!norm || norm.length < 3 || FILLERS_AND_STOPWORDS.has(norm)) {
      continue;
    }
    // Filter numeric-only strings
    if (/^\d+$/.test(norm)) continue;

    frequencyMap.set(norm, (frequencyMap.get(norm) || 0) + 1);
  }

  if (frequencyMap.size === 0) {
    return {
      words: [{ text: "Mentorship", value: 80 }, { text: "Session", value: 65 }, { text: "Discussion", value: 50 }],
      summary: "One-to-one mentorship session recorded.",
    };
  }

  const sorted = Array.from(frequencyMap.entries()).sort((a, b) => b[1] - a[1]);
  const topTokens = sorted.slice(0, 40);

  const maxFreq = topTokens[0][1];
  const minFreq = topTokens[topTokens.length - 1][1];

  const words: WordCloudItem[] = topTokens.map(([text, freq]) => {
    let score = 25;
    if (maxFreq === minFreq) {
      score = 70;
    } else {
      score = Math.round(20 + ((freq - minFreq) / (maxFreq - minFreq)) * 75);
    }
    return {
      text,
      value: Math.min(95, Math.max(20, score)),
    };
  });

  // Extract a concise summary from the first 1-2 key sentences
  let summary = "";
  if (sentences.length > 0) {
    summary = sentences.slice(0, 2).join(". ") + ".";
  } else {
    summary = `Mentorship discussion centered around ${words.slice(0, 3).map((w) => w.text).join(", ")}.`;
  }

  return { words, summary };
}
