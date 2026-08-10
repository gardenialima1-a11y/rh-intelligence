import type { Prisma } from "@prisma/client";

/**
 * Filtro Prisma reutilizável para "colaborador contando como presente HOJE".
 * Além de estar ativo (isActive), exclui quem está atualmente afastado
 * pelo INSS na data de referência: existe um InssLeave que já começou
 * (startDate <= data) e ainda não tem retorno registrado até essa data
 * (actualReturnDate nulo, ou no futuro em relação à data de referência).
 *
 * Assim que alguém preenche a "Data de retorno real" no afastamento, a
 * pessoa volta a contar automaticamente — não precisa reativar nada à mão.
 *
 * IMPORTANTE: use esta função só para consultas do dia de hoje. Para
 * contar quantas pessoas trabalhavam na empresa numa data PASSADA, use
 * `presentAtDateWhere` abaixo — esta aqui sempre exige isActive = true
 * (status atual do cadastro), então quem já foi desligado depois daquela
 * data ficaria de fora da contagem histórica por engano.
 */
export function activePresentEmployeeWhere(asOfDate: Date = new Date()): Prisma.EmployeeWhereInput {
  return {
    isActive: true,
    NOT: {
      inssLeaves: {
        some: {
          startDate: { lte: asOfDate },
          OR: [{ actualReturnDate: null }, { actualReturnDate: { gt: asOfDate } }],
        },
      },
    },
  };
}

/**
 * Filtro Prisma para "colaborador contando como presente NUMA DATA PASSADA
 * QUALQUER" — usado nos gráficos de evolução de headcount (últimos 12
 * meses) e em qualquer comparação com período anterior.
 *
 * Diferente de `activePresentEmployeeWhere`, este filtro NÃO usa o campo
 * isActive (que só reflete o status de HOJE). Em vez disso, a presença na
 * data é decidida só pelas datas reais: já foi admitido até aquela data e
 * ainda não tinha sido desligado até aquela data (chamado em conjunto com
 * os filtros de admissionDate/terminationDate em cada função que usa isso).
 * Assim, alguém que trabalhava na empresa em setembro/2025 e só foi
 * desligado depois continua contando corretamente para setembro/2025,
 * mesmo que hoje o cadastro dele já esteja como "Desligado".
 */
export function presentAtDateWhere(asOfDate: Date): Prisma.EmployeeWhereInput {
  return {
    NOT: {
      inssLeaves: {
        some: {
          startDate: { lte: asOfDate },
          OR: [{ actualReturnDate: null }, { actualReturnDate: { gt: asOfDate } }],
        },
      },
    },
  };
}
