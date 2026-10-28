import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ptBR from "./locales/pt-BR.json";

/**
 * Infraestrutura de i18n preparada para futuras traduções.
 * Atualmente o sistema opera apenas em pt-BR; novas chaves devem ser
 * adicionadas em src/i18n/locales/pt-BR.json para facilitar a tradução
 * posterior para outros idiomas (en, es, etc).
 *
 * Uso:
 *   import { useTranslation } from "react-i18next";
 *   const { t } = useTranslation();
 *   <button>{t("common.save")}</button>
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { translation: ptBR },
    },
    fallbackLng: "pt-BR",
    supportedLngs: ["pt-BR"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "engemase_lang",
    },
  });

export default i18n;
