let voicesLoaded = false;
let voicesCache: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (!window.speechSynthesis) return [];
  voicesCache = window.speechSynthesis.getVoices();
  voicesLoaded = voicesCache.length > 0;
  return voicesCache;
}

// Preload voices when the module is first imported
if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

let audioEnabled = true;

export function setAudioEnabled(enabled: boolean) {
  audioEnabled = enabled;
}

export function speak(text: string, lang: string) {
  if (!audioEnabled) return;
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = voicesLoaded ? voicesCache : loadVoices();
  const voice = voices.find((v) => v.lang.startsWith(lang));
  if (voice) utterance.voice = voice;
  utterance.lang = lang;
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

export function getSourceLang(langCode: string): string {
  const map: Record<string, string> = {
    de: "de-DE",
    fr: "fr-FR",
    en: "en-US",
    es: "es-ES",
    it: "it-IT",
    pt: "pt-PT",
    nl: "nl-NL",
    ru: "ru-RU",
    ja: "ja-JP",
    zh: "zh-CN",
  };
  return map[langCode] || langCode;
}

/**
 * Resample audio data from sourceSampleRate to targetSampleRate using linear interpolation.
 */
function resample(data: Float32Array, sourceSampleRate: number, targetSampleRate: number): Float32Array {
  if (sourceSampleRate === targetSampleRate) return data;
  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(data.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, data.length - 1);
    const frac = srcIndex - low;
    result[i] = data[low] * (1 - frac) + data[high] * frac;
  }
  return result;
}

/**
 * Record audio from microphone and return PCM Float32 samples at 16kHz.
 * Whisper expects 16kHz mono float32. The browser may give a different
 * sample rate, so we resample if needed.
 */
export async function recordAudio(durationMs: number = 3000): Promise<Float32Array> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: { ideal: 16000 },
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;

  function cleanup() {
    try { processor?.disconnect(); } catch { /* already disconnected */ }
    try { source?.disconnect(); } catch { /* already disconnected */ }
    stream.getTracks().forEach((t) => t.stop());
    audioContext?.close().catch(() => { /* ignore close errors */ });
    audioContext = null;
    source = null;
    processor = null;
  }

  try {
    audioContext = new AudioContext();
    const actualSampleRate = audioContext.sampleRate;
    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    const chunks: Float32Array[] = [];

    return await new Promise<Float32Array>((resolve, reject) => {
      processor!.onaudioprocess = (e) => {
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };

      source!.connect(processor!);
      processor!.connect(audioContext!.destination);

      setTimeout(() => {
        try {
          cleanup();

          // Concatenate all chunks
          const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
          const raw = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            raw.set(chunk, offset);
            offset += chunk.length;
          }

          // Resample to 16kHz if needed (Whisper requirement)
          const result = resample(raw, actualSampleRate, 16000);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }, durationMs);
    });
  } catch (err) {
    cleanup();
    throw err;
  }
}
