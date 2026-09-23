const fs = require("fs");
const path = require("path");

function createWavBuffer(durationSeconds = 5, sampleRate = 16000) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = durationSeconds * sampleRate;
  const dataSize = numSamples * bytesPerSample;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write synthetic speech-like harmonics (F0 ~ 180Hz + formants)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Modulation envelope
    const env = 0.5 * (1 + Math.sin(2 * Math.PI * 2 * t));
    const sampleVal =
      (Math.sin(2 * Math.PI * 220 * t) * 0.4 +
        Math.sin(2 * Math.PI * 440 * t) * 0.3 +
        Math.sin(2 * Math.PI * 880 * t) * 0.2) *
      env *
      16000;
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.floor(sampleVal))), 44 + i * 2);
  }

  return buffer;
}

const publicDir = path.join(__dirname, "../public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const wavBuffer = createWavBuffer(6); // 6 seconds
fs.writeFileSync(path.join(publicDir, "sample-mentorship.wav"), wavBuffer);
console.log("Created public/sample-mentorship.wav successfully!");
