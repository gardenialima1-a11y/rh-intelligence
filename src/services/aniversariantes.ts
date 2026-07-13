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
