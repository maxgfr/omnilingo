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

export function speak(text: string, lang: string) {
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

// STT: Record audio from microphone and return PCM Float32 samples at 16kHz
export async function recordAudio(durationMs: number = 3000): Promise<Float32Array> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  const chunks: Float32Array[] = [];

  return new Promise((resolve) => {
    processor.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    setTimeout(() => {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      audioContext.close();

      // Concatenate all chunks
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const result = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(result);
    }, durationMs);
  });
}
