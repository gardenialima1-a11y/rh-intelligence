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
 * matrícula exata (ex.: "1105.jpg"), depois por nome completo exato, e por
 * último por nome no COMEÇO do arquivo (ex.: "Igor Victor Maciel Simão_imagem_das_07_12.jpg"),
 * ignorando acentos, maiúsculas e pontuação. No caso de nome no começo, usa o
 * colaborador com o nome mais longo que bater, pra evitar confundir nomes parecidos.
 */
export function matchPhotoFileName(fileName: string, employees: EmployeeForMatch[]): PhotoMatchResult {
  const key = stripExtension(fileName);

  const byRegistration = employees.find((e) => e.registration.trim() === key.trim());
  if (byRegistration) {
    return { fileName, employeeId: byRegistration.id, employeeName: byRegistration.name };
  }

  const normalizedKey = normalizeName(key);
  const byExactName = employees.find((e) => normalizeName(e.name) === normalizedKey);
  if (byExactName) {
    return { fileName, employeeId: byExactName.id, employeeName: byExactName.name };
  }

  const keyWords = normalizedKey.split(" ");
  const prefixMatches = employees.filter((e) => {
    const nameWords = normalizeName(e.name).split(" ");
    if (nameWords.length === 0 || nameWords.length > keyWords.length) return false;
    return nameWords.every((word, i) => keyWords[i] === word);
  });
  if (prefixMatches.length > 0) {
    const best = prefixMatches.sort((a, b) => b.name.length - a.name.length)[0];
    return { fileName, employeeId: best.id, employeeName: best.name };
  }

  return { fileName, employeeId: null, employeeName: null };
}
