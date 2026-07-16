export interface EmployeeForMatch {
  id: string;
  registration: string;
  name: string;
}

export interface PhotoMatchResult {
  fileName: string;
  employeeId: string | null;
  employeeName: string | null;
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

/** Tira a extensão do arquivo (".jpg", ".png"...) e espaços nas pontas. */
function stripExtension(fileName: string): string {
  return fileName.replace(/\.[a-zA-Z0-9]+$/, "").trim();
}

/**
 * Casa o nome de um arquivo de foto com um colaborador, tentando primeiro por
 * matrícula exata (ex.: "1105.jpg") e depois por nome (ex.: "Abraham Lincol
 * Rodrigues da Silva.jpg"), ignorando acentos, maiúsculas e pontuação.
 */
export function matchPhotoFileName(fileName: string, employees: EmployeeForMatch[]): PhotoMatchResult {
  const key = stripExtension(fileName);

  const byRegistration = employees.find((e) => e.registration.trim() === key.trim());
  if (byRegistration) {
    return { fileName, employeeId: byRegistration.id, employeeName: byRegistration.name };
  }

  const normalizedKey = normalizeName(key);
  const byName = employees.find((e) => normalizeName(e.name) === normalizedKey);
  if (byName) {
    return { fileName, employeeId: byName.id, employeeName: byName.name };
  }

  return { fileName, employeeId: null, employeeName: null };
}
