import {
  LayoutDashboard,
  Users,
  UserCog,
  Cake,
  TrendingUp,
  DoorOpen,
  UserX,
  Target,
  BookOpen,
  BarChart3,
  Heart,
  Clock,
  AlertTriangle,
  ScanFace,
  ShieldAlert,
  Wallet,
  Gift,
  Trophy,
  Network,
  Fingerprint,
  FileText,
  BrainCircuit,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";

export interface ModuleDef {
  key: string;
  slug: string;
  name: string;
  shortName: string;
  icon: LucideIcon;
  group: string;
  description: string;
  minRole?: Role[];
}

export const MODULE_GROUPS = [
  "Visão Geral",
  "Ciclo de Vida do Colaborador",
  "Rotina e Jornada",
  "Desenvolvimento",
  "Clima e Cultura",
  "Governança",
  "Sistema",
] as const;

export const MODULES: ModuleDef[] = [
  { key: "home", slug: "", name: "Dashboard Executivo", shortName: "Home", icon: LayoutDashboard, group: "Visão Geral", description: "Cockpit executivo com todos os KPIs-mestre." },
  { key: "people-analytics", slug: "people-analytics", name: "People Analytics (Insights e IA)", shortName: "Insights", icon: BrainCircuit, group: "Visão Geral", description: "Correlações, anomalias, forecast e narrativas automáticas." },

  { key: "recrutamento", slug: "recrutamento", name: "Recrutamento & Seleção (ATS)", shortName: "Recrutamento", icon: Target, group: "Ciclo de Vida do Colaborador", description: "Funil de vagas, tempo de contratação e eficiência." },
  { key: "admissoes", slug: "admissoes", name: "Admissões", shortName: "Admissões", icon: DoorOpen, group: "Ciclo de Vida do Colaborador", description: "Volume, custo e qualidade das contratações." },
  { key: "headcount", slug: "headcount", name: "Headcount", shortName: "Headcount", icon: Users, group: "Ciclo de Vida do Colaborador", description: "Quadro ativo, previsto e evolução do headcount." },
  { key: "aniversariantes", slug: "aniversariantes", name: "Aniversariantes", shortName: "Aniversários", icon: Cake, group: "Ciclo de Vida do Colaborador", description: "Aniversário de vida e de empresa do mês." },
  { key: "colaboradores", slug: "colaboradores", name: "Colaboradores (Cadastro)", shortName: "Colaboradores", icon: UserCog, group: "Ciclo de Vida do Colaborador", description: "Cadastrar, editar e desligar colaboradores.", minRole: ["ADMINISTRADOR", "RH"] },
  { key: "desligamentos", slug: "desligamentos", name: "Desligamentos", shortName: "Desligamentos", icon: UserX, group: "Ciclo de Vida do Colaborador", description: "Saídas, custo rescisório e causas raiz." },
  { key: "turnover", slug: "turnover", name: "Turnover", shortName: "Turnover", icon: TrendingUp, group: "Ciclo de Vida do Colaborador", description: "Rotatividade voluntária e involuntária." },

  { key: "jornada", slug: "jornada", name: "Jornada, Ponto e Horas Extras", shortName: "Jornada/HE", icon: Clock, group: "Rotina e Jornada", description: "Banco de horas, HE e conformidade de jornada." },
  { key: "absenteismo", slug: "absenteismo", name: "Absenteísmo e Afastamentos", shortName: "Absenteísmo", icon: AlertTriangle, group: "Rotina e Jornada", description: "Faltas, atestados e afastamentos." },
  { key: "catraca", slug: "catraca", name: "Catraca e Permanência Fora do Posto", shortName: "Catraca", icon: ScanFace, group: "Rotina e Jornada", description: "Tempo fora do posto a partir da catraca." },

  { key: "treinamento", slug: "treinamento", name: "Treinamento & Desenvolvimento", shortName: "Treinamento", icon: BookOpen, group: "Desenvolvimento", description: "Horas, custos e eficácia de treinamentos." },
  { key: "desempenho", slug: "desempenho", name: "Avaliação de Desempenho", shortName: "Desempenho", icon: BarChart3, group: "Desenvolvimento", description: "Ciclos de avaliação, PDI e 9-box." },
  { key: "lideranca", slug: "lideranca", name: "Liderança e Gestão", shortName: "Liderança", icon: Trophy, group: "Desenvolvimento", description: "Índice de liderança e plano de sucessão." },
  { key: "organograma", slug: "organograma", name: "Organograma", shortName: "Organograma", icon: Network, group: "Desenvolvimento", description: "Estrutura hierárquica de gestores e equipes." },

  { key: "clima", slug: "clima", name: "Clima Organizacional / eNPS", shortName: "Clima/eNPS", icon: Heart, group: "Clima e Cultura", description: "Favorabilidade, eNPS e pesquisa de clima." },
  { key: "diversidade", slug: "diversidade", name: "Diversidade & Inclusão", shortName: "D&I", icon: Fingerprint, group: "Clima e Cultura", description: "Cotas legais e indicadores de diversidade." },

  { key: "sst", slug: "sst", name: "Saúde e Segurança do Trabalho", shortName: "SST", icon: ShieldAlert, group: "Governança", description: "Acidentes, CAT e taxas de frequência/gravidade." },
  { key: "custos", slug: "custos", name: "Custos de Pessoal", shortName: "Custos", icon: Wallet, group: "Governança", description: "Folha, encargos e custo x receita." },
  { key: "beneficios", slug: "beneficios", name: "Benefícios", shortName: "Benefícios", icon: Gift, group: "Governança", description: "Custo e utilização de benefícios." },
  { key: "compliance", slug: "compliance", name: "Compliance Trabalhista", shortName: "Compliance", icon: FileText, group: "Governança", description: "Advertências, suspensões e passivos." },

  { key: "administracao", slug: "administracao", name: "Administração e Configurações", shortName: "Admin", icon: Settings, group: "Sistema", description: "Usuários, perfis, metas e integrações.", minRole: ["ADMINISTRADOR"] },
];

export function getModuleBySlug(slug: string | undefined): ModuleDef | undefined {
  return MODULES.find((m) => m.slug === (slug ?? ""));
}

export function modulesByGroup() {
  return MODULE_GROUPS.map((group) => ({
    group,
    modules: MODULES.filter((m) => m.group === group),
  }));
}
