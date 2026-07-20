import type { Prisma } from "@prisma/client";

/**
 * Filtro Prisma reutilizável para "colaborador contando como presente".
 * Além de estar ativo (isActive), exclui quem está atualmente afastado
 * pelo INSS na data de referência: existe um InssLeave que já começou
 * (startDate <= data) e ainda não tem retorno registrado até essa data
 * (actualReturnDate nulo, ou no futuro em relação à data de referência).
 *
 * Assim que alguém preenche a "Data de retorno real" no afastamento, a
 * pessoa volta a contar automaticamente — não precisa reativar nada à mão.
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
