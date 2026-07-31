import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ModuleViewTabs({
  executive,
  managerial,
  operational,
  analytical,
  extraTabs,
}: {
  executive: React.ReactNode;
  managerial: React.ReactNode;
  operational: React.ReactNode;
  analytical: React.ReactNode;
  /** Abas extras opcionais, além das 4 padrão — só pra módulos que precisam de uma visão a mais (ex.: Estabilidade no SST). */
  extraTabs?: { value: string; label: string; content: React.ReactNode }[];
}) {
  return (
    <Tabs defaultValue="executiva">
      <TabsList>
        <TabsTrigger value="executiva">Executiva</TabsTrigger>
        <TabsTrigger value="gerencial">Gerencial</TabsTrigger>
        <TabsTrigger value="operacional">Operacional</TabsTrigger>
        <TabsTrigger value="analitica">Analítica</TabsTrigger>
        {extraTabs?.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="executiva">{executive}</TabsContent>
      <TabsContent value="gerencial">{managerial}</TabsContent>
      <TabsContent value="operacional">{operational}</TabsContent>
      <TabsContent value="analitica">{analytical}</TabsContent>
      {extraTabs?.map((t) => (
        <TabsContent key={t.value} value={t.value}>{t.content}</TabsContent>
      ))}
    </Tabs>
  );
}
