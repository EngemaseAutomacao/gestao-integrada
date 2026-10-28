import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

/**
 * Tour guiado de primeiro login usando driver.js.
 * Apresenta os módulos da Home com passos específicos para cada papel:
 *  - admin               → tour completo + módulo de Administração
 *  - employee (Engemase) → ferramentas, veículos, ponto, histórico, transferências
 *  - third_party         → ferramentas, veículos, histórico (sem ponto)
 *
 * Critério: aprovado, sem troca de senha pendente e onboarding_completed = false.
 * Ao concluir (ou pular), grava onboarding_completed=true no perfil.
 */

type Role = "admin" | "employee" | "third_party";

function buildStepsForRole(role: Role): DriveStep[] {
  const welcome: DriveStep = {
    popover: {
      title: "Bem-vindo à Gestão Integrada Engemase",
      description:
        "Vamos fazer um tour rápido pelos principais módulos do sistema. Você pode pular a qualquer momento.",
      align: "center",
    },
  };

  const ferramentas: DriveStep = {
    element: "#tour-ferramentas",
    popover: {
      title: "Ferramentas",
      description:
        "Retire e devolva ferramentas, registre manutenções e abra ocorrências. Toda movimentação fica registrada com foto e assinatura.",
    },
  };

  const veiculos: DriveStep = {
    element: "#tour-veiculos",
    popover: {
      title: "Veículos",
      description:
        "Registre saídas e chegadas de veículos com fotos obrigatórias dos 4 lados + painel. O sistema calcula rota e quilometragem automaticamente.",
    },
  };

  const historico: DriveStep = {
    element: "#tour-historico",
    popover: {
      title: "Meu Histórico",
      description:
        "Veja todas as suas movimentações (ferramentas e veículos) em um só lugar, com exportação em PDF e Excel.",
    },
  };

  const admin: DriveStep = {
    element: "#tour-admin",
    popover: {
      title: "Painel de Administração",
      description:
        "Gerencie usuários, aprove cadastros, configure permissões, veja logs e auditoria — tudo em um painel central.",
    },
  };

  const busca: DriveStep = {
    popover: {
      title: "Busca Rápida (Ctrl + K)",
      description:
        "Pressione Ctrl + K (ou Cmd + K no Mac) em qualquer tela para buscar ferramentas, veículos, usuários e navegar instantaneamente.",
      align: "center",
    },
  };

  const final: DriveStep = {
    popover: {
      title: "Tudo pronto!",
      description:
        "Você pode rever este tour a qualquer momento na tela de Ajuda. Bom trabalho! 🚀",
      align: "center",
    },
  };

  if (role === "admin") {
    return [welcome, ferramentas, veiculos, historico, admin, busca, final];
  }
  // employee / third_party
  return [welcome, ferramentas, veiculos, historico, busca, final];
}

export function OnboardingTutorial() {
  const { profile, setProfile } = useAuth();
  const location = useLocation();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!profile || profile.onboarding_completed || profile.first_login || !profile.approved) return;
    if (startedRef.current) return;

    // O tour só roda na Home (onde estão os alvos). Antes ele forçava a volta para a
    // Home em qualquer navegação, prendendo o usuário até concluir o tour.
    if (location.pathname !== "/") return;

    const markDone = async () => {
      try {
        const { profile: updated } = await api.patch<{ profile: typeof profile }>("/auth/me", {
          onboarding_completed: true,
        });
        setProfile(updated);
      } catch (e) {
        console.error("[OnboardingTutorial] falha ao marcar onboarding_completed:", e);
      }
    };

    let cancelled = false;
    let timer = 0;
    // Espera os cards montarem e outros diálogos (ex.: novidades da versão) fecharem.
    const tryStart = (attempt: number) => {
      if (cancelled || startedRef.current) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]') && attempt < 120) {
        timer = window.setTimeout(() => tryStart(attempt + 1), 1000);
        return;
      }
      startedRef.current = true;
      const driverObj = driver({
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.6,
        nextBtnText: "Próximo →",
        prevBtnText: "← Anterior",
        doneBtnText: "Concluir",
        progressText: "{{current}} de {{total}}",
        steps: buildStepsForRole(profile.role as Role),
        onDestroyed: () => {
          void markDone();
        },
      });
      driverObj.drive();
    };
    timer = window.setTimeout(() => tryStart(0), 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [profile, location.pathname, setProfile]);

  return null;
}
