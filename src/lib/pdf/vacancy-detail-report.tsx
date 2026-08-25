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

const STAGE_ORDER = ["TRIAGEM", "ENTREVISTA_RH", "ENTREVISTA_GESTOR", "TESTE", "PROPOSTA", "CONTRATADO", "REPROVADO"];

export interface VacancyDetailRow {
  name: string;
  source: string;
  stage: string;
  enteredStageAt: Date | null;
  openedAt: Date;
  rejectionReason: string | null;
}

export interface VacancyDetailReportInput {
  title: string;
  positionName: string | null;
  unitName: string | null;
  status: string;
  isCritical: boolean;
  targetDays: number;
  openedAt: Date;
  closedAt: Date | null;
  hiredCandidateName: string | null;
  notes: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  infoBox: {
    borderWidth: 1,
    borderColor: "#E5E1D8",
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoItem: { width: "50%", marginBottom: 6 },
  infoLabel: { fontSize: 7, color: "#6B7280" },
  infoValue: { fontSize: 9.5, fontWeight: 700, color: "#1E2A4A" },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryBox: { flex: 1, borderWidth: 1, borderColor: "#E5E1D8", borderRadius: 6, padding: 8 },
  summaryLabel: { fontSize: 7, color: "#6B7280", marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: 700, color: "#1E2A4A" },
  funnelRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  funnelBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E1D8",
    borderRadius: 6,
    padding: 6,
    alignItems: "center",
  },
  funnelValue: { fontSize: 13, fontWeight: 700, color: "#B8935A" },
  funnelLabel: { fontSize: 6.5, color: "#6B7280", marginTop: 2, textAlign: "center" },
  sectionTitle: { fontSize: 10.5, fontWeight: 700, color: "#1E2A4A", marginBottom: 6 },
  table: { display: "flex", width: "100%" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#1E2A4A", paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderCell: { color: "#FDFBF6", fontSize: 7.5, fontWeight: 700 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E1D8",
  },
  tableRowRejected: { backgroundColor: "#FBEAEA" },
  cell: { fontSize: 7.5, color: "#1F2937" },
  colName: { width: "22%" },
  colSource: { width: "16%" },
  colStage: { width: "16%" },
  colSince: { width: "12%" },
  colOpened: { width: "12%" },
  colNote: { width: "22%" },
  footer: { marginTop: 16, fontSize: 7.5, color: "#6B7280" },
});

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function VacancyDetailReportDocument({
  vacancy,
  rows,
  funnelCounts,
  sla,
  logoDataUrl,
}: {
  vacancy: VacancyDetailReportInput;
  rows: VacancyDetailRow[];
  funnelCounts: Record<string, number>;
  sla: { daysElapsed: number; isBreached: boolean; isOpen: boolean };
  logoDataUrl: string | null;
}) {
  return (
    <Document title={`Relatório da Vaga — ${vacancy.title}`}>
      <Page size="A4" style={styles.page}>
        <ReportHeader title={`Vaga: ${vacancy.title}`} logoDataUrl={logoDataUrl} />

        <View style={styles.infoBox}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>CARGO</Text>
            <Text style={styles.infoValue}>{vacancy.positionName ?? "—"}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>UNIDADE</Text>
            <Text style={styles.infoValue}>{vacancy.unitName ?? "—"}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>STATUS</Text>
            <Text style={styles.infoValue}>{STATUS_LABEL[vacancy.status] ?? vacancy.status}{vacancy.isCritical ? "  ·  Crítica" : ""}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{vacancy.closedAt ? "FECHADA EM" : "ABERTA EM"}</Text>
            <Text style={styles.infoValue}>{formatDate(vacancy.closedAt ?? vacancy.openedAt)}</Text>
          </View>
          {vacancy.hiredCandidateName && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>CONTRATADO(A)</Text>
              <Text style={styles.infoValue}>{vacancy.hiredCandidateName}</Text>
            </View>
          )}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>{sla.isOpen ? "DIAS EM ABERTO" : "DIAS ATÉ FECHAR"}</Text>
            <Text style={styles.summaryValue}>{sla.daysElapsed}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>META DE SLA</Text>
            <Text style={styles.summaryValue}>{vacancy.targetDays}d</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>SITUAÇÃO DO PRAZO</Text>
            <Text style={styles.summaryValue}>{sla.isBreached ? "Estourado" : "Dentro do prazo"}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>CANDIDATOS</Text>
            <Text style={styles.summaryValue}>{rows.length}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Linha do tempo do processo seletivo</Text>
        <View style={styles.funnelRow}>
          {STAGE_ORDER.map((stage) => (
            <View key={stage} style={styles.funnelBox}>
              <Text style={styles.funnelValue}>{funnelCounts[stage] ?? 0}</Text>
              <Text style={styles.funnelLabel}>{STAGE_LABEL[stage]}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Candidatos</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colName]}>Candidato</Text>
            <Text style={[styles.tableHeaderCell, styles.colSource]}>Origem</Text>
            <Text style={[styles.tableHeaderCell, styles.colStage]}>Etapa atual</Text>
            <Text style={[styles.tableHeaderCell, styles.colSince]}>Desde</Text>
            <Text style={[styles.tableHeaderCell, styles.colOpened]}>Aberto em</Text>
            <Text style={[styles.tableHeaderCell, styles.colNote]}>Observação</Text>
          </View>
          {rows.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Nenhum candidato cadastrado para esta vaga ainda.</Text>
            </View>
          ) : (
            rows.map((r, i) => (
              <View key={i} style={[styles.tableRow, r.stage === "REPROVADO" ? styles.tableRowRejected : {}]}>
                <Text style={[styles.cell, styles.colName]}>{r.name}</Text>
                <Text style={[styles.cell, styles.colSource]}>{r.source}</Text>
                <Text style={[styles.cell, styles.colStage]}>{STAGE_LABEL[r.stage] ?? r.stage}</Text>
                <Text style={[styles.cell, styles.colSince]}>{r.enteredStageAt ? formatDate(r.enteredStageAt) : "—"}</Text>
                <Text style={[styles.cell, styles.colOpened]}>{formatDate(r.openedAt)}</Text>
                <Text style={[styles.cell, styles.colNote]}>{r.stage === "REPROVADO" ? (r.rejectionReason ?? "—") : "—"}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          Documento gerado automaticamente pela plataforma de People Analytics &amp; RH BI. Os prazos de SLA e a
          previsão de fechamento são estimativas, não compromissos contratuais.
        </Text>
      </Page>
    </Document>
  );
}
