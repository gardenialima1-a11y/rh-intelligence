import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const expected = process.env.RH_INTEGRATION_API_KEY;
  const received = request.headers.get("x-integration-key");

  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      secondaryCostCenter: {
        select: { name: true },
      },
      costCenter: {
        select: { name: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const colaboradores = employees.map((employee) => ({
    id: employee.id,
    nome: employee.name,
    setor:
      employee.secondaryCostCenter?.name ??
      employee.costCenter?.name ??
      "SEM SETOR",
  }));

  return NextResponse.json(
    {
      total: colaboradores.length,
      atualizadoEm: new Date().toISOString(),
      colaboradores,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
