/**
 * Reconhecimento de colunas da planilha de benefícios pagos fora da folha
 * (auxílio combustível, ajuda de custo, cesta básica, etc). Layout esperado:
 * uma linha por colaborador, uma coluna por tipo de benefício — igual a
 * planilha que a maioria das empresas já mantém pra isso. Colunas que o
 * sistema não reconhece são ignoradas (não dá erro).
 */

export interface ExtraBenefitCategoryDef {
  /** Nome "oficial" da categoria — é o que fica salvo no banco e aparece nos relatórios. */
  categoria: string;
  /** Variações de nome de coluna aceitas na planilha (sem distinguir maiúsc/minúsc ou acento). */
  headers: string[];
}

export const EXTRA_BENEFIT_CATEGORIES: ExtraBenefitCategoryDef[] = [
  { categoria: "Auxílio Combustível", headers: ["Auxílio Combustível", "Auxilio Combustivel", "Combustível", "Combustivel", "Aux. Combustível"] },
  { categoria: "Ajuda de Custo", headers: ["Ajuda de Custo", "Ajuda Custo"] },
  { categoria: "Cesta Básica", headers: ["Cesta Básica", "Cesta Basica"] },
  { categoria: "Vale Alimentação", headers: ["Vale Alimentação", "Vale Alimentacao", "VA"] },
  { categoria: "Premiação Comercial", headers: ["Premiação Comercial", "Premiacao Comercial"] },
  { categoria: "Premiação Frota", headers: ["Premiação Frota", "Premiacao Frota"] },
  { categoria: "Salário 2 (Gratificação)", headers: ["Salário 2 (Gratificação)", "Salario 2 (Gratificacao)", "Salário 2", "Salario 2", "Gratificação", "Gratificacao"] },
  { categoria: "Vale Transporte", headers: ["Vale Transporte", "VT"] },
];
