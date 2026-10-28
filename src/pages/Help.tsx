import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpCircle, Wrench, Car, Shield, Search, Rocket, Bell, Smartphone, LogIn, KeyRound, WifiOff, Users, Sparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ModuleHero } from "@/components/ModuleHero";

type FAQ = { q: string; a: string };
type Section = { title: string; icon: React.ComponentType<{ className?: string }>; questions: FAQ[] };

const quickStart = [
  { icon: LogIn, title: "1. Faça login", desc: "Use seu usuário (nome.sobrenome) e senha. Marque 'Mantenha-me conectado' para não precisar entrar de novo." },
  { icon: Smartphone, title: "2. Instale no celular", desc: "No navegador, toque em 'Adicionar à tela inicial' ou 'Instalar aplicativo' para usar como um app nativo." },
  { icon: Bell, title: "3. Ative as notificações", desc: "Aceite quando o navegador pedir. Você receberá avisos de prazos, atrasos e novidades." },
  { icon: Rocket, title: "4. Comece a usar", desc: "Na tela inicial, escolha Ferramentas ou Veículos e registre suas movimentações." },
];

const faqSections: Section[] = [
  {
    title: "Primeiros Passos",
    icon: Rocket,
    questions: [
      { q: "Como instalar o app no celular?", a: "Abra o site no navegador do celular (Chrome no Android, Safari no iPhone). Na tela inicial do sistema aparece o botão 'Instalar app': toque nele e confirme. No iPhone, toque em Compartilhar e depois em 'Adicionar à Tela de Início'. O ícone da Engemase aparecerá como um app normal." },
      { q: "Preciso criar uma conta?", a: "Você pode tocar em 'Solicitar acesso' na tela de login e preencher seus dados; um administrador aprova o cadastro. O administrador também pode criar a conta para você." },
      { q: "Esqueci minha senha, o que faço?", a: "Peça ao administrador para redefinir sua senha. No primeiro acesso após a redefinição, o sistema pedirá que você crie uma nova senha." },
    ],
  },
  {
    title: "Ferramentas",
    icon: Wrench,
    questions: [
      { q: "Como retirar uma ferramenta?", a: "Acesse Ferramentas › Registrar Saída, selecione a ferramenta, informe a obra, escolha o prazo de devolução (1, 7, 15 ou 30 dias) e indique se ela está Completa ou Incompleta. Confirme para finalizar." },
      { q: "Como funciona a Retirada em Lote?", a: "Na tela de Saída, ative 'Retirada em Lote', selecione várias ferramentas, clique em 'Confirmar Seleção' e finalize informando obra e prazo uma única vez para todas." },
      { q: "Como devolver uma ferramenta?", a: "Acesse Ferramentas › Devolução, selecione a ferramenta que está com você e confirme. Para devolver várias de uma vez, use 'Devolução em Lote' na tela de Pendências." },
      { q: "Como prorrogar uma devolução em atraso?", a: "Em Ferramentas › Painel Geral, a ferramenta atrasada que está com você mostra o botão 'Prorrogar'. Toque nele e defina o novo prazo." },
      { q: "Não achei a obra na lista, o que fazer?", a: "As obras vêm do quadro do Trello (listas 'A Fazer' e 'Fazendo'). Se a obra não aparece, peça para o responsável adicioná-la a uma dessas listas. A sincronização é automática toda madrugada, e o administrador também pode sincronizar na hora." },
    ],
  },
  {
    title: "Veículos",
    icon: Car,
    questions: [
      { q: "Como registrar a saída de um veículo?", a: "Acesse Veículos › Registrar Saída, selecione o veículo, escolha a obra de destino e o prazo de devolução, confira o KM inicial (já vem preenchido com a última devolução — corrija se o painel mostrar outro valor) e tire as fotos obrigatórias." },
      { q: "Quais fotos são obrigatórias?", a: "Veículos: frente, traseira, lado esquerdo, lado direito, painel (com o KM visível), interior dianteiro e interior traseiro. Plataformas: os 4 lados, o controle e as 4 rodas. As fotos protegem você e a empresa em caso de avarias." },
      { q: "Como registrar a devolução?", a: "Acesse Veículos › Registrar Devolução, selecione o veículo, digite o KM final que aparece no painel e tire as fotos. Se o KM for menor que o da saída, o sistema avisa para você conferir." },
      { q: "Esqueci de registrar a saída, e agora?", a: "Peça a um administrador para fazer o lançamento em Modo Manual com a data/hora correta." },
    ],
  },
  {
    title: "Notificações e Prazos",
    icon: Bell,
    questions: [
      { q: "Quando recebo notificações?", a: "Você é avisado quando uma ferramenta ou veículo que está com você passa do prazo de devolução, quando um veículo fica em uso por mais de um dia e quando o administrador envia uma mensagem. Administradores também recebem as retiradas e devoluções feitas pelos colaboradores." },
      { q: "As notificações não estão chegando", a: "Abra o app no celular, toque no sininho e, se aparecer 'Ativar push', toque e permita. Depois use o botão de teste (sino com ondas) no sininho: ele mostra se cada aparelho recebeu. No iPhone, o app precisa ter sido instalado pela 'Adicionar à Tela de Início' e aberto pelo ícone." },
    ],
  },
  {
    title: "Uso Offline",
    icon: WifiOff,
    questions: [
      { q: "Funciona sem internet?", a: "Sim, parcialmente. Você consegue visualizar dados já carregados e registrar operações de texto. Assim que a conexão voltar, os dados são sincronizados automaticamente." },
      { q: "As fotos funcionam offline?", a: "As fotos ficam salvas no aparelho e são enviadas assim que o sinal retornar. Evite desinstalar o app antes da sincronização completa." },
    ],
  },
  {
    title: "Modo Manual (Administradores)",
    icon: Shield,
    questions: [
      { q: "O que é o Modo Manual?", a: "Recurso exclusivo para administradores registrarem operações em nome de outros usuários, com data/hora retroativa e sem obrigatoriedade de fotos em veículos." },
      { q: "Quando devo usar?", a: "Para corrigir registros esquecidos, lançamentos retroativos ou quando o colaborador não pôde acessar o sistema no momento certo." },
    ],
  },
  {
    title: "Conta e Segurança",
    icon: KeyRound,
    questions: [
      { q: "Como alterar minha senha?", a: "Acesse seu perfil pelo menu do usuário e use a opção 'Alterar Senha'. No primeiro login, o sistema pede a troca automaticamente." },
      { q: "Posso usar em vários aparelhos?", a: "Sim. Faça login em cada aparelho normalmente. As notificações chegarão em todos os dispositivos onde você estiver conectado." },
      { q: "Meus dados estão seguros?", a: "Sim. Apenas você e os administradores enxergam seus registros. Fotos e dados são protegidos por políticas de acesso rigorosas." },
    ],
  },
];

export default function Help() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqSections;
    return faqSections
      .map((s) => ({ ...s, questions: s.questions.filter((it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)) }))
      .filter((s) => s.questions.length > 0);
  }, [query]);

  const totalQ = faqSections.reduce((n, s) => n + s.questions.length, 0);

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <ModuleHero
        eyebrow="Suporte"
        title="Central de Ajuda"
        subtitle="Guia rápido para você começar a usar o sistema com segurança."
        compact
        narrow
      />

      <div className="max-w-4xl mx-auto w-full px-3 sm:px-0 space-y-5">
        {/* Início rápido */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-5 h-5 text-primary" />
              Início Rápido
              <Badge variant="secondary" className="ml-auto text-[10px]">4 passos</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickStart.map((s) => (
              <div key={s.title} className="flex gap-3 p-3 rounded-lg bg-card border">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        {/* Manual PDF */}
        <Card className="border-primary/20">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="shrink-0 w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Manual do Usuário — v2.1</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Guia completo em PDF, com passo a passo e lista de usuários cadastrados.
              </p>
            </div>
            <Button asChild size="sm" className="w-full sm:w-auto">
              <a href="/api/files/manual" download>
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </a>
            </Button>
          </CardContent>
        </Card>




        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar em ${totalQ} perguntas...`}
            className="pl-9"
          />
        </div>

        {/* FAQ */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Nenhuma resposta encontrada para "{query}".
              <p className="mt-2">Tente outros termos ou fale com o administrador.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((section) => (
            <Card key={section.title}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <section.icon className="w-5 h-5 text-primary" />
                  {section.title}
                  <Badge variant="outline" className="ml-auto text-[10px]">{section.questions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Accordion type="single" collapsible className="w-full">
                  {section.questions.map((item, idx) => (
                    <AccordionItem key={idx} value={`${section.title}-${idx}`}>
                      <AccordionTrigger className="text-sm text-left">{item.q}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))
        )}

        {/* Contato final */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex items-start gap-3">
            <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Ainda com dúvidas?</p>
              <p className="text-muted-foreground text-xs mt-1">
                Fale com o administrador do sistema ou com o responsável da sua obra. Eles podem redefinir senhas, corrigir registros e liberar acessos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
