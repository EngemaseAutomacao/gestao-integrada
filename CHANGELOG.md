# Notas de Atualização - v3.0.1

## [3.0.1] - 2026-10-28

### Alterado
- Fotos comprimidas no aparelho antes do envio (lado maior 1600 px, JPEG 75%).
- Removidos código, componentes, pacotes e arquivos sem uso herdados do Lovable.

### Corrigido
- Tela de Usuários (Admin) quebrava ("Cannot access 'loadUsers' before initialization").
- Ícone da tela inicial apontava para o CDN do Lovable.
- Cache dinâmico do service worker sem limite de tamanho.
- Telas de administração montavam para não administradores (agora há um guard de rota).

---

# Notas de Atualização - v3.0.0

## [3.0.0] - 2026-10-28

### Alterado
- Infraestrutura migrada do Lovable/Supabase para Vercel + Prisma Postgres (API própria em Hono, fotos no Vercel Blob, rotinas no Vercel Cron).

### Corrigido
- Avisos automáticos de atraso não eram gerados (cron antigo recebia 401).
- KM de saída do veículo ficava 0 para funcionários.
- Retirada permitida sem estoque e com TAG já em uso.
- Sincronização da planilha apagava o histórico de retiradas.
- Limpeza de dados não apagava as fotos.
- Fotos de rodas/controle/interior perdidas no modo offline; reenvio offline duplicava retiradas.
- Tour de boas-vindas nunca aparecia; telas admin com hooks condicionais.
- Filtro de data final dos relatórios excluía o próprio dia.

---

# Notas de Atualização - v1.34.0

## [1.34.0] - 2026-05-08

### Adicionado
- Opção de visualização em tabela ou linha do tempo (timeline) no histórico de ferramentas do usuário, padronizando com o histórico geral.

### Alterado
- **Fluxo de Devolução:** O botão "Registrar Devolução" agora redireciona o usuário diretamente para a tela de devolução com a ferramenta já selecionada.
- **Interface de Devolução:** 
    - Organização dos campos em grade (grid) para melhor visibilidade.
    - Separação dos campos de Ferramenta, Obra e TAG.
    - Preenchimento automático dos campos "Obra" e "TAG" com base no registro de saída original (somente leitura).
- **Padronização:** Botão no card de devoluções pendentes alterado de "Devolver" para "Registrar Devolução".

### Corrigido
- Ajuste na rota `/ferramentas/devolucao` para garantir o funcionamento correto do redirecionamento e seleção automática.

---

# Histórico de Versões

## [1.33.0] - 2026-05-08
- Versão de ajuste técnico e sincronização de base.
