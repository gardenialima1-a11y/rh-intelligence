import { prisma } from "@/lib/prisma";

export interface AniversarianteRow {
  id: string;
  name: string;
  registration: string;
  position: string | null;
  costCenter: string | null;
  unit: string;
  date: Date;
  day: number;
  years: number;
}

async function fetchActiveWithDates() {
  return prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      registration: true,
      birthDate: true,
      admissionDate: true,
      position: { select: { name: true } },
      costCenter: { select: { name: true } },
      unit: { select: { name: true } },
    },
  });
}

export async function getBirthdaysThisMonth(month?: number): Promise<AniversarianteRow[]> {
  const targetMonth = month ?? new Date().getMonth();
  const employees = await fetchActiveWithDates();
  const now = new Date();

  return employees
    .filter((e) => e.birthDate && e.birthDate.getMonth() === targetMonth)
    .map((e) => ({
      id: e.id,
      name: e.name,
      registration: e.registration,
      position: e.position?.name ?? null,
      costCenter: e.costCenter?.name ?? null,
      unit: e.unit.name,
      date: e.birthDate!,
      day: e.birthDate!.getDate(),
      years: now.getFullYear() - e.birthDate!.getFullYear(),
    }))
    .sort((a, b) => a.day - b.day);
}

export interface TodayCelebration {
  id: string;
  name: string;
  photoUrl: string | null;
  position: string | null;
  unit: string;
  years: number;
}

/**
 * Aniversariantes de HOJE (data de nascimento e tempo de empresa). Como é
 * uma consulta ao vivo filtrada pelo dia/mês atuais, ela muda sozinha todo
 * dia — não precisa de nenhuma rotina agendada.
 */
export async function getTodaysCelebrations(): Promise<{ birthdays: TodayCelebration[]; workAnniversaries: TodayCelebration[] }> {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      birthDate: true,
      admissionDate: true,
      position: { select: { name: true } },
      unit: { select: { name: true } },
    },
  });

  const birthdays = employees
    .filter((e) => e.birthDate && e.birthDate.getDate() === day && e.birthDate.getMonth() === month)
    .map((e) => ({
      id: e.id,
      name: e.name,
      photoUrl: e.photoUrl,
      position: e.position?.name ?? null,
      unit: e.unit.name,
      years: now.getFullYear() - e.birthDate!.getFullYear(),
    }));

  const workAnniversaries = employees
    .filter(
      (e) =>
        e.admissionDate.getDate() === day &&
        e.admissionDate.getMonth() === month &&
        e.admissionDate.getFullYear() < now.getFullYear()
    )
    .map((e) => ({
      id: e.id,
      name: e.name,
      photoUrl: e.photoUrl,
      position: e.position?.name ?? null,
      unit: e.unit.name,
      years: now.getFullYear() - e.admissionDate.getFullYear(),
    }));

  return { birthdays, workAnniversaries };
}

export async function getWorkAnniversariesThisMonth(month?: number): Promise<AniversarianteRow[]> {
  const targetMonth = month ?? new Date().getMonth();
  const employees = await fetchActiveWithDates();
  const now = new Date();

  return employees
    .filter((e) => e.admissionDate.getMonth() === targetMonth && e.admissionDate.getFullYear() < now.getFullYear())
    .map((e) => ({
      id: e.id,
      name: e.name,
      registration: e.registration,
      position: e.position?.name ?? null,
      costCenter: e.costCenter?.name ?? null,
      unit: e.unit.name,
      date: e.admissionDate,
      day: e.admissionDate.getDate(),
      years: now.getFullYear() - e.admissionDate.getFullYear(),
    }))
    .sort((a, b) => a.day - b.day);
}
