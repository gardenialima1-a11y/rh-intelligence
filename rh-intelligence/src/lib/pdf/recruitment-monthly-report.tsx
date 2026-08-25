import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "@/lib/pdf/report-header";
import type { MonthlyRecruitmentReport } from "@/services/recruitment-monthly-report";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica" },
  tileRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  tile: { width: "31.5%", borderWidth: 1, borderColor: "#E5E1D8", borderRadius: 6, padding: 8, marginBottom: 8 },
  tileLabel: { fontSize: 7, color: "#6B7280", marginBottom: 3 },
  tileValue: { fontSize: 16, fontWeight: 700, color: "#1E2A4A" },
  tileSub: { fontSize: 6.5, color: "#6B7280", marginTop: 2 },
  tileDeltaUp: { fontSize: 7, color: "#4C8B5B", marginTop: 2, fontWeight: 700 },
  tileDeltaDown: { fontSize: 7, color: "#B23A48", marginTop: 2, fontWeight: 700 },
  sectionTitle: { fontSize: 10.5, fontWeight: 700, color: "#1E2A4A", marginBottom: 6, marginTop: 6 },
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
  cell: { fontSize: 7.5, color: "#1F2937" },
  col1: { width: "28%" },
  col2: { width: "18%" },
  col3: { width: "24%" },
  col4: { width: "15%" },
  col5: { width: "15%" },
  footer: { marginTop: 10, fontSize: 7, color: "#6B7280" },
});

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function DeltaText({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 1000) / 10;
  if (pct === 0) return <Text style={styles.tileSub}>estável vs. mês anterior</Text>;
  const positive = pct > 0;
  return (
    <Text style={positive ? styles.tileDeltaUp : styles.tileDeltaDown}>
      {positive ? "+" : ""}
      {pct.toString().replace(".", ",")}% vs. mês anterior
    </Text>
  );
}

export function RecruitmentMonthlyReportDocument({
  report,
  logoDataUrl,
}: {
  report: MonthlyRecruitmentReport;
  logoDataUrl: string | null;
}) {
  const { current, deltas } = report;

  return (
    <Document title={`Relatório Mensal de Recrutamento — ${current.monthLabel}`}>
      <Page size="A4" style={styles.page}>
        <ReportHeader title={`Recrutamento & Seleção — ${current.monthLabel}`} logoDataUrl={logoDataUrl} />

        <Text style={styles.sectionTitle}>Indicadores do mês</Text>
        <View style={styles.tileRow}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>CANDIDATOS CADASTRADOS</Text>
            <Text style={styles.tileValue}>{current.candidatesRegistered}</Text>
            <DeltaText fraction={deltas.candidatesRegistered} />
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>ENTREVISTAS REALIZADAS</Text>
            <Text style={styles.tileValue}>{current.totalInterviews}</Text>
            <Text style={styles.tileSub}>{current.interviewsRH} com RH · {current.interviewsGestor} com gestor</Text>
            <DeltaText fraction={deltas.totalInterviews} />
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>PESSOAS COM QUEM CONVERSOU</Text>
            <Text style={styles.tileValue}>{current.peopleContacted}</Text>
            <Text style={styles.tileSub}>Ligações e entrevistas (exclui e-mail/mensagem)</Text>
            <DeltaText fraction={deltas.peopleContacted} />
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>VAGAS FECHADAS NO MÊS</Text>
            <Text style={styles.tileValue}>{current.vacanciesClosed}</Text>
            {current.vacanciesCancelled > 0 && <Text style={styles.tileSub}>{current.vacanciesCancelled} cancelada(s)</Text>}
            <DeltaText fraction={deltas.vacanciesClosed} />
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>TEMPO MÉDIO ATÉ FECHAR</Text>
            <Text style={styles.tileValue}>{current.avgDaysToClose !== null ? `${current.avgDaysToClose}d` : "—"}</Text>
            <Text style={styles.tileSub}>Das vagas fechadas neste mês</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>CONTRATAÇÕES</Text>
            <Text style={styles.tileValue}>{current.hires}</Text>
            {current.avgCostToHire !== null && <Text style={styles.tileSub}>Custo médio: {formatCurrency(current.avgCostToHire)}</Text>}
            <DeltaText fraction={deltas.hires} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Vagas fechadas em {current.monthLabel} ({current.closedVacancies.length})</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.col1]}>Vaga</Text>
            <Text style={[styles.tableHeaderCell, styles.col2]}>Unidade</Text>
            <Text style={[styles.tableHeaderCell, styles.col3]}>Contratado(a)</Text>
            <Text style={[styles.tableHeaderCell, styles.col4]}>Fechada em</Text>
            <Text style={[styles.tableHeaderCell, styles.col5]}>Dias até fechar</Text>
          </View>
          {current.closedVacancies.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Nenhuma vaga fechada neste mês.</Text>
            </View>
          ) : (
            current.closedVacancies.map((v, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.cell, styles.col1]}>{v.title}</Text>
                <Text style={[styles.cell, styles.col2]}>{v.unitName ?? "—"}</Text>
                <Text style={[styles.cell, styles.col3]}>{v.hiredCandidateName ?? "—"}</Text>
                <Text style={[styles.cell, styles.col4]}>{v.closedAt ? formatDate(v.closedAt) : "—"}</Text>
                <Text style={[styles.cell, styles.col5]}>{v.daysToClose ?? "—"}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Origem dos candidatos cadastrados no mês</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "50%" }]}>Origem</Text>
            <Text style={[styles.tableHeaderCell, { width: "50%" }]}>Candidatos</Text>
          </View>
          {current.bySource.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Nenhum candidato cadastrado neste mês.</Text>
            </View>
          ) : (
            current.bySource.map((s, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.cell, { width: "50%" }]}>{s.name}</Text>
                <Text style={[styles.cell, { width: "50%" }]}>{s.value}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          Período de referência: {formatDate(current.start)} a {formatDate(current.end)}. Comparações são sempre com
          o mês imediatamente anterior. &quot;Pessoas com quem conversou&quot; e &quot;Entrevistas realizadas&quot;
          vêm dos contatos registrados manualmente pelo recrutador (ligações e entrevistas) — não incluem e-mails
          nem mensagens escritas.
        </Text>
      </Page>
    </Document>
  );
}
