"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import {
  buildHeaderMap,
  getField,
  parseHistoryDate,
  normalizeName,
  classifyVoluntary,
  syntheticRegistration,
  NAME_HEADERS,
  ADMISSION_HEADERS,
  ROLE_HEADERS,
  TERMINATION_HEADERS,
  REASON_HEADERS,
} from "@/lib/validation/termination-history";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar histórico de desligamentos.");
  }
}

interface Stint {
  admissionDate: Date;
  terminationDate: Date;
  role: string;
  reasonLabel: string;
}

export interface TerminationHistoryImportSummary {
  peopleProcessed: number;
  newEmployeesCreated: number;
  matchedExistingEmployees: number;
  movementsCreated: number;
  skippedInvalidRows: number;
  skippedNoName: number;
}

export async function importTerminationHistory(
  rows: Record<string, string>[]
): Promise<{ success: boolean; summary?: TerminationHistoryImportSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (rows.length === 0) return { success: false, error: "Nenhuma linha encontrada no arquivo." };

    // 1) Lê e agrupa as linhas por pessoa (mesma pessoa pode ter mais de uma
    // passagem pela empresa — entrou, saiu, foi recontratada, saiu de novo).
    const stintsByName = new Map<string, Stint[]>();
    const displayNameByKey = new Map<string, string>();
    let skippedInvalidRows = 0;
    let skippedNoName = 0;

    for (const row of rows) {
      const headerMap = buildHeaderMap(row);
      const rawName = getField(row, headerMap, NAME_HEADERS);
      if (!rawName) {
        skippedNoName += 1;
        continue;
      }
      const admissionDate = parseHistoryDate(getField(row, headerMap, ADMISSION_HEADERS));
      const terminationDate = parseHistoryDate(getField(row, headerMap, TERMINATION_HEADERS));
      const role = getField(row, headerMap, ROLE_HEADERS);
      const reasonLabel = getField(row, headerMap, REASON_HEADERS);

      if (!admissionDate || !terminationDate) {
        skippedInvalidRows += 1;
        continue;
      }

      const key = normalizeName(rawName);
      if (!displayNameByKey.has(key)) displayNameByKey.set(key, rawName);
      const stint: Stint = { admissionDate, terminationDate, role: role || "—", reasonLabel: reasonLabel || "Não informado" };
      const list = stintsByName.get(key) ?? [];
      list.push(stint);
      stintsByName.set(key, list);
    }

    // Ordena as passagens de cada pessoa por data, mais antiga primeiro.
    for (const stints of stintsByName.values()) {
      stints.sort((a, b) => a.admissionDate.getTime() - b.admissionDate.getTime());
    }

    // 2) Descobre quem já existe no cadastro (casando pelo nome), pra não
    // duplicar colaborador.
    const allEmployees = await prisma.employee.findMany({ select: { id: true, name: true } });
    const employeeIdByName = new Map(allEmployees.map((e) => [normalizeName(e.name), e.id]));

    // 3) Garante que todos os cargos (funções) da planilha existem.
    const distinctRoles = new Set<string>();
    for (const stints of stintsByName.values()) for (const s of stints) distinctRoles.add(s.role);
    const existingPositions = await prisma.position.findMany({ select: { id: true, name: true } });
    const positionIdByName = new Map(existingPositions.map((p) => [p.name.trim().toUpperCase(), p.id]));
    const rolesToCreate = Array.from(distinctRoles).filter((r) => !positionIdByName.has(r.trim().toUpperCase()));
    if (rolesToCreate.length > 0) {
      await prisma.position.createMany({ data: rolesToCreate.map((name) => ({ name })), skipDuplicates: true });
      const refreshed = await prisma.position.findMany({ where: { name: { in: rolesToCreate } }, select: { id: true, name: true } });
      for (const p of refreshed) positionIdByName.set(p.name.trim().toUpperCase(), p.id);
    }

    // 4) Garante que todos os motivos existem como Reason (categoria TURNOVER).
    const distinctReasons = new Set<string>();
    for (const stints of stintsByName.values()) for (const s of stints) distinctReasons.add(s.reasonLabel);
    const existingReasons = await prisma.reason.findMany({ where: { category: "TURNOVER" }, select: { id: true, label: true } });
    const reasonIdByLabel = new Map(existingReasons.map((r) => [r.label, r.id]));
    for (const label of distinctReasons) {
      if (reasonIdByLabel.has(label)) continue;
      const created = await prisma.reason.upsert({
        where: { category_label: { category: "TURNOVER", label } },
        create: { category: "TURNOVER", label },
        update: {},
      });
      reasonIdByLabel.set(label, created.id);
    }

    // 5) Unidade padrão pra colaboradores históricos (a planilha não informa
    // unidade). Usa a Matriz, ou a primeira unidade cadastrada se não achar.
    const defaultUnit = (await prisma.unit.findFirst({ where: { type: "MATRIZ" } })) ?? (await prisma.unit.findFirst());
    if (!defaultUnit) return { success: false, error: "Cadastre ao menos uma unidade antes de importar." };

    // 6) Cria os colaboradores históricos que ainda não existem (matrícula
    // sintética e estável — reimportar a mesma planilha não duplica ninguém).
    let newEmployeesCreated = 0;
    let matchedExistingEmployees = 0;
    const newEmployeeData: {
      registration: string;
      name: string;
      positionId: string;
      unitId: string;
      admissionDate: Date;
      terminationDate: Date;
      isActive: boolean;
    }[] = [];

    for (const [key, stints] of stintsByName.entries()) {
      if (employeeIdByName.has(key)) {
        matchedExistingEmployees += 1;
        continue;
      }
      const last = stints[stints.length - 1];
      newEmployeeData.push({
        registration: syntheticRegistration(key),
        name: displayNameByKey.get(key) ?? key,
        positionId: positionIdByName.get(last.role.trim().toUpperCase())!,
        unitId: defaultUnit.id,
        admissionDate: last.admissionDate,
        terminationDate: last.terminationDate,
        isActive: false,
      });
    }

    if (newEmployeeData.length > 0) {
      await prisma.employee.createMany({ data: newEmployeeData, skipDuplicates: true });
      newEmployeesCreated = newEmployeeData.length;
      const refreshed = await prisma.employee.findMany({
        where: { registration: { in: newEmployeeData.map((e) => e.registration) } },
        select: { id: true, name: true },
      });
      for (const e of refreshed) employeeIdByName.set(normalizeName(e.name), e.id);
    }

    // 7) Cria as movimentações (admissão + desligamento) de cada passagem,
    // evitando duplicar quem já tinha movimentação nessa data exata.
    const relevantEmployeeIds = Array.from(stintsByName.keys())
      .map((key) => employeeIdByName.get(key))
      .filter((id): id is string => Boolean(id));

    const existingMovements = await prisma.movement.findMany({
      where: { employeeId: { in: relevantEmployeeIds } },
      select: { employeeId: true, type: true, date: true },
    });
    const existingKeysByEmployee = new Map<string, Set<string>>();
    for (const m of existingMovements) {
      const set = existingKeysByEmployee.get(m.employeeId) ?? new Set<string>();
      set.add(m.type + "|" + m.date.toISOString().slice(0, 10));
      existingKeysByEmployee.set(m.employeeId, set);
    }

    let movementsCreated = 0;
    const allMovementsToCreate: { date: Date; employeeId: string; type: MovementType; reasonId: string | null; voluntary: boolean | null }[] = [];

    for (const [key, stints] of stintsByName.entries()) {
      const employeeId = employeeIdByName.get(key);
      if (!employeeId) continue;

      const existingKeys = existingKeysByEmployee.get(employeeId) ?? new Set<string>();

      for (const s of stints) {
        const admKey = "ADMISSAO|" + s.admissionDate.toISOString().slice(0, 10);
        if (!existingKeys.has(admKey)) {
          allMovementsToCreate.push({ date: s.admissionDate, employeeId, type: MovementType.ADMISSAO, reasonId: null, voluntary: null });
          existingKeys.add(admKey);
        }
        const demKey = "DESLIGAMENTO|" + s.terminationDate.toISOString().slice(0, 10);
        if (!existingKeys.has(demKey)) {
          allMovementsToCreate.push({
            date: s.terminationDate,
            employeeId,
            type: MovementType.DESLIGAMENTO,
            reasonId: reasonIdByLabel.get(s.reasonLabel) ?? null,
            voluntary: classifyVoluntary(s.reasonLabel),
          });
          existingKeys.add(demKey);
        }
      }
    }

    if (allMovementsToCreate.length > 0) {
      await prisma.movement.createMany({ data: allMovementsToCreate });
      movementsCreated = allMovementsToCreate.length;
    }

    revalidatePath("/modulos/desligamentos");
    revalidatePath("/modulos/turnover");
    revalidatePath("/modulos/colaboradores");

    return {
      success: true,
      summary: {
        peopleProcessed: stintsByName.size,
        newEmployeesCreated,
        matchedExistingEmployees,
        movementsCreated,
        skippedInvalidRows,
        skippedNoName,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar histórico de desligamentos." };
  }
}
