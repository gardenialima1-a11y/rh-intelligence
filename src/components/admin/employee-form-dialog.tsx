"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { QuickAddDialog } from "@/components/admin/quick-add-dialog";
import { PhotoUploadField } from "@/components/admin/photo-upload-field";
import { employeeFormSchema, type EmployeeFormValues, GENDER_OPTIONS, CONTRACT_TYPE_OPTIONS } from "@/lib/validation/employee";
import { createEmployee, updateEmployee } from "@/actions/employees";
import { createPosition, createCostCenter, createManager, createUnit } from "@/actions/reference-data";

const GENDER_LABEL: Record<string, string> = { MASCULINO: "Masculino", FEMININO: "Feminino", NAO_INFORMADO: "Não informado" };
const CONTRACT_LABEL: Record<string, string> = { CLT: "CLT", PJ: "PJ", APRENDIZ: "Aprendiz", ESTAGIO: "Estágio", TEMPORARIO: "Temporário" };

interface OptionItem {
  id: string;
  name: string;
}

export interface EmployeeFormOptions {
  positions: OptionItem[];
  costCenters: OptionItem[];
  managers: OptionItem[];
  units: OptionItem[];
}

interface EmployeeFormDialogProps {
  options: EmployeeFormOptions;
  mode: "create" | "edit";
  employeeId?: string;
  defaultValues?: Partial<EmployeeFormValues>;
  trigger?: React.ReactNode;
}

export function EmployeeFormDialog({ options, mode, employeeId, defaultValues, trigger }: EmployeeFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: defaultValues ?? {
      gender: "NAO_INFORMADO",
      contractType: "CLT",
      isPCD: false,
      positionId: null,
      costCenterId: null,
      secondaryCostCenterId: null,
      managerId: null,
    },
  });

  async function onSubmit(values: EmployeeFormValues) {
    setServerError(null);
    setLoading(true);
    const result = mode === "create" ? await createEmployee(values) : await updateEmployee(employeeId!, values);
    setLoading(false);
    if (!result.success) {
      setServerError(result.error ?? "Não foi possível salvar.");
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="gold">
            <UserPlus className="h-4 w-4" /> Novo colaborador
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo colaborador" : "Editar colaborador"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Cadastre um novo colaborador na plataforma." : "Atualize os dados do colaborador."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="registration">Matrícula</Label>
            <Input id="registration" {...register("registration")} />
            {errors.registration && <p className="text-xs text-danger">{errors.registration.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Unidade</Label>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="unitId"
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {options.units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <QuickAddDialog
                label="Unidade"
                description="Cadastre uma nova unidade/filial."
                extraFields={[
                  { key: "type", label: "Tipo", type: "select", placeholder: "Selecione", options: [{ value: "MATRIZ", label: "Matriz" }, { value: "FILIAL", label: "Filial" }] },
                  { key: "city", label: "Cidade" },
                  { key: "state", label: "Estado (UF)", placeholder: "CE" },
                ]}
                onCreate={(name, extra) => createUnit(name, extra.city, extra.state, (extra.type as "MATRIZ" | "FILIAL") || "FILIAL")}
                onCreated={() => router.refresh()}
              />
            </div>
            {errors.unitId && <p className="text-xs text-danger">{errors.unitId.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Cargo</Label>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="positionId"
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {options.positions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <QuickAddDialog
                label="Cargo"
                description="Cadastre um novo cargo."
                onCreate={(name) => createPosition(name)}
                onCreated={() => router.refresh()}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Centro de custo (setor principal)</Label>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="costCenterId"
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {options.costCenters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <QuickAddDialog
                label="Centro de custo"
                description="Cadastre um novo centro de custo/área."
                extraFields={[{ key: "area", label: "Área" }]}
                onCreate={(name, extra) => createCostCenter(name, extra.area)}
                onCreated={() => router.refresh()}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Centro de custo (setor secundário, opcional)</Label>
            <Controller
              control={control}
              name="secondaryCostCenterId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    {options.costCenters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-[11px] text-muted-foreground">
              Use quando o colaborador atende mais de uma área/setor além do principal.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Gestor</Label>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="managerId"
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {options.managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <QuickAddDialog
                label="Gestor"
                description="Cadastre um novo gestor."
                extraFields={[{ key: "area", label: "Área" }]}
                onCreate={(name, extra) => createManager(name, extra.area)}
                onCreated={() => router.refresh()}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Gênero</Label>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g} value={g}>{GENDER_LABEL[g]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tipo de contrato</Label>
            <Controller
              control={control}
              name="contractType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPE_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{CONTRACT_LABEL[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" placeholder="(85) 99999-9999" {...register("phone")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="colaborador@empresa.com.br" {...register("email")} />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="photoUrl"
              render={({ field }) => <PhotoUploadField value={field.value} onChange={field.onChange} />}
            />
            {errors.photoUrl && <p className="text-xs text-danger">{String(errors.photoUrl.message)}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input id="birthDate" type="date" {...register("birthDate")} />
            {errors.birthDate && <p className="text-xs text-danger">{errors.birthDate.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admissionDate">Data de admissão</Label>
            <Input id="admissionDate" type="date" {...register("admissionDate")} />
            {errors.admissionDate && <p className="text-xs text-danger">{errors.admissionDate.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="baseSalary">Salário base (R$)</Label>
            <Input id="baseSalary" type="number" step="0.01" {...register("baseSalary")} />
            {errors.baseSalary && <p className="text-xs text-danger">{String(errors.baseSalary.message)}</p>}
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Controller
              control={control}
              name="isPCD"
              render={({ field }) => (
                <Checkbox id="isPCD" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              )}
            />
            <Label htmlFor="isPCD" className="cursor-pointer">Pessoa com deficiência (PCD)</Label>
          </div>

          {serverError && <p className="sm:col-span-2 text-sm text-danger">{serverError}</p>}

          <DialogFooter className="sm:col-span-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="gold" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Cadastrar" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
