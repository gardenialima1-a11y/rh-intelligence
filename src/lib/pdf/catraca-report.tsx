import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "@/lib/pdf/report-header";
import type { CatracaReportData } from "@/services/catraca-report";

const NAVY = "#1E2A4A";
const GOLD = "#B8935A";
const DANGER = "#B23A48";
const WARNING = "#8F6413";
const MUTED = "#6B7280";
const BORDER = "#E5E1D8";
const CREAM = "#FDFBF6";
const TRACK = "#F1EEE6";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica" },
  periodNote: { fontSize: 8, color: MUTED, marginBottom: 14 },

  tileRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  tile: { width: "23%", borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 8 },
  tileLabel: { fontSize: 6.5, color: MUTED, marginBottom: 3 },
  tileValue: { fontSize: 16, fontWeight: 700, color: NAVY },
  tileSub: { fontSize: 6.3, color: MUTED, marginTop: 2 },

  sectionTitle: { fontSize: 10.5, fontWeight: 700, color: NAVY, marginBottom: 6, marginTop: 4 },
  sectionSub: { fontSize: 7.5, color: MUTED, marginBottom: 8, marginTop: -3 },

  attentionBox: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10, marginBottom: 16, backgroundColor: CREAM },
  attentionRow: { flexDirection: "row", marginBottom: 5 },
  attentionDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 3, marginRight: 6 },
  attentionText: { flex: 1, fontSize: 8, lineHeight: 1.4, color: "#1F2937" },

  headlineBox: {
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    backgroundColor: "#FBF6EC",
  },
  headlineText: { fontSize: 9, lineHeight: 1.45, color: "#3F2F14" },

  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  barLabel: { width: 46, fontSize: 7.3, color: "#1F2937" },
  barTrack: { flex: 1, height: 9, backgroundColor: TRACK, borderRadius: 3, flexDirection: "row", overflow: "hidden" },
  barFillNavy: { height: 9, borderRadius: 3, backgroundColor: NAVY },
  barFillGold: { height: 9, borderRadius: 3, backgroundColor: GOLD },
  barFillDanger: { height: 9, borderRadius: 3, backgroundColor: DANGER },
  barValue: { width: 92, fontSize: 7.3, textAlign: "right", color: NAVY, fontWeight: 700 },

  table: { display: "flex", width: "100%", marginBottom: 14 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 5, paddingHorizontal: 4 },
  tableHeaderCell: { color: CREAM, fontSize: 7, fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 4.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { backgroundColor: "#FAF9F6" },
  cell: { fontSize: 7.5, color: "#1F2937" },
  badge: { fontSize: 6.8, fontWeight: 700, color: DANGER },

  footer: { marginTop: 8, fontSize: 6.8, color: MUTED, lineHeight: 1.4 },
});

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function Bar({ label, value, valueLabel, max, color = "navy" }: { label: string; value: number; valueLabel: string; max: number; color?: "navy" | "gold" | "danger" }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const fillStyle = color === "gold" ? styles.barFillGold : color === "danger" ? styles.barFillDanger : styles.barFillNavy;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[fillStyle, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.barValue}>{valueLabel}</Text>
    </View>
  );
}

const ATTENTION_COLOR: Record<string, string> = { danger: DANGER, warning: WARNING, info: MUTED };

export function CatracaReportDocument({ data, logoDataUrl }: { data: CatracaReportData; logoDataUrl: string | null }) {
  const { kpis, attentionPoints, hourly, peakHour, byArea, monthlyTrend, criticalRanking, ranking } = data;

  const maxHourOcc = Math.max(1, ...hourly.map((h) => h.occurrences));
  const maxAreaMinutes = Math.max(1, ...byArea.map((a) => a.minutes));
  const maxMonthPerDay = Math.max(1, ...monthlyTrend.map((m) => m.occurrencesPerDay));

  return (
    <Document title="Catraca — Relatório Gerencial">
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Catraca — Relatório Gerencial" logoDataUrl={logoDataUrl} />
        <Text style={styles.periodNote}>
          Período: {formatDate(data.periodStart)} a {formatDate(data.periodEnd)} · {kpis.monitoredEmployees} colaboradores com
          registro de catraca no período · tempo fora do posto considera 60min de tolerância e ignora retornos na janela de
          almoço (11h00–12h42)
        </Text>

        <View style={styles.tileRow}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>TEMPO TOTAL FORA DO POSTO</Text>
            <Text style={styles.tileValue}>{kpis.totalHours.toFixed(0)}h</Text>
            <Text style={styles.tileSub}>além da tolerância de 60min</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>OCORRÊNCIAS</Text>
            <Text style={styles.tileValue}>{kpis.totalOccurrences}</Text>
            <Text style={styles.tileSub}>pausas acima do permitido</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>MÉDIA POR COLABORADOR</Text>
            <Text style={styles.tileValue}>{kpis.avgMinutesPerEmployee}min</Text>
            <Text style={styles.tileSub}>entre os monitorados no período</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>COLABORADORES CRÍTICOS</Text>
            <Text style={[styles.tileValue, { color: DANGER }]}>{kpis.criticalEmployees}</Text>
            <Text style={styles.tileSub}>mais de 2h no período</Text>
          </View>
        </View>

        <View style={styles.attentionBox}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 6 }]}>Pontos de atenção</Text>
          {attentionPoints.map((p, i) => (
            <View key={i} style={styles.attentionRow}>
              <View style={[styles.attentionDot, { backgroundColor: ATTENTION_COLOR[p.severity] }]} />
              <Text style={styles.attentionText}>{p.text}</Text>
            </View>
          ))}
        </View>

        {peakHour && (
          <View style={styles.headlineBox}>
            <Text style={styles.headlineText}>
              <Text style={{ fontWeight: 700 }}>Horário de maior concentração: {peakHour.hour}h–{peakHour.hour + 1}h.</Text>{" "}
              {peakHour.pct}% de todas as ocorrências de tempo excedente fora do posto no período acontecem quando o
              colaborador sai do posto por volta desse horário — vale confirmar com a liderança se é um problema de duração
              real da pausa nesse horário antes de qualquer ação disciplinar individual.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Horário em que o tempo fora do posto acontece</Text>
        <Text style={styles.sectionSub}>Hora de saída do posto nas ocorrências contadas (Entrada → Saída válida)</Text>
        {hourly.length === 0 ? (
          <Text style={[styles.cell, { marginBottom: 14 }]}>Sem ocorrências no período.</Text>
        ) : (
          <View style={{ marginBottom: 14 }}>
            {hourly.map((h) => (
              <Bar
                key={h.hour}
                label={`${h.hour}h`}
                value={h.occurrences}
                valueLabel={`${h.occurrences} ocorr. · ${formatMinutes(h.minutes)}`}
                max={maxHourOcc}
                color={peakHour && h.hour === peakHour.hour ? "danger" : "navy"}
              />
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Tempo fora do posto por setor</Text>
        {byArea.length === 0 ? (
          <Text style={[styles.cell, { marginBottom: 14 }]}>Sem ocorrências no período.</Text>
        ) : (
          <View style={{ marginBottom: 14 }}>
            {byArea.map((a) => (
              <Bar
                key={a.name}
                label={a.name}
                value={a.minutes}
                valueLabel={`${a.hours}h · ${a.occurrences} ocorr. · ${a.employees} colab.`}
                max={maxAreaMinutes}
                color="gold"
              />
            ))}
          </View>
        )}

        {monthlyTrend.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>Evolução mensal</Text>
            <Text style={styles.sectionSub}>Ocorrências por dia útil com leitura de catraca (normalizado — meses com dados parciais não distorcem a comparação)</Text>
            <View style={{ marginBottom: 14 }}>
              {monthlyTrend.map((m) => (
                <Bar
                  key={m.key}
                  label={m.label}
                  value={m.occurrencesPerDay}
                  valueLabel={`${m.occurrencesPerDay}/dia (${m.daysWithData}d)`}
                  max={maxMonthPerDay}
                  color="navy"
                />
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Colaboradores em situação crítica (mais de 2h no período)</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "30%" }]}>Colaborador</Text>
            <Text style={[styles.tableHeaderCell, { width: "18%" }]}>Setor</Text>
            <Text style={[styles.tableHeaderCell, { width: "24%" }]}>Detalhe</Text>
            <Text style={[styles.tableHeaderCell, { width: "14%" }]}>Tempo total</Text>
            <Text style={[styles.tableHeaderCell, { width: "14%" }]}>Ocorrências</Text>
          </View>
          {criticalRanking.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Nenhum colaborador crítico no período.</Text>
            </View>
          ) : (
            criticalRanking.map((r, i) => (
              <View key={r.employeeId} style={i % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
                <Text style={[styles.cell, { width: "30%" }]}>{r.name}</Text>
                <Text style={[styles.cell, { width: "18%" }]}>{r.area ?? "—"}</Text>
                <Text style={[styles.cell, { width: "24%" }]}>{r.sector ?? "—"}</Text>
                <Text style={[styles.cell, styles.badge, { width: "14%" }]}>{formatMinutes(r.minutesOut)}</Text>
                <Text style={[styles.cell, { width: "14%" }]}>{r.occurrences}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Ranking geral (top 15)</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "32%" }]}>Colaborador</Text>
            <Text style={[styles.tableHeaderCell, { width: "20%" }]}>Setor</Text>
            <Text style={[styles.tableHeaderCell, { width: "26%" }]}>Detalhe</Text>
            <Text style={[styles.tableHeaderCell, { width: "11%" }]}>Tempo total</Text>
            <Text style={[styles.tableHeaderCell, { width: "11%" }]}>Ocorr.</Text>
          </View>
          {ranking.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.cell}>Sem ocorrências no período.</Text>
            </View>
          ) : (
            ranking.map((r, i) => (
              <View key={r.employeeId} style={i % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
                <Text style={[styles.cell, { width: "32%" }]}>{r.name}</Text>
                <Text style={[styles.cell, { width: "20%" }]}>{r.area ?? "—"}</Text>
                <Text style={[styles.cell, { width: "26%" }]}>{r.sector ?? "—"}</Text>
                <Text style={[styles.cell, { width: "11%" }]}>{formatMinutes(r.minutesOut)}</Text>
                <Text style={[styles.cell, { width: "11%" }]}>{r.occurrences}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          Regra de cálculo: só contam pares Entrada→Saída consecutivos no mesmo dia; retornos entre 11h00 e 12h42 (janela de
          almoço) são descartados por completo; do tempo restante, só o que ultrapassa 70 minutos é contado, descontando 60
          minutos de tolerância. &quot;Setor&quot; usa a área do centro de custo principal do colaborador; &quot;Detalhe&quot;
          usa o setor secundário quando cadastrado. Colaboradores sem nenhum registro de catraca no período não aparecem
          neste relatório.
        </Text>
      </Page>
    </Document>
  );
}
