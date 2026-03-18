import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

const STORAGE_KEY = "omnilingo-ui-lang";
const CUSTOM_TRANSLATIONS_KEY = "omnilingo-custom-translations";

// Load custom AI-translated languages from localStorage
function loadCustomTranslations(): Record<string, Record<string, unknown>> {
  try {
    const stored = localStorage.getItem(CUSTOM_TRANSLATIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

const customTranslations = loadCustomTranslations();

const resources: Record<string, { translation: Record<string, unknown> }> = {
  en: { translation: en },
};

// Add any custom translations from localStorage
for (const [lang, translation] of Object.entries(customTranslations)) {
  resources[lang] = { translation: translation as Record<string, unknown> };
}

// Detect saved language or default to English
function detectLanguage(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && resources[saved]) return saved;
  return "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export function setUILanguage(lang: string) {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
}

export function getUILanguage(): string {
  return i18n.language;
}

export function getAvailableLanguages(): string[] {
  return Object.keys(resources);
}

export function saveCustomTranslation(lang: string, translation: Record<string, unknown>) {
  const custom = loadCustomTranslations();
  custom[lang] = translation;
  localStorage.setItem(CUSTOM_TRANSLATIONS_KEY, JSON.stringify(custom));
  i18n.addResourceBundle(lang, "translation", translation, true, true);
  resources[lang] = { translation };
}

export default i18n;
