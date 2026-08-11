/**
 * Leitor do "Relatório de Folha de Pagamento" (formato usado na folha da Gosto
 * Mineiro). O relatório tem duas tabelas lado a lado por colaborador
 * (Proventos à esquerda, Descontos à direita) — um leitor de texto corrido
 * simples embaralha as colunas. Este parser lê cada palavra pela posição
 * exata (x, y) na página e reconstrói a linha certa, célula por célula.
 *
 * Verbas de hora extra reconhecidas (código da folha):
 *   150 = HORAS EXTRAS 50%
 *   200 = HORA EXTRA 100%
 *   357 = HORA EXTRA NOTURNO 50%
 * Linhas cujo texto contém "MÉDIA" são ignoradas de propósito: são o valor
 * médio de HE pago durante férias/13º, não horas realmente trabalhadas no mês.
 *
 * NOTA TÉCNICA: o pdfjs-dist espera encontrar a API "DOMMatrix" do navegador
 * mesmo rodando em Node (servidor). Por isso aplicamos um polyfill ANTES de
 * importar o pacote — e o import precisa ser dinâmico (não estático lá em
 * cima do arquivo) pra garantir que o polyfill já esteja pronto nesse momento.
 */

const OVERTIME_VERBA_CODES = new Set(["150", "200", "357"]);

// Padrões de descrição usados pra reconhecer a linha de "Salário Base" entre
// os proventos — o código da verba (nº) varia de empresa pra empresa, então
// reconhecemos pelo texto, não pelo número. Confirmado com um relatório real
// da Gosto Mineiro: verba 1 = "SALARIO MENSAL" (CLT normal), verba 5 =
// "SALARIO JOVEM APRENDIZ" (aprendizes), 8797 = "BOLSA ESTAGIO" (estagiários).
// NÃO inclui "SALARIO FAMILIA" (2401) — é um benefício do INSS, não parte do
// salário base do colaborador.
const BASE_SALARY_DESC_PATTERNS = [
  /SAL[AÁ]RIO\s*BASE/i,
  /SAL[AÁ]RIO\s*MENSAL/i,
  /SAL[AÁ]RIO\s*NORMAL/i,
  /SAL[AÁ]RIO\s*CONTRATUAL/i,
  /SAL[AÁ]RIO\s*MENSALISTA/i,
  /SAL[AÁ]RIO\s*JOVEM\s*APRENDIZ/i,
  /BOLSA\s*EST[AÁ]GIO/i,
  /^ORDENADO/i,
];

async function loadPdfjs() {
  const globalScope = globalThis as unknown as { DOMMatrix?: unknown };
  if (typeof globalScope.DOMMatrix === "undefined") {
    const { default: DOMMatrixPolyfill } = await import("dommatrix");
    globalScope.DOMMatrix = DOMMatrixPolyfill;
  }

  // Não definimos workerSrc manualmente: em Node, o próprio pdfjs-dist já resolve
  // "./pdf.worker.mjs" sozinho (relativo ao seu próprio arquivo). Só precisamos
  // garantir que esse arquivo exista no pacote de deploy — isso é feito no
  // next.config.ts, via "outputFileTracingIncludes".
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export interface PayrollOvertimeBreakdownItem {
  verba: string;
  descricao: string;
  horas: number | null;
  valor: number | null;
}

export interface PayrollOvertimeRow {
  matricula: string;
  nome: string;
  cpf: string | null;
  horasExtras: number;
  valorHE: number;
  breakdown: PayrollOvertimeBreakdownItem[];
}

export interface PayrollParseResult {
  competencia: string | null;
  dataFolha: string | null;
  rows: PayrollOvertimeRow[];
}

export interface PayrollBaseSalaryProvento {
  verba: string;
  descricao: string;
  valor: number | null;
}

export interface PayrollBaseSalaryRow {
  matricula: string;
  nome: string;
  cpf: string | null;
  /** null quando nenhuma linha bateu com os padrões de "salário base" — precisa conferir/preencher manualmente. */
  baseSalary: number | null;
  /** Todos os proventos do colaborador na folha (inclui periculosidade, insalubridade, horas extras, etc). */
  proventos: PayrollBaseSalaryProvento[];
  /** Todos os descontos do colaborador na folha (INSS, vale-transporte, empréstimos consignados, planos, etc). */
  descontos: PayrollBaseSalaryProvento[];
  /** Valor de FGTS do colaborador no mês, lido direto do rodapé do bloco (campo "Valor FGTS:"). É o encargo real, não uma estimativa. */
  fgtsValue: number | null;
}

export interface PayrollBaseSalaryParseResult {
  competencia: string | null;
  dataFolha: string | null;
  rows: PayrollBaseSalaryRow[];
}

interface PositionedWord {
  text: string;
  x: number;
  y: number;
}

function parseNum(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function groupIntoRows(words: PositionedWord[]): { y: number; items: PositionedWord[] }[] {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { y: number; items: PositionedWord[] }[] = [];
  for (const w of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - w.y) < 2.2) {
      last.items.push(w);
    } else {
      rows.push({ y: w.y, items: [w] });
    }
  }
  return rows;
}

export async function parsePayrollPdf(data: Uint8Array): Promise<PayrollParseResult> {
  const { getDocument } = await loadPdfjs();
  const doc = await getDocument({ data }).promise;
  const employees = new Map<string, PayrollOvertimeRow>();
  let current: PayrollOvertimeRow | null = null;
  let inTable = false;
  let dataFolha: string | null = null;
  let competencia: string | null = null;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const words: PositionedWord[] = content.items
      .map((it) => {
        const item = it as { str?: string; transform: number[] };
        return { text: item.str ?? "", x: item.transform[4], y: viewport.height - item.transform[5] };
      })
      .filter((w) => w.text.trim() !== "");

    if (!dataFolha) {
      const full = words.map((w) => w.text).join(" ");
      const m = full.match(/Data da Folha:\s*(\d{2}\/\d{2}\/\d{4})/);
      if (m) dataFolha = m[1];
      const mc = full.match(/M[êe]s e Ano:\s*([A-Za-zçÇ]+\/\d{4})/);
      if (mc) competencia = mc[1];
    }

    const rows = groupIntoRows(words);

    for (const row of rows) {
      const items = row.items.sort((a, b) => a.x - b.x);

      // Linha "matrícula + nome" do colaborador (ex.: "53000" ... "ANTONIO MARCIO LIMA DA SILVA")
      const matriculaTok = items.find((i) => i.x >= 65 && i.x <= 82 && /^\d{4,7}$/.test(i.text));
      const nomeTok = items.find((i) => i.x >= 108 && i.x <= 125 && /^[A-ZÀ-Ú].*[A-ZÀ-Ú]$/.test(i.text));
      if (matriculaTok && nomeTok) {
        current = employees.get(matriculaTok.text) ?? {
          matricula: matriculaTok.text,
          nome: nomeTok.text,
          cpf: null,
          horasExtras: 0,
          valorHE: 0,
          breakdown: [],
        };
        employees.set(matriculaTok.text, current);
        inTable = false;
      }

      if (current && !current.cpf) {
        const cpfLabel = items.find((i) => i.x >= 244 && i.x <= 250 && i.text === "CPF:");
        if (cpfLabel) {
          const cpfVal = items.find((i) => i.x >= 258 && i.x <= 268);
          if (cpfVal) current.cpf = cpfVal.text;
        }
      }

      // Cabeçalho "Verba Descrição (Proventos) Ref. Valor ..." abre a tabela do colaborador atual
      if (items.some((i) => i.x >= 27 && i.x <= 32 && i.text === "Verba")) {
        inTable = true;
        continue;
      }

      // "Base INSS:" fecha a tabela (fim do bloco do colaborador)
      if (inTable && items.some((i) => i.x >= 27 && i.x <= 33 && /^Base/.test(i.text))) {
        inTable = false;
        current = null;
        continue;
      }

      if (inTable && current) {
        const provVerba = items.find((i) => i.x >= 30 && i.x < 45);
        const provDesc = items
          .filter((i) => i.x >= 45 && i.x < 225)
          .map((i) => i.text)
          .join(" ");
        const provRef = items.find((i) => i.x >= 225 && i.x < 262);
        const provValor = items.find((i) => i.x >= 262 && i.x < 300);

        if (provVerba && OVERTIME_VERBA_CODES.has(provVerba.text) && !/M[ÉE]DIA/i.test(provDesc)) {
          const horas = parseNum(provRef?.text);
          const valor = parseNum(provValor?.text);
          if (horas != null) current.horasExtras += horas;
          if (valor != null) current.valorHE += valor;
          current.breakdown.push({ verba: provVerba.text, descricao: provDesc, horas, valor });
        }
      }
    }
  }

  const rows = [...employees.values()]
    .filter((e) => e.horasExtras > 0)
    .map((e) => ({
      ...e,
      horasExtras: Math.round(e.horasExtras * 100) / 100,
      valorHE: Math.round(e.valorHE * 100) / 100,
    }));

  return { competencia, dataFolha, rows };
}

/**
 * Mesmo relatório de folha, mas lendo o Salário Base de cada colaborador em
 * vez de horas extras — usado pra alimentar o módulo de Custos. Reconhece a
 * linha pela descrição do provento (ver BASE_SALARY_DESC_PATTERNS); quando
 * nenhuma linha bate, devolve baseSalary: null e a lista de proventos crus
 * pra conferência manual na tela de importação.
 */
export async function parsePayrollBaseSalaries(data: Uint8Array): Promise<PayrollBaseSalaryParseResult> {
  const { getDocument } = await loadPdfjs();
  const doc = await getDocument({ data }).promise;
  const employees = new Map<string, PayrollBaseSalaryRow>();
  let current: PayrollBaseSalaryRow | null = null;
  let inTable = false;
  let dataFolha: string | null = null;
  let competencia: string | null = null;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const words: PositionedWord[] = content.items
      .map((it) => {
        const item = it as { str?: string; transform: number[] };
        return { text: item.str ?? "", x: item.transform[4], y: viewport.height - item.transform[5] };
      })
      .filter((w) => w.text.trim() !== "");

    if (!dataFolha) {
      const full = words.map((w) => w.text).join(" ");
      const m = full.match(/Data da Folha:\s*(\d{2}\/\d{2}\/\d{4})/);
      if (m) dataFolha = m[1];
      const mc = full.match(/M[êe]s e Ano:\s*([A-Za-zçÇ]+\/\d{4})/);
      if (mc) competencia = mc[1];
    }

    const rows = groupIntoRows(words);

    for (const row of rows) {
      const items = row.items.sort((a, b) => a.x - b.x);

      const matriculaTok = items.find((i) => i.x >= 65 && i.x <= 82 && /^\d{4,7}$/.test(i.text));
      const nomeTok = items.find((i) => i.x >= 108 && i.x <= 125 && /^[A-ZÀ-Ú].*[A-ZÀ-Ú]$/.test(i.text));
      if (matriculaTok && nomeTok) {
        current = employees.get(matriculaTok.text) ?? {
          matricula: matriculaTok.text,
          nome: nomeTok.text,
          cpf: null,
          baseSalary: null,
          proventos: [],
          descontos: [],
          fgtsValue: null,
        };
        employees.set(matriculaTok.text, current);
        inTable = false;
      }

      if (current && !current.cpf) {
        const cpfLabel = items.find((i) => i.x >= 244 && i.x <= 250 && i.text === "CPF:");
        if (cpfLabel) {
          const cpfVal = items.find((i) => i.x >= 258 && i.x <= 268);
          if (cpfVal) current.cpf = cpfVal.text;
        }
      }

      // O rodapé do bloco do colaborador (mesma linha de "Base INSS:") também traz
      // "Valor FGTS:" — é o encargo real de FGTS daquele mês, não uma estimativa.
      if (current && current.fgtsValue === null) {
        const fgtsLabelIdx = items.findIndex((i) => i.text === "Valor FGTS:");
        if (fgtsLabelIdx !== -1 && items[fgtsLabelIdx + 1]) {
          const val = parseNum(items[fgtsLabelIdx + 1].text);
          if (val != null) current.fgtsValue = val;
        }
      }

      if (items.some((i) => i.x >= 27 && i.x <= 32 && i.text === "Verba")) {
        inTable = true;
        continue;
      }

      if (inTable && items.some((i) => i.x >= 27 && i.x <= 33 && /^Base/.test(i.text))) {
        inTable = false;
        current = null;
        continue;
      }

      if (inTable && current) {
        const provVerba = items.find((i) => i.x >= 30 && i.x < 45);
        const provDesc = items
          .filter((i) => i.x >= 45 && i.x < 225)
          .map((i) => i.text)
          .join(" ");
        const provValor = items.find((i) => i.x >= 262 && i.x < 300);

        if (provVerba && provDesc && !/M[ÉE]DIA/i.test(provDesc)) {
          const valor = parseNum(provValor?.text);
          current.proventos.push({ verba: provVerba.text, descricao: provDesc, valor });
          if (current.baseSalary === null && valor != null && BASE_SALARY_DESC_PATTERNS.some((re) => re.test(provDesc))) {
            current.baseSalary = valor;
          }
        }

        // Coluna de Descontos, à direita da de Proventos na mesma linha da tabela.
        const descVerba = items.find((i) => i.x >= 300 && i.x < 315);
        const descDesc = items
          .filter((i) => i.x >= 315 && i.x < 498)
          .map((i) => i.text)
          .join(" ");
        const descValor = items.find((i) => i.x >= 533 && i.x < 590);

        if (descVerba && descDesc && !/M[ÉE]DIA/i.test(descDesc)) {
          const valor = parseNum(descValor?.text);
          current.descontos.push({ verba: descVerba.text, descricao: descDesc, valor });
        }
      }
    }
  }

  return { competencia, dataFolha, rows: [...employees.values()] };
}
