/**
 * Base local com os CIDs (CID-10) mais comuns em atestados médicos no
 * ambiente de trabalho. NÃO é a tabela oficial completa do DATASUS (que
 * tem ~14.000 códigos) — é uma lista curada dos mais frequentes, pra dar
 * uma resposta rápida sem depender de internet. Se o código digitado não
 * estiver aqui, o campo mostra "não encontrado" e a pessoa pode preencher
 * a descrição na mão.
 */
export const CID_DATABASE: Record<string, string> = {
  // Doenças infecciosas e parasitárias
  A00: "Cólera",
  A09: "Diarreia e gastroenterite de origem infecciosa presumível",
  A90: "Dengue [dengue clássico]",
  A91: "Febre hemorrágica devida ao vírus do dengue",
  B34: "Infecção viral de localização não especificada",

  // Neoplasias (exemplos comuns)
  C50: "Neoplasia maligna da mama",
  D50: "Anemia por deficiência de ferro",

  // Doenças do sangue
  D64: "Outras anemias",

  // Transtornos mentais e comportamentais
  F32: "Episódios depressivos",
  F33: "Transtorno depressivo recorrente",
  F41: "Outros transtornos ansiosos",
  F43: "Reação a estresse grave e transtornos de adaptação (inclui burnout/estresse ocupacional)",
  F51: "Distúrbios não orgânicos do sono",

  // Doenças do sistema nervoso
  G43: "Enxaqueca",
  G47: "Distúrbios do sono",

  // Doenças do olho
  H10: "Conjuntivite",
  H52: "Transtornos da refração e da acomodação",

  // Doenças do ouvido
  H66: "Otite média supurativa e a não especificada",
  H81: "Transtornos da função vestibular (labirintite)",

  // Doenças do aparelho circulatório
  I10: "Hipertensão essencial (primária)",
  I20: "Angina pectoris",
  I21: "Infarto agudo do miocárdio",
  I83: "Varizes dos membros inferiores",

  // Doenças do aparelho respiratório
  J00: "Nasofaringite aguda [resfriado comum]",
  J01: "Sinusite aguda",
  J02: "Faringite aguda",
  J03: "Amigdalite aguda",
  J06: "Infecções agudas das vias aéreas superiores de localizações múltiplas ou não especificadas",
  J11: "Influenza [gripe], vírus não identificado",
  J18: "Pneumonia por microrganismo não especificado",
  J20: "Bronquite aguda",
  J30: "Rinite alérgica e vasomotora",
  J45: "Asma",

  // Doenças do aparelho digestivo
  K02: "Cárie dentária",
  K04: "Doenças da polpa e dos tecidos periapicais",
  K05: "Gengivite e doenças periodontais",
  K08: "Outros transtornos dos dentes e de suas estruturas de sustentação",
  K21: "Doença de refluxo gastroesofágico",
  K29: "Gastrite e duodenite",
  K35: "Apendicite aguda",
  K52: "Outras gastroenterites e colites não infecciosas",
  K59: "Outros transtornos funcionais do intestino (inclui constipação)",

  // Doenças da pele
  L01: "Impetigo",
  L03: "Celulite",
  L20: "Dermatite atópica",
  L23: "Dermatite alérgica de contato",
  L50: "Urticária",

  // Doenças do sistema osteomuscular
  M25: "Outros transtornos articulares não classificados em outra parte",
  M51: "Outros transtornos de discos intervertebrais",
  M54: "Dorsalgia (dor nas costas)",
  M65: "Sinovite e tenossinovite",
  M75: "Lesões do ombro",
  M77: "Outras entesopatias (inclui epicondilite)",
  M79: "Outros transtornos dos tecidos moles não classificados em outra parte",

  // Doenças do aparelho geniturinário
  N30: "Cistite",
  N39: "Outros transtornos do trato urinário (inclui infecção urinária de localização não especificada)",

  // Gravidez, parto e puerpério
  O20: "Hemorragia no início da gravidez",
  O21: "Vômitos excessivos na gravidez",
  O26: "Assistência prestada à mãe por outros motivos relacionados predominantemente com a gravidez",
  O80: "Parto único espontâneo",

  // Sintomas e sinais gerais
  R10: "Dor abdominal e pélvica",
  R11: "Náusea e vômitos",
  R50: "Febre de origem desconhecida",
  R51: "Cefaleia",
  R53: "Mal-estar e fadiga",

  // Lesões, envenenamentos e traumas
  S00: "Traumatismo superficial da cabeça",
  S06: "Traumatismo intracraniano",
  S52: "Fratura do antebraço",
  S82: "Fratura da perna, inclusive tornozelo",
  S93: "Luxação, entorse e distensão nas articulações do tornozelo e do pé",
  T14: "Traumatismo de região não especificada do corpo",

  // Causas externas
  V89: "Acidente de transporte não especificado",
  W19: "Queda não especificada",

  // Fatores que influenciam o estado de saúde (consultas, acompanhamento)
  Z00: "Exame geral e investigação de pessoas sem queixas ou diagnóstico relatado",
  Z01: "Outros exames especiais e investigações em pessoas sem queixas ou diagnóstico relatado",
  Z03: "Observação e avaliação médica por doenças e afecções suspeitas",
  Z34: "Supervisão de gravidez normal",
  Z76: "Pessoas em contato com serviços de saúde em outras circunstâncias",

  // Códigos especiais
  U07: "COVID-19",
};

/** Normaliza "M54.5", "m545", " M54 " etc. para "M545" / "M54" pra buscar na base. */
function normalizeCid(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Busca a descrição de um CID. Tenta o código completo primeiro (ex.: M545)
 * e, se não achar, cai pra categoria de 3 caracteres (ex.: M54) — a maior
 * parte da nossa base está nesse nível.
 */
export function lookupCid(raw: string): { code: string; description: string } | null {
  const normalized = normalizeCid(raw);
  if (normalized.length < 3) return null;

  if (CID_DATABASE[normalized]) {
    return { code: normalized, description: CID_DATABASE[normalized] };
  }

  const category = normalized.slice(0, 3);
  if (CID_DATABASE[category]) {
    return { code: category, description: CID_DATABASE[category] };
  }

  return null;
}
