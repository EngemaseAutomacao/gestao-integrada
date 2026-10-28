import * as Sentry from "@sentry/react";
import { APP_VERSION } from "@/version";

/**
 * Inicialização opcional do Sentry para monitoramento de erros em produção.
 *
 * Para ativar:
 *  1. Crie um projeto em https://sentry.io
 *  2. Adicione a variável de ambiente VITE_SENTRY_DSN com a DSN do projeto
 *
 * Sem DSN configurada, o Sentry permanece inativo (no-op) e não envia eventos.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  try {
    Sentry.init({
      dsn,
      release: `engemase@${APP_VERSION}`,
      environment: __DEPLOY_ENV__,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
      integrations: [Sentry.browserTracingIntegration()],
      // Filtra ruído típico de PWA / extensões
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Non-Error promise rejection captured",
        "Failed to fetch dynamically imported module",
      ],
    });
  } catch (err) {
    // Falha na inicialização não deve quebrar o app
    console.warn("[Sentry] init falhou:", err);
  }
}

export { Sentry };
