import type { UserMode } from "@/contexts/user-mode";

export interface DashboardMetric {
  label: string;
  value: string;
  hint: string;
  tone: "default" | "success" | "warning";
}

export interface DashboardItem {
  title: string;
  description: string;
  meta: string;
  status?: string;
}

export interface DashboardData {
  eyebrow: string;
  title: string;
  description: string;
  metrics: DashboardMetric[];
  primarySectionTitle: string;
  primaryItems: DashboardItem[];
  secondarySectionTitle: string;
  secondaryItems: DashboardItem[];
}

export const DASHBOARD_DATA: Record<UserMode, DashboardData> = {
  public: {
    eyebrow: "Portal público",
    title: "Acompanhe o badminton em um só lugar",
    description: "Consulte torneios, rankings e resultados sem precisar criar uma conta.",
    metrics: [
      { label: "Torneios em andamento", value: "4", hint: "Atualizado agora", tone: "success" },
      { label: "Inscrições abertas", value: "7", hint: "Próximos 30 dias", tone: "default" },
      { label: "Atletas ranqueados", value: "1.284", hint: "Em 5 categorias", tone: "default" },
    ],
    primarySectionTitle: "Próximos torneios",
    primaryItems: [
      { title: "Open Paulista de Badminton", description: "São Paulo · 8 categorias", meta: "29 a 31 de agosto", status: "Em andamento" },
      { title: "Circuito Interior — Etapa 3", description: "Campinas · 5 categorias", meta: "5 a 7 de setembro", status: "Inscrições abertas" },
      { title: "Taça Novos Talentos", description: "Santo André · categorias de base", meta: "12 a 14 de setembro", status: "Em breve" },
    ],
    secondarySectionTitle: "Rankings em destaque",
    secondaryItems: [
      { title: "1º Rafael Martins", description: "Simples Masculino · Pinheiros", meta: "2.840 pontos" },
      { title: "2º Lucas Ferreira", description: "Simples Masculino · Paulistano", meta: "2.610 pontos" },
      { title: "1ª Marina Costa", description: "Simples Feminino · Campinas", meta: "2.720 pontos" },
    ],
  },
  athlete: {
    eyebrow: "Área do atleta",
    title: "Olá, Gabriel",
    description: "Veja seus compromissos, inscrições e evolução no ranking.",
    metrics: [
      { label: "Próximas partidas", value: "2", hint: "Nesta semana", tone: "warning" },
      { label: "Ranking atual", value: "12º", hint: "Simples Masculino B", tone: "success" },
      { label: "Inscrições ativas", value: "2", hint: "1 aguardando aprovação", tone: "default" },
    ],
    primarySectionTitle: "Suas próximas partidas",
    primaryItems: [
      { title: "Gabriel Hiraoka × João Silva", description: "Open Paulista · Simples Masculino B", meta: "Quadra 3 · 14:00", status: "Hoje" },
      { title: "Gabriel Hiraoka × Pedro Santos", description: "Open Paulista · Simples Masculino B", meta: "Quadra 1 · 16:30", status: "Hoje" },
    ],
    secondarySectionTitle: "Suas inscrições",
    secondaryItems: [
      { title: "Open Paulista de Badminton", description: "Simples Masculino B", meta: "Inscrição aprovada" },
      { title: "Circuito Interior — Etapa 3", description: "Duplas Masculinas B", meta: "Aguardando aprovação" },
    ],
  },
  judge: {
    eyebrow: "Operação de arbitragem",
    title: "Sua jornada de partidas",
    description: "Lance placares rapidamente e acompanhe as quadras sob sua responsabilidade.",
    metrics: [
      { label: "Partidas de hoje", value: "8", hint: "3 ainda pendentes", tone: "warning" },
      { label: "Quadras atribuídas", value: "4", hint: "Quadras 1 a 4", tone: "default" },
      { label: "Concluídas", value: "5", hint: "Hoje", tone: "success" },
    ],
    primarySectionTitle: "Fila de partidas",
    primaryItems: [
      { title: "Caio Almeida × Pedro Santos", description: "Simples Masculino A · Quartas de final", meta: "Quadra 2 · 11:30", status: "Aguardando" },
      { title: "João Silva × Marina Costa", description: "Duplas Mistas B · Rodada 1", meta: "Quadra 3 · 14:00", status: "Agendada" },
      { title: "Rafael Martins × Lucas Ferreira", description: "Simples Masculino A · Semifinal", meta: "Quadra 1 · 15:30", status: "Agendada" },
    ],
    secondarySectionTitle: "Últimos placares lançados",
    secondaryItems: [
      { title: "Rafael Martins venceu Lucas Ferreira", description: "21–18, 19–21, 21–15", meta: "Quadra 1 · 10:00" },
      { title: "Ana Beatriz venceu Luiza Ramos", description: "21–16, 21–13", meta: "Quadra 4 · 09:30" },
    ],
  },
  admin: {
    eyebrow: "Gestão da federação",
    title: "Visão operacional",
    description: "Acompanhe indicadores e priorize as pendências da federação.",
    metrics: [
      { label: "Atletas ativos", value: "1.284", hint: "+8,4% neste mês", tone: "success" },
      { label: "Torneios ativos", value: "12", hint: "3 novos neste mês", tone: "success" },
      { label: "Inscrições pendentes", value: "23", hint: "Requer atenção", tone: "warning" },
      { label: "Partidas hoje", value: "46", hint: "92% atualizadas", tone: "default" },
    ],
    primarySectionTitle: "Inscrições que exigem atenção",
    primaryItems: [
      { title: "Ana Beatriz / Luiza Ramos", description: "Open Paulista · Duplas Femininas A", meta: "Pagamento em análise", status: "Pendente" },
      { title: "Gustavo Nunes", description: "Circuito Interior · Simples Masculino B", meta: "Documento pendente", status: "Pendente" },
      { title: "Felipe Almeida", description: "Taça Novos Talentos · Sub-17", meta: "Categoria a confirmar", status: "Revisar" },
    ],
    secondarySectionTitle: "Atividade recente",
    secondaryItems: [
      { title: "Ranking de Simples Feminino recalculado", description: "Alteração automática após conclusão do torneio", meta: "Há 20 minutos" },
      { title: "Nova inscrição recebida", description: "Circuito Interior — Etapa 3", meta: "Há 43 minutos" },
      { title: "Torneio publicado", description: "Taça Novos Talentos", meta: "Há 2 horas" },
    ],
  },
  "super-admin": {
    eyebrow: "Administração da plataforma",
    title: "Visão global do BirdieAtlas",
    description: "Monitore organizações, uso da plataforma e indicadores consolidados.",
    metrics: [
      { label: "Organizações ativas", value: "5", hint: "Todas saudáveis", tone: "success" },
      { label: "Usuários cadastrados", value: "3.847", hint: "+12% neste mês", tone: "success" },
      { label: "Torneios no ano", value: "48", hint: "Em 5 organizações", tone: "default" },
      { label: "Alertas da plataforma", value: "2", hint: "Revisão recomendada", tone: "warning" },
    ],
    primarySectionTitle: "Organizações",
    primaryItems: [
      { title: "Federação Paulista de Badminton", description: "1.284 atletas · 12 torneios ativos", meta: "Uso saudável", status: "Ativa" },
      { title: "Liga Metropolitana", description: "843 atletas · 6 torneios ativos", meta: "Uso saudável", status: "Ativa" },
      { title: "Circuito Sul", description: "612 atletas · 3 torneios ativos", meta: "Aguardando renovação", status: "Atenção" },
    ],
    secondarySectionTitle: "Eventos da plataforma",
    secondaryItems: [
      { title: "Importação de atletas concluída", description: "Federação Paulista de Badminton", meta: "Há 15 minutos" },
      { title: "Novo administrador convidado", description: "Liga Metropolitana", meta: "Há 1 hora" },
      { title: "Backup programado concluído", description: "Todos os ambientes", meta: "Há 4 horas" },
    ],
  },
};
