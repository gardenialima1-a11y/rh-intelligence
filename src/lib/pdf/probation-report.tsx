import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "@/lib/pdf/report-header";

interface ProbationReportRow {
  name: string;
  registration: string;
  position: string;
  costCenter: string;
  manager: string;
  admissionDate: Date;
  checkpoint2: Date;
  diasRestantes: number;
  alerta: boolean;
  status60: string;
}

const STATUS_LABEL: Record<string, string> = {
  EM_AVALIACAO: "Em avaliação",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  PRAZO_EXPIRADO_NAO_AVALIADO: "Prazo expirado — não avaliado",
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E1D8",
    borderRadius: 6,
    padding: 8,
  },
  summaryLabel: { fontSize: 7, color: "#6B7280", marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: 700, color: "#1E2A4A" },
  table: { display: "flex", width: "100%" },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1E2A4A",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { color: "#FDFBF6", fontSize: 7.5, fontWeight: 700 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E1D8",
  },
  tableRowAlert: { backgroundColor: "#FBF0DD" },
  cell: { fontSize: 7.5, color: "#1F2937" },
  colName: { width: "18%" },
  colReg: { width: "9%" },
  colPos: { width: "15%" },
  colSector: { width: "13%" },
  colManager: { width: "13%" },
  colAdm: { width: "9%" },
  colCheckpoint: { width: "9%" },
  colStatus: { width: "14%" },
  footer: { marginTop: 16, fontSize: 7.5, color: "#6B7280" },
});

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function ProbationReportDocument({
  rows,
  logoDataUrl,
}: {
  rows: ProbationReportRow[];
  logoDataUrl: string | null;
}) {
  const emAlerta = rows.filter((r) => r.alerta).length;
  const reprovados = rows.filter((r) => r.status60 === "REPROVADO").length;

  return (
    <Document title="Relatório de Período de Experiência">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <ReportHeader title="Período de Experiência — Status Atual" logoDataUrl={logoDataUrl} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>EM PERÍODO DE EXPERIÊNCIA</Text>
            <Text style={styles.summaryValue}>{rows.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>PRAZO VENCENDO (10 DIAS OU MENOS)</Text>
            <Text style={styles.summaryValue}>{emAlerta}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>REPROVADOS NO PERÍODO</Text>
            <Text style={styles.summaryValue}>{reprovados}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colName]}>Colaborador</Text>
            <Text style={[styles.tableHeaderCell, styles.colReg]}>Matrícula</Text>
            <Text style={[styles.tableHeaderCell, styles.colPos]}>Cargo</Text>
            <Text style={[styles.tableHeaderCell, styles.colSector]}>Setor</Text>
            <Text style={[styles.tableHeaderCell, styles.colManager]}>Gestor</Text>
            <Text style={[styles.tableHeaderCell, styles.colAdm]}>Admissão</Text>
            <Text style={[styles.tableHeaderCell, styles.colCheckpoint]}>Checkpoint 90d</Text>
            <Text style={[styles.tableHeaderCell, styles.colStatus]}>Situação</Text>
          </View>
          {rows.map((r, i) => (
            <View key={i} style={[styles.tableRow, r.alerta ? styles.tableRowAlert : {}]}>
              <Text style={[styles.cell, styles.colName]}>{r.name}</Text>
              <Text style={[styles.cell, styles.colReg]}>{r.registration}</Text>
              <Text style={[styles.cell, styles.colPos]}>{r.position}</Text>
              <Text style={[styles.cell, styles.colSector]}>{r.costCenter}</Text>
              <Text style={[styles.cell, styles.colManager]}>{r.manager}</Text>
              <Text style={[styles.cell, styles.colAdm]}>{formatDate(r.admissionDate)}</Text>
              <Text style={[styles.cell, styles.colCheckpoint]}>{formatDate(r.checkpoint2)}</Text>
              <Text style={[styles.cell, styles.colStatus]}>
                {r.alerta ? `Faltam ${r.diasRestantes} dia(s) — ` : ""}
                {STATUS_LABEL[r.status60] ?? r.status60}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Linhas destacadas: faltam 10 dias ou menos para o fim do período de experiência (90 dias) e a avaliação
          final ainda não foi registrada.
        </Text>
      </Page>
    </Document>
  );
}
