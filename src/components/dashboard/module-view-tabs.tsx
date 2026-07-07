import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ModuleViewTabs({
  executive,
  managerial,
  operational,
  analytical,
}: {
  executive: React.ReactNode;
  managerial: React.ReactNode;
  operational: React.ReactNode;
  analytical: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="executiva">
      <TabsList>
        <TabsTrigger value="executiva">Executiva</TabsTrigger>
        <TabsTrigger value="gerencial">Gerencial</TabsTrigger>
        <TabsTrigger value="operacional">Operacional</TabsTrigger>
        <TabsTrigger value="analitica">Analítica</TabsTrigger>
      </TabsList>
      <TabsContent value="executiva">{executive}</TabsContent>
      <TabsContent value="gerencial">{managerial}</TabsContent>
      <TabsContent value="operacional">{operational}</TabsContent>
      <TabsContent value="analitica">{analytical}</TabsContent>
    </Tabs>
  );
}
