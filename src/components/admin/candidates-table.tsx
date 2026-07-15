"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Search } from "lucide-react";
import { CandidateFormDialog } from "@/components/admin/candidate-form-dialog";
import { deleteCandidate } from "@/actions/candidates";
import { formatDate } from "@/lib/utils";

const STAGE_LABEL: Record<string, string> = {
  TRIAGEM: "Triagem",
  ENTREVISTA_RH: "Entrevista RH",
  ENTREVISTA_GESTOR: "Entrevista Gestor",
  TESTE: "Teste",
  PROPOSTA: "Proposta",
  CONTRATADO: "Contratado",
  REPROVADO: "Reprovado",
};

interface CandidateRow {
  id: string;
  name: string;
  source: string;
  vacancy: string;
  stage: string;
  openedAt: Date;
  vacancyRef: { id: string; title: string } | null;
}

export function CandidatesTable({
  candidates,
  vacancies,
}: {
  candidates: CandidateRow[];
  vacancies: { id: string; title: string }[];
}) {
  const [search, setSearch] = React.useState("");
  const router = useRouter();

  const filtered = candidates.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || c.vacancy.toLowerCase().includes(q);
  });

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este candidato?")) return;
    await deleteCandidate(id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou vaga..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidato</TableHead>
            <TableHead>Vaga</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Abertura</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.vacancy}</TableCell>
              <TableCell>{c.source}</TableCell>
              <TableCell>
                <Badge variant={c.stage === "CONTRATADO" ? "success" : c.stage === "REPROVADO" ? "danger" : "outline"}>
                  {STAGE_LABEL[c.stage] ?? c.stage}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(c.openedAt)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <CandidateFormDialog
                    mode="edit"
                    candidateId={c.id}
                    vacancies={vacancies}
                    defaultValues={{
                      name: c.name,
                      vacancyId: c.vacancyRef?.id ?? "",
                      source: c.source,
                      stage: c.stage as "TRIAGEM" | "ENTREVISTA_RH" | "ENTREVISTA_GESTOR" | "TESTE" | "PROPOSTA" | "CONTRATADO" | "REPROVADO",
                    }}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    }
                  />
                  <Button variant="outline" size="sm" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
