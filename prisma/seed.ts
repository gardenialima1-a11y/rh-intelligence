import { PrismaClient, MovementType, FunnelStage, ContractType, Gender, Severity } from "@prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

faker.seed(2026);

const prisma = new PrismaClient();

const AREAS = ["Comercial", "Produção", "Logística", "Administrativo"] as const;

const POSITIONS = [
  { name: "Auxiliar de Produção", level: "Operacional", salaryFloor: 1600, salaryCeil: 2100 },
  { name: "Operador de Máquina", level: "Operacional", salaryFloor: 1800, salaryCeil: 2400 },
  { name: "Auxiliar Logístico", level: "Operacional", salaryFloor: 1600, salaryCeil: 2000 },
  { name: "Motorista Entregador", level: "Operacional", salaryFloor: 2000, salaryCeil: 2800 },
  { name: "Vendedor Externo", level: "Operacional", salaryFloor: 1900, salaryCeil: 3200 },
  { name: "Analista Administrativo", level: "Tático", salaryFloor: 2500, salaryCeil: 3800 },
  { name: "Analista de RH", level: "Tático", salaryFloor: 2800, salaryCeil: 4200 },
  { name: "Analista Comercial", level: "Tático", salaryFloor: 2800, salaryCeil: 4200 },
  { name: "Supervisor de Produção", level: "Liderança", salaryFloor: 4000, salaryCeil: 5500 },
  { name: "Supervisor de Logística", level: "Liderança", salaryFloor: 4000, salaryCeil: 5500 },
  { name: "Coordenador Comercial", level: "Liderança", salaryFloor: 5500, salaryCeil: 7500 },
  { name: "Gerente Industrial", level: "Gerência", salaryFloor: 9000, salaryCeil: 13000 },
  { name: "Gerente Comercial", level: "Gerência", salaryFloor: 9000, salaryCeil: 13000 },
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randomInt(min: number, max: number) {
  return Math.floor(randomBetween(min, max + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}
function weightedBool(pTrue: number) {
  return Math.random() < pTrue;
}

async function main() {
  console.log("Seed iniciado...");

  // ---------------------------------------------------------------------
  // Empresa / Unidades / Centros de Custo / Cargos / Gestores
  // ---------------------------------------------------------------------
  const company = await prisma.company.create({
    data: { name: "Gosto Mineiro Alimentos S.A." },
  });

  const units = await Promise.all(
    [
      { name: "Matriz Fortaleza", city: "Fortaleza", state: "CE" },
      { name: "Fábrica Maracanaú", city: "Maracanaú", state: "CE" },
      { name: "CD Região Metropolitana", city: "Fortaleza", state: "CE" },
    ].map((u) => prisma.unit.create({ data: { ...u, companyId: company.id } }))
  );

  const costCenters = await Promise.all(
    AREAS.map((area, i) =>
      prisma.costCenter.create({
        data: { code: `CC-0${i + 1}`, name: area, area },
      })
    )
  );

  const positions = await Promise.all(
    POSITIONS.map((p) => prisma.position.create({ data: p }))
  );

  const managers = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      prisma.manager.create({
        data: {
          name: faker.person.fullName(),
          area: pick(AREAS),
          level: i < 3 ? "Gerência" : "Liderança",
        },
      })
    )
  );

  const reasonsTurnover = await Promise.all(
    ["Melhor proposta salarial", "Baixo desempenho", "Redução de quadro", "Questões pessoais", "Conflito com liderança", "Fim de contrato temporário"].map(
      (label) => prisma.reason.create({ data: { category: "TURNOVER", label } })
    )
  );

  const reasonsAbsence = await Promise.all(
    ["Atestado médico", "Falta injustificada", "Licença maternidade/paternidade", "Acompanhante", "Atraso convertido em falta"].map(
      (label) => prisma.reason.create({ data: { category: "AFASTAMENTO", label } })
    )
  );

  const reasonsCompliance = await Promise.all(
    ["Atraso reincidente", "Descumprimento de procedimento de segurança", "Conduta inadequada", "Ausência não comunicada"].map(
      (label) => prisma.reason.create({ data: { category: "ADVERTENCIA", label } })
    )
  );

  // ---------------------------------------------------------------------
  // Colaboradores
  // ---------------------------------------------------------------------
  const TOTAL_EMPLOYEES = 180;
  const now = new Date();
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(now.getFullYear() - 5);

  type EmployeeSeed = Awaited<ReturnType<typeof prisma.employee.create>>;
  const employees: EmployeeSeed[] = [];

  for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
    const position = pick(positions);
    const unit = pick(units);
    const costCenter = costCenters.find((c) => c.area === (position.level === "Operacional" ? pick(AREAS) : pick(AREAS))) ?? pick(costCenters);
    const manager = pick(managers);
    const admissionDate = faker.date.between({ from: fiveYearsAgo, to: now });
    const isTerminated = weightedBool(0.22);
    const terminationDate = isTerminated
      ? faker.date.between({ from: admissionDate, to: now })
      : null;
    const gender = pick([Gender.MASCULINO, Gender.FEMININO] as const);
    const contractType = weightedBool(0.9)
      ? ContractType.CLT
      : pick([ContractType.APRENDIZ, ContractType.ESTAGIO, ContractType.PJ] as const);

    const employee = await prisma.employee.create({
      data: {
        registration: `GM${String(1000 + i)}`,
        name: faker.person.fullName({ sex: gender === Gender.MASCULINO ? "male" : "female" }),
        positionId: position.id,
        costCenterId: costCenter.id,
        managerId: manager.id,
        unitId: unit.id,
        gender,
        birthDate: faker.date.birthdate({ min: 19, max: 58, mode: "age" }),
        admissionDate,
        terminationDate: terminationDate ?? undefined,
        contractType,
        isPCD: weightedBool(0.04),
        isActive: !isTerminated,
      },
    });
    employees.push(employee);
  }
  console.log(`  ${employees.length} colaboradores criados.`);

  // Movimentações (admissão / desligamento)
  const movementsData = [];
  for (const emp of employees) {
    movementsData.push({
      date: emp.admissionDate,
      employeeId: emp.id,
      type: MovementType.ADMISSAO,
    });
    if (emp.terminationDate) {
      const voluntary = weightedBool(0.6);
      movementsData.push({
        date: emp.terminationDate,
        employeeId: emp.id,
        type: MovementType.DESLIGAMENTO,
        reasonId: pick(reasonsTurnover).id,
        voluntary,
        costValue: randomBetween(1500, 6000),
      });
    }
  }

  // Movimentações internas (promoção / transferência) — colaboradores ativos com
  // tempo de casa >= 12 meses têm chance de ter sido promovidos ou transferidos.
  for (const emp of employees) {
    if (!emp.isActive) continue;
    const tenureMonths = (now.getFullYear() - emp.admissionDate.getFullYear()) * 12 + (now.getMonth() - emp.admissionDate.getMonth());
    if (tenureMonths < 12) continue;
    if (weightedBool(0.22)) {
      const eventDate = faker.date.between({ from: new Date(emp.admissionDate.getTime() + 180 * 86400000), to: now });
      movementsData.push({
        date: eventDate,
        employeeId: emp.id,
        type: weightedBool(0.7) ? MovementType.PROMOCAO : MovementType.TRANSFERENCIA,
      });
    }
  }

  await prisma.movement.createMany({ data: movementsData });
  console.log(`  ${movementsData.length} movimentações registradas.`);

  // ---------------------------------------------------------------------
  // Jornada / Ponto (últimos 90 dias, dias úteis) — apenas ativos
  // ---------------------------------------------------------------------
  const activeEmployees = employees.filter((e) => e.isActive);
  const timeEntries = [];
  for (let d = 0; d < 90; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // pula fim de semana
    for (const emp of activeEmployees) {
      if (emp.admissionDate > date) continue;
      const scheduledHours = 8;
      const overtimeHours = weightedBool(0.15) ? randomBetween(0.5, 3) : 0;
      const workedHours = scheduledHours + overtimeHours - (weightedBool(0.03) ? randomBetween(1, 8) : 0);
      timeEntries.push({
        date,
        employeeId: emp.id,
        scheduledHours,
        workedHours: Math.max(0, workedHours),
        overtimeHours,
        bankHoursDelta: overtimeHours - (weightedBool(0.3) ? randomBetween(0, 2) : 0),
      });
    }
  }
  // Insere em lotes para não estourar limite de parâmetros
  const TIME_BATCH = 2000;
  for (let i = 0; i < timeEntries.length; i += TIME_BATCH) {
    await prisma.timeEntry.createMany({ data: timeEntries.slice(i, i + TIME_BATCH) });
  }
  console.log(`  ${timeEntries.length} registros de ponto criados.`);

  // ---------------------------------------------------------------------
  // Absenteísmo (últimos 180 dias)
  // ---------------------------------------------------------------------
  const absences = [];
  for (const emp of activeEmployees) {
    const occurrences = randomInt(0, 4);
    for (let k = 0; k < occurrences; k++) {
      const date = faker.date.recent({ days: 180 });
      if (emp.admissionDate > date) continue;
      absences.push({
        date,
        employeeId: emp.id,
        reasonId: pick(reasonsAbsence).id,
        cid: weightedBool(0.5) ? `M${randomInt(10, 99)}` : null,
        hoursLost: pick([8, 4, 8, 8, 16, 24]),
        hasCertificate: weightedBool(0.6),
      });
    }
  }
  await prisma.absence.createMany({ data: absences });
  console.log(`  ${absences.length} registros de afastamento criados.`);

  // ---------------------------------------------------------------------
  // Catraca (últimos 30 dias) — tempo fora do posto
  // ---------------------------------------------------------------------
  const turnstileEvents = [];
  for (let d = 0; d < 30; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    for (const emp of activeEmployees) {
      if (emp.admissionDate > date) continue;
      if (!weightedBool(0.7)) continue; // nem todo colaborador tem evento catraca todo dia
      const baseEntry = new Date(date);
      baseEntry.setHours(7, randomInt(45, 59), 0);
      const baseExit = new Date(date);
      baseExit.setHours(17, randomInt(0, 30), 0);
      turnstileEvents.push({ employeeId: emp.id, timestamp: baseEntry, direction: "ENTRADA", location: "Portaria Principal" });
      turnstileEvents.push({ employeeId: emp.id, timestamp: baseExit, direction: "SAIDA", location: "Portaria Principal" });
    }
  }
  const TURN_BATCH = 2000;
  for (let i = 0; i < turnstileEvents.length; i += TURN_BATCH) {
    await prisma.turnstileEvent.createMany({ data: turnstileEvents.slice(i, i + TURN_BATCH) });
  }
  console.log(`  ${turnstileEvents.length} eventos de catraca criados.`);

  // ---------------------------------------------------------------------
  // Recrutamento & Seleção
  // ---------------------------------------------------------------------
  const vacancies = ["Analista de RH Pleno", "Operador de Máquina", "Motorista Entregador", "Supervisor de Produção", "Analista Comercial", "Auxiliar Logístico"];
  const candidates = [];
  for (let i = 0; i < 60; i++) {
    const vacancy = pick(vacancies);
    const openedAt = faker.date.recent({ days: 120 });
    const stage = pick(Object.values(FunnelStage));
    const hiredAt = stage === "CONTRATADO" ? faker.date.between({ from: openedAt, to: now }) : null;
    const daysOpen = (now.getTime() - openedAt.getTime()) / 86400000;
    candidates.push({
      name: faker.person.fullName(),
      source: pick(["LinkedIn", "Indicação", "Gupy", "Feira de Emprego", "Banco de Talentos"]),
      vacancy,
      openedAt,
      hiredAt: hiredAt ?? undefined,
      stage,
      isCritical: daysOpen > 45 && stage !== "CONTRATADO" && stage !== "REPROVADO",
      costToHire: hiredAt ? randomBetween(300, 2500) : null,
    });
  }
  await prisma.candidate.createMany({ data: candidates });
  console.log(`  ${candidates.length} candidatos criados.`);

  // ---------------------------------------------------------------------
  // Treinamento & Desenvolvimento
  // ---------------------------------------------------------------------
  const trainingTitles = ["Integração de Novos Colaboradores", "NR-12 Segurança em Máquinas", "Boas Práticas de Fabricação (BPF)", "Liderança para Supervisores", "Excel Aplicado a RH"];
  const trainings = [];
  for (const emp of faker.helpers.arrayElements(activeEmployees, Math.floor(activeEmployees.length * 0.6))) {
    const title = pick(trainingTitles);
    const isMandatory = title.includes("NR-12") || title.includes("BPF");
    trainings.push({
      employeeId: emp.id,
      title,
      hours: pick([2, 4, 8, 16]),
      cost: randomBetween(0, 300),
      isMandatory,
      completedAt: faker.date.recent({ days: 200 }),
      expiresAt: isMandatory ? faker.date.soon({ days: 200 }) : null,
      effectivenessScore: randomBetween(6, 10),
    });
  }
  await prisma.trainingRecord.createMany({ data: trainings });
  console.log(`  ${trainings.length} registros de treinamento criados.`);

  // ---------------------------------------------------------------------
  // Avaliação de Desempenho
  // ---------------------------------------------------------------------
  const reviews = [];
  for (const emp of faker.helpers.arrayElements(activeEmployees, Math.floor(activeEmployees.length * 0.7))) {
    reviews.push({
      employeeId: emp.id,
      cycle: "2026-S1",
      score: Number(randomBetween(2.5, 5).toFixed(1)),
      boxLabel: pick(["Alto Desempenho / Alto Potencial", "Mantenedor", "Enigma", "Risco", "Forte Execução"]),
      pdiStatus: pick(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO"]),
      reviewedAt: faker.date.recent({ days: 120 }),
    });
  }
  await prisma.performanceReview.createMany({ data: reviews });
  console.log(`  ${reviews.length} avaliações de desempenho criadas.`);

  // ---------------------------------------------------------------------
  // Clima Organizacional / eNPS — ciclo PCO 2026
  // ---------------------------------------------------------------------
  const dimensions = ["Liderança", "Reconhecimento", "Comunicação", "Ambiente de Trabalho", "Desenvolvimento", "Recomendaria a Empresa (eNPS)"];
  const climateResponses = [];
  for (let i = 0; i < 420; i++) {
    const isEnpsQuestion = weightedBool(1 / dimensions.length);
    const score = weightedBool(0.62)
      ? randomInt(9, 10)
      : weightedBool(0.75)
      ? randomInt(7, 8)
      : randomInt(0, 6);
    climateResponses.push({
      cycle: "PCO 2026",
      dimension: isEnpsQuestion ? "Recomendaria a Empresa (eNPS)" : pick(dimensions),
      question: isEnpsQuestion
        ? "Em uma escala de 0 a 10, o quanto você recomendaria a empresa como um bom lugar para trabalhar?"
        : "Avalie sua satisfação com esta dimensão.",
      score,
      area: pick(AREAS),
      unitId: pick(units).id,
    });
  }
  await prisma.climateSurveyResponse.createMany({ data: climateResponses });
  console.log(`  ${climateResponses.length} respostas de clima organizacional criadas.`);

  // ---------------------------------------------------------------------
  // Saúde e Segurança do Trabalho
  // ---------------------------------------------------------------------
  const incidents = [];
  for (let i = 0; i < 14; i++) {
    const emp = pick(activeEmployees);
    incidents.push({
      employeeId: emp.id,
      date: faker.date.recent({ days: 365 }),
      type: weightedBool(0.7) ? "NEAR_MISS" : "ACIDENTE",
      hasCAT: weightedBool(0.25),
      daysLost: weightedBool(0.3) ? randomInt(1, 15) : 0,
      description: "Ocorrência registrada durante rotina operacional.",
    });
  }
  await prisma.safetyIncident.createMany({ data: incidents });
  console.log(`  ${incidents.length} ocorrências de SST criadas.`);

  // ---------------------------------------------------------------------
  // Folha / Custos de Pessoal + Receita (últimos 12 meses)
  // ---------------------------------------------------------------------
  const positionById = new Map(positions.map((p) => [p.id, p]));
  const payrollEntries = [];
  const revenueEntries = [];
  for (let m = 11; m >= 0; m--) {
    const competence = new Date(now.getFullYear(), now.getMonth() - m, 1);
    let totalMonthCost = 0;

    for (const emp of employees) {
      if (emp.admissionDate > competence) continue;
      if (emp.terminationDate && emp.terminationDate < competence) continue;
      const position = emp.positionId ? positionById.get(emp.positionId) : undefined;
      const base = position ? randomBetween(position.salaryFloor, position.salaryCeil) : 2200;
      const benefitsCost = base * 0.18;
      const chargesCost = base * 0.42;
      const totalCost = base + benefitsCost + chargesCost;
      totalMonthCost += totalCost;
      payrollEntries.push({
        employeeId: emp.id,
        competence,
        baseSalary: Number(base.toFixed(2)),
        benefitsCost: Number(benefitsCost.toFixed(2)),
        chargesCost: Number(chargesCost.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
      });
    }

    revenueEntries.push({
      competence,
      amount: Number((totalMonthCost / randomBetween(0.28, 0.34)).toFixed(2)),
    });
  }
  const PAYROLL_BATCH = 2000;
  for (let i = 0; i < payrollEntries.length; i += PAYROLL_BATCH) {
    await prisma.payrollEntry.createMany({ data: payrollEntries.slice(i, i + PAYROLL_BATCH) });
  }
  await prisma.revenueEntry.createMany({ data: revenueEntries });
  console.log(`  ${payrollEntries.length} lançamentos de folha e ${revenueEntries.length} lançamentos de receita criados.`);

  // ---------------------------------------------------------------------
  // Compliance Trabalhista
  // ---------------------------------------------------------------------
  const complianceEvents = [];
  for (let i = 0; i < 10; i++) {
    const emp = pick(activeEmployees);
    complianceEvents.push({
      employeeId: emp.id,
      date: faker.date.recent({ days: 300 }),
      type: pick(["ADVERTENCIA", "ADVERTENCIA", "SUSPENSAO", "PROCESSO"]),
      reasonId: pick(reasonsCompliance).id,
      estimatedCost: weightedBool(0.3) ? randomBetween(2000, 20000) : null,
    });
  }
  await prisma.complianceEvent.createMany({ data: complianceEvents });
  console.log(`  ${complianceEvents.length} eventos de compliance criados.`);

  // ---------------------------------------------------------------------
  // Alertas e Metas
  // ---------------------------------------------------------------------
  await prisma.alert.createMany({
    data: [
      {
        moduleKey: "turnover",
        title: "Turnover acima da meta em Produção",
        description: "O turnover da área de Produção ultrapassou a meta trimestral estabelecida.",
        severity: Severity.CRITICO,
      },
      {
        moduleKey: "recrutamento",
        title: "Vagas críticas há mais de 45 dias",
        description: "Existem vagas em aberto há mais de 45 dias sem preenchimento.",
        severity: Severity.ATENCAO,
      },
      {
        moduleKey: "absenteismo",
        title: "Absenteísmo em alta na Logística",
        description: "Taxa de absenteísmo do setor de Logística subiu nas últimas semanas.",
        severity: Severity.ATENCAO,
      },
      {
        moduleKey: "treinamento",
        title: "Certificações de NR-12 a vencer",
        description: "Um grupo de colaboradores possui certificação de NR-12 vencendo nos próximos 30 dias.",
        severity: Severity.ATENCAO,
      },
      {
        moduleKey: "clima",
        title: "eNPS estável no ciclo PCO 2026",
        description: "O eNPS do ciclo atual manteve-se dentro da faixa saudável (>50).",
        severity: Severity.OK,
      },
      {
        moduleKey: "people-analytics",
        title: "Flight Risk identificou colaboradores em risco alto",
        description: "O modelo de risco de saída sinalizou colaboradores com score alto — revisar plano de retenção.",
        severity: Severity.ATENCAO,
      },
      {
        moduleKey: "diversidade",
        title: "Gap salarial de gênero acima do limiar em cargos operacionais",
        description: "Um ou mais cargos apresentam diferença salarial de gênero acima de 5%, limiar de atenção de mercado.",
        severity: Severity.ATENCAO,
      },
    ],
  });

  await prisma.goal.createMany({
    data: [
      { moduleKey: "turnover", indicator: "turnover_geral", targetValue: 0.02, comparator: "LTE", periodYear: 2026 },
      { moduleKey: "absenteismo", indicator: "taxa_absenteismo", targetValue: 0.03, comparator: "LTE", periodYear: 2026 },
      { moduleKey: "clima", indicator: "enps", targetValue: 50, comparator: "GTE", periodYear: 2026 },
      { moduleKey: "recrutamento", indicator: "time_to_hire", targetValue: 30, comparator: "LTE", periodYear: 2026 },
      { moduleKey: "lideranca", indicator: "taxa_mobilidade_interna", targetValue: 0.08, comparator: "GTE", periodYear: 2026 },
      { moduleKey: "diversidade", indicator: "gap_salarial_genero", targetValue: 5, comparator: "LTE", periodYear: 2026 },
    ],
  });

  // ---------------------------------------------------------------------
  // Usuários de acesso à plataforma
  // ---------------------------------------------------------------------
  const passwordHash = await bcrypt.hash("senha123", 10);
  await prisma.user.createMany({
    data: [
      { name: "Administrador da Plataforma", email: "admin@gostomineiro.com.br", passwordHash, role: "ADMINISTRADOR", unitId: units[0].id },
      { name: "Gardenia (RH Business Partner)", email: "gardenia@gostomineiro.com.br", passwordHash, role: "RH", unitId: units[0].id },
      { name: "Diretoria Executiva", email: "diretoria@gostomineiro.com.br", passwordHash, role: "DIRETORIA", unitId: units[0].id },
      { name: "Gestor de Produção", email: "gestor.producao@gostomineiro.com.br", passwordHash, role: "GESTOR", unitId: units[1].id },
    ],
  });

  console.log("Seed concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
