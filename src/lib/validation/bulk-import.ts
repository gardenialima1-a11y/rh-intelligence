export interface ReferenceLookups {
  positions: { id: string; name: string }[];
  costCenters: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  units: { id: string; name: string }[];
}

export interface BulkImportRow {
  matricula: string;
  nome: string;
  cargo: string;
  centroCusto: string;
  setorSecundario: string;
  gestor: string;
  unidade: string;
  genero: string;
  telefone: string;
  email: string;
  dataNascimento: string;
  dataAdmissao: string;
  tipoContrato: string;
  pcd: string;
  salario: string;
}

export interface NormalizedEmployee {
  registration: string;
  name: string;
  positionId: string | null;
  costCenterId: string | null;
  secondaryCostCenterId: string | null;
  managerId: string | null;
  unitId: string;
  gender: "MASCULINO" | "FEMININO" | "NAO_INFORMADO";
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  admissionDate: string;
  contractType: "CLT" | "PJ" | "APRENDIZ" | "ESTAGIO" | "TEMPORARIO";
  isPCD: boolean;
  baseSalary: number | null;
}

export interface RowResult {
  rowNumber: number;
  data: NormalizedEmployee | null;
  errors: string[];
}

const GENDER_MAP: Record<string, "MASCULINO" | "FEMININO" | "NAO_INFORMADO"> = {
  masculino: "MASCULINO",
  feminino: "FEMININO",
  m: "MASCULINO",
  f: "FEMININO",
};

const CONTRACT_MAP: Record<string, NormalizedEmployee["contractType"]> = {
  clt: "CLT",
  pj: "PJ",
  aprendiz: "APRENDIZ",
  estagio: "ESTAGIO",
  "estágio": "ESTAGIO",
  temporario: "TEMPORARIO",
  "temporário": "TEMPORARIO",
};

function norm(s: string | undefined | null): string {
  return (s ?? "").trim();
}

function findByName(list: { id: string; name: string }[], name: string): string | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const match = list.find((item) => item.name.trim().toLowerCase() === target);
  return match?.id ?? null;
}

/** Aceita dd/mm/aaaa ou aaaa-mm-dd e devolve sempre aaaa-mm-dd (formato de <input type="date">). */
function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, d, m, y] = br;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/**
 * Valida e normaliza uma linha da planilha de importação, tentando casar os
 * nomes digitados (cargo, unidade, gestor, centro de custo) com os cadastros
 * existentes. Nunca lança exceção — sempre retorna uma lista de erros legível
 * para o usuário corrigir a planilha e tentar de novo.
 */
export function validateBulkImportRow(row: BulkImportRow, rowNumber: number, refs: ReferenceLookups): RowResult {
  const errors: string[] = [];

  const registration = norm(row.matricula);
  if (!registration) errors.push("Matrícula é obrigatória");

  const name = norm(row.nome);
  if (name.length < 3) errors.push("Nome completo é obrigatório");

  const unitName = norm(row.unidade);
  const unitId = findByName(refs.units, unitName);
  if (!unitName) errors.push("Unidade é obrigatória");
  else if (!unitId) errors.push(`Unidade "${unitName}" não encontrada — cadastre-a antes ou confira a grafia`);

  const admissionRaw = norm(row.dataAdmissao);
  const admissionDate = parseDate(admissionRaw);
  if (!admissionRaw) errors.push("Data de admissão é obrigatória");
  else if (!admissionDate) errors.push(`Data de admissão "${admissionRaw}" inválida (use dd/mm/aaaa)`);

  const birthRaw = norm(row.dataNascimento);
  const birthDate = birthRaw ? parseDate(birthRaw) : null;
  if (birthRaw && !birthDate) errors.push(`Data de nascimento "${birthRaw}" inválida (use dd/mm/aaaa)`);

  const genderRaw = norm(row.genero).toLowerCase();
  const gender = genderRaw ? GENDER_MAP[genderRaw] : "NAO_INFORMADO";
  if (genderRaw && !gender) errors.push(`Gênero "${row.genero}" não reconhecido (use Masculino ou Feminino)`);

  const contractRaw = norm(row.tipoContrato).toLowerCase();
  const contractType = contractRaw ? CONTRACT_MAP[contractRaw] : "CLT";
  if (contractRaw && !contractType) errors.push(`Tipo de contrato "${row.tipoContrato}" não reconhecido`);

  const pcdRaw = norm(row.pcd).toLowerCase();
  const isPCD = pcdRaw === "sim" || pcdRaw === "s" || pcdRaw === "true";

  const emailRaw = norm(row.email);
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) errors.push(`E-mail "${emailRaw}" inválido`);

  const salaryRaw = norm(row.salario).replace(",", ".");
  const baseSalary = salaryRaw ? Number(salaryRaw) : null;
  if (salaryRaw && Number.isNaN(baseSalary)) errors.push(`Salário "${row.salario}" inválido`);

  const positionName = norm(row.cargo);
  const costCenterName = norm(row.centroCusto);
  const secondaryCostCenterName = norm(row.setorSecundario);
  const managerName = norm(row.gestor);

  if (positionName && !findByName(refs.positions, positionName)) {
    errors.push(`Cargo "${positionName}" não encontrado — cadastre-o antes ou confira a grafia`);
  }
  if (costCenterName && !findByName(refs.costCenters, costCenterName)) {
    errors.push(`Centro de custo "${costCenterName}" não encontrado — cadastre-o antes ou confira a grafia`);
  }
  if (managerName && !findByName(refs.managers, managerName)) {
    errors.push(`Gestor "${managerName}" não encontrado — cadastre-o antes ou confira a grafia`);
  }

  if (errors.length > 0) {
    return { rowNumber, data: null, errors };
  }

  return {
    rowNumber,
    errors: [],
    data: {
      registration,
      name,
      positionId: findByName(refs.positions, positionName),
      costCenterId: findByName(refs.costCenters, costCenterName),
      secondaryCostCenterId: findByName(refs.costCenters, secondaryCostCenterName),
      managerId: findByName(refs.managers, managerName),
      unitId: unitId!,
      gender: gender ?? "NAO_INFORMADO",
      phone: norm(row.telefone) || null,
      email: emailRaw || null,
      birthDate,
      admissionDate: admissionDate!,
      contractType: contractType ?? "CLT",
      isPCD,
      baseSalary: baseSalary ?? null,
    },
  };
}
