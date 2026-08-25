import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "@/lib/pdf/report-header";

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  PREENCHIDA: "Preenchida",
  CANCELADA: "Cancelada",
  EM_PAUSA: "Em pausa",
};

const STAGE_LABEL: Record<string, string> = {
  TRIAGEM: "Triagem",
  ENTREVISTA_RH: "Entrevista RH",
  ENTREVISTA_GESTOR: "Entrevista Gestor",
  TESTE: "Teste",
  PROPOSTA: "Proposta",
  CONTRATADO: "Contratado",
  REPROVADO: "Reprovado",
};

export interface OpenVacancyRow {
  title: string;
  unitName: string | null;
  status: string;
  isCritical: boolean;
  daysOpen: number;
  targetDays: number;
  isBreached: boolean;
  activeCandidates: number;
  furthestStage: string | null;
}

export interface ClosedVacancyRowPdf {
  title: string;
  unitName: string | null;
  status: string;
  hiredCandidateName: string | null;
  closedAt: Date | null;
  daysToClose: number | null;
}

export interface RecruitmentOverviewKpis {
  openVacancies: number;
  criticalVacancies: number;
  avgTimeToHire: number;
  avgCostToHire: number;
  hiredCount: number;
}

const styles = StyleSheet.create({
  page: { padding: 26, fontSize: 8.5, fontFamily: "Helvetica" },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  summaryBox: { flex: 1, borderWidth: 1, borderColor: "#E5E1D8", borderRadius: 6, padding: 7 },
  summaryLabel: { fontSize: 6.5, color: "#6B7280", marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: 700, color: "#1E2A4A" },
  sectionTitle: { fontSize: 10.5, fontWeight: 700, color: "#1E2A4A", marginBottom: 6, marginTop: 4 },
  table: { display: "flex", width: "100%", marginBottom: 12 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#1E2A4A", paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderCell: { color: "#FDFBF6", fontSize: 7, fontWeight: 700 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4.5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E1D8",
  },
  tableRowBreached: { backgroundColor: "#FBEAEA" },
  cell: { fontSize: 7.5, color: "#1F2937" },
  colTitle: { width: "20%" },
  colUnit: { width: "13%" },
  colStatus: { width: "11%" },
  colDays: { width: "9%" },
  colSla: { width: "13%" },
  colCandidates: { width: "10%" },
  colStage: { width: "14%" },
  colCritical: { width: "8%" },
  footer: { marginTop: 8, fontSize: 7, color: "#6B7280" },
});

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function RecruitmentOverviewReportDocument({
  kpis,
  openVacancies,
  closedVacancies,
  logoDataUrl,
}: {
  kpis: RecruitmentOverviewKpis;
  openVacancies: OpenVacancyRow[];
  closedVacancies: ClosedVacancyRowPdf[];
  logoDataUrl: string | null;
}) {
  return (
    <Document title="Recrutamento & Seleção — Status Atual">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportHeader title="Recrutamento & Seleção — Status Atual de Todas as Vagas" logoDataUrl={logoDataUrl} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>VAGAS ABERTAS/EM ANDAMENTO</Text>
            <Text style={styles.summaryValue}>{kpis.openVacancies}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>VAGAS CRÍTICAS</Text>
            <Text style={styles.summaryValue}>{kpis.criticalVacancies}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>TEMPO MÉDIO DE CONTRATAÇÃO</Text>
            <Text style={styles.summaryValue}>{kpis.avgTimeToHire.toFixed(0)}d</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>CUSTO MÉDIO POR CONTRATAÇÃO</Text>
            <Text style={styles.summaryValue}>{formatCurrency(kpis.avgCostToHire)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>CONTRATADOS NO PERÍODO</Text>
            <Text style={styles.summaryValue}>{kpis.hiredCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Vagas em aberto / em andamento ({openVacancies.length})</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colTitle]}>Vaga</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unidade</Text>
            <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
            <Text style={[styles.tableHeaderCell, styles.colDays]}>Dias abertos</Text>
            <Text style={[styles.tableHeaderCell, styles.colSla]}>SLA (meta)</Text>
            <Text style={[styles.tableHeaderCell, styles.colCandidates]}>Candidatos</Text>
            <Text style={[styles.tableHeaderCell, styles.colStage]}>Etapa mais avançada</Text>
            <Text style={[styles.tableHeaderCell, styles.colCritical]}>Crítica</Text>
          </View>
          {openVacancies.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Nenhuma vaga em aberto no momento.</Text>
            </View>
          ) : (
            openVacancies.map((v, i) => (
              <View key={i} style={[styles.tableRow, v.isBreached ? styles.tableRowBreached : {}]}>
                <Text style={[styles.cell, styles.colTitle]}>{v.title}</Text>
                <Text style={[styles.cell, styles.colUnit]}>{v.unitName ?? "—"}</Text>
                <Text style={[styles.cell, styles.colStatus]}>{STATUS_LABEL[v.status] ?? v.status}</Text>
                <Text style={[styles.cell, styles.colDays]}>{v.daysOpen}</Text>
                <Text style={[styles.cell, styles.colSla]}>{v.isBreached ? `Estourado (${v.targetDays}d)` : `Dentro do prazo (${v.targetDays}d)`}</Text>
                <Text style={[styles.cell, styles.colCandidates]}>{v.activeCandidates}</Text>
                <Text style={[styles.cell, styles.colStage]}>{v.furthestStage ? (STAGE_LABEL[v.furthestStage] ?? v.furthestStage) : "—"}</Text>
                <Text style={[styles.cell, styles.colCritical]}>{v.isCritical ? "Sim" : "—"}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Vagas fechadas recentemente ({closedVacancies.length})</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colTitle]}>Vaga</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unidade</Text>
            <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { width: "20%" }]}>Contratado(a)</Text>
            <Text style={[styles.tableHeaderCell, styles.colSla]}>Fechada em</Text>
            <Text style={[styles.tableHeaderCell, styles.colDays]}>Dias até fechar</Text>
          </View>
          {closedVacancies.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Nenhuma vaga fechada ainda.</Text>
            </View>
          ) : (
            closedVacancies.slice(0, 15).map((v, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.cell, styles.colTitle]}>{v.title}</Text>
                <Text style={[styles.cell, styles.colUnit]}>{v.unitName ?? "—"}</Text>
                <Text style={[styles.cell, styles.colStatus]}>{STATUS_LABEL[v.status] ?? v.status}</Text>
                <Text style={[styles.cell, { width: "20%" }]}>{v.hiredCandidateName ?? "—"}</Text>
                <Text style={[styles.cell, styles.colSla]}>{v.closedAt ? formatDate(v.closedAt) : "—"}</Text>
                <Text style={[styles.cell, styles.colDays]}>{v.daysToClose ?? "—"}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          Linhas destacadas na tabela de vagas em aberto: SLA estourado (dias em aberto acima da meta cadastrada
          para a vaga). Lista de vagas fechadas limitada às 15 mais recentes.
        </Text>
      </Page>
    </Document>
  );
}
