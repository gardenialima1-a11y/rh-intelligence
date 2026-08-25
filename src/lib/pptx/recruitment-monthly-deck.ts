import PptxGenJS from "pptxgenjs";
import type { MonthlyRecruitmentReport } from "@/services/recruitment-monthly-report";

const NAVY = "1B2A4A";
const GOLD = "B8935A";
const CREAM = "F6F1E7";
const SUCCESS = "4C8B5B";
const DANGER = "B23A48";
const MUTED = "6B7280";
const BORDER = "E5E1D8";

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function deltaText(fraction: number): { text: string; color: string } {
  const pct = Math.round(fraction * 1000) / 10;
  if (pct === 0) return { text: "estável vs. mês anterior", color: MUTED };
  const positive = pct > 0;
  return {
    text: `${positive ? "+" : ""}${pct.toString().replace(".", ",")}% vs. mês anterior`,
    color: positive ? SUCCESS : DANGER,
  };
}

/**
 * Monta a apresentação de slides (.pptx) com os mesmos indicadores do
 * relatório mensal em PDF/tela — pronta para levar direto pra reunião de
 * indicadores com a diretoria.
 */
export async function buildRecruitmentMonthlyDeck(
  report: MonthlyRecruitmentReport,
  logoDataUrl: string | null,
  companyName = "Gosto Mineiro"
): Promise<Buffer> {
  const { current, deltas } = report;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "People Analytics & RH BI";
  pptx.title = `Recrutamento & Seleção — ${current.monthLabel}`;

  const logoData = logoDataUrl ? logoDataUrl.replace(/^data:/, "") : null;

  // ---- Slide 1: Capa ----
  const cover = pptx.addSlide();
  cover.background = { color: NAVY };
  if (logoData) {
    cover.addImage({ data: logoData, x: 0.5, y: 0.4, w: 1.6, h: 0.73 });
  } else {
    cover.addText(companyName, { x: 0.5, y: 0.4, w: 4, h: 0.5, fontSize: 16, bold: true, color: CREAM });
  }
  cover.addText("Recrutamento & Seleção", { x: 0.5, y: 2.0, w: 9, h: 0.8, fontSize: 32, bold: true, color: CREAM });
  cover.addText(`Relatório mensal de indicadores — ${current.monthLabel}`, {
    x: 0.5,
    y: 2.75,
    w: 9,
    h: 0.5,
    fontSize: 16,
    color: GOLD,
  });
  cover.addText(`Gerado em ${formatDate(new Date())}`, { x: 0.5, y: 4.9, w: 9, h: 0.3, fontSize: 10, color: "9AA5C0" });

  // ---- Slide 2: Indicadores do mês ----
  const kpiSlide = pptx.addSlide();
  kpiSlide.addText("Indicadores do mês", { x: 0.4, y: 0.25, w: 9, h: 0.5, fontSize: 22, bold: true, color: NAVY });

  const tiles: { label: string; value: string; sub?: string; delta?: number }[] = [
    { label: "CANDIDATOS CADASTRADOS", value: String(current.candidatesRegistered), delta: deltas.candidatesRegistered },
    {
      label: "ENTREVISTAS REALIZADAS",
      value: String(current.totalInterviews),
      sub: `${current.interviewsRH} com RH · ${current.interviewsGestor} com gestor`,
      delta: deltas.totalInterviews,
    },
    { label: "PESSOAS COM QUEM CONVERSOU", value: String(current.peopleContacted), delta: deltas.peopleContacted },
    { label: "VAGAS FECHADAS NO MÊS", value: String(current.vacanciesClosed), delta: deltas.vacanciesClosed },
    {
      label: "TEMPO MÉDIO ATÉ FECHAR",
      value: current.avgDaysToClose !== null ? `${current.avgDaysToClose}d` : "—",
      sub: "Das vagas fechadas neste mês",
    },
    {
      label: "CONTRATAÇÕES",
      value: String(current.hires),
      sub: current.avgCostToHire !== null ? `Custo médio: ${formatCurrency(current.avgCostToHire)}` : undefined,
      delta: deltas.hires,
    },
  ];

  const cols = 3;
  const tileW = 3.0;
  const tileH = 1.9;
  const gap = 0.25;
  const startX = 0.4;
  const startY = 1.1;

  tiles.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (tileW + gap);
    const y = startY + row * (tileH + gap);

    kpiSlide.addShape("roundRect", {
      x,
      y,
      w: tileW,
      h: tileH,
      fill: { color: CREAM },
      line: { color: BORDER, width: 1 },
      rectRadius: 0.08,
    });
    kpiSlide.addText(t.label, { x: x + 0.15, y: y + 0.12, w: tileW - 0.3, h: 0.3, fontSize: 9, color: MUTED, bold: true });
    kpiSlide.addText(t.value, { x: x + 0.15, y: y + 0.42, w: tileW - 0.3, h: 0.6, fontSize: 30, bold: true, color: NAVY });

    let subY = y + 1.05;
    if (t.sub) {
      kpiSlide.addText(t.sub, { x: x + 0.15, y: subY, w: tileW - 0.3, h: 0.3, fontSize: 8, color: MUTED });
      subY += 0.28;
    }
    if (t.delta !== undefined) {
      const d = deltaText(t.delta);
      kpiSlide.addText(d.text, { x: x + 0.15, y: subY, w: tileW - 0.3, h: 0.3, fontSize: 8, bold: true, color: d.color });
    }
  });

  // ---- Slide 3: Vagas fechadas no mês ----
  const vacSlide = pptx.addSlide();
  vacSlide.addText(`Vagas fechadas em ${current.monthLabel}`, {
    x: 0.4,
    y: 0.25,
    w: 9,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: NAVY,
  });

  const headerCellOpts = { bold: true, color: "FFFFFF", fill: { color: NAVY }, fontSize: 10 };
  const vacHeader = [
    { text: "Vaga", options: headerCellOpts },
    { text: "Unidade", options: headerCellOpts },
    { text: "Contratado(a)", options: headerCellOpts },
    { text: "Fechada em", options: headerCellOpts },
    { text: "Dias", options: headerCellOpts },
  ];
  const vacBody =
    current.closedVacancies.length === 0
      ? [[{ text: "Nenhuma vaga fechada neste mês.", options: { colspan: 5, fontSize: 10 } }]]
      : current.closedVacancies.map((v) => [
          { text: v.title, options: { fontSize: 10 } },
          { text: v.unitName ?? "—", options: { fontSize: 10 } },
          { text: v.hiredCandidateName ?? "—", options: { fontSize: 10 } },
          { text: v.closedAt ? formatDate(v.closedAt) : "—", options: { fontSize: 10 } },
          { text: v.daysToClose !== null ? String(v.daysToClose) : "—", options: { fontSize: 10 } },
        ]);

  vacSlide.addTable([vacHeader, ...vacBody], {
    x: 0.4,
    y: 1.0,
    w: 9.2,
    border: { type: "solid", color: BORDER, pt: 0.5 },
    autoPage: true,
    autoPageRepeatHeader: true,
  });

  // ---- Slide 4: Origem dos candidatos ----
  const sourceSlide = pptx.addSlide();
  sourceSlide.addText("Origem dos candidatos cadastrados no mês", {
    x: 0.4,
    y: 0.25,
    w: 9,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: NAVY,
  });

  const sourceHeader = [
    { text: "Origem", options: headerCellOpts },
    { text: "Candidatos", options: headerCellOpts },
  ];
  const sourceBody =
    current.bySource.length === 0
      ? [[{ text: "Nenhum candidato cadastrado neste mês.", options: { colspan: 2, fontSize: 10 } }]]
      : current.bySource.map((s) => [
          { text: s.name, options: { fontSize: 10 } },
          { text: String(s.value), options: { fontSize: 10 } },
        ]);

  sourceSlide.addTable([sourceHeader, ...sourceBody], {
    x: 0.4,
    y: 1.0,
    w: 6,
    border: { type: "solid", color: BORDER, pt: 0.5 },
  });

  const result = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(result as Uint8Array);
}
