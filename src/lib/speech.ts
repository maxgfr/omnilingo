export function speak(text: string, lang: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
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
