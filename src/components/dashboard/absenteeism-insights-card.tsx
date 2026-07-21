import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { monthLabelsPtBR } from "@/services/period";

interface AbsenteeismInsightsProps {
  topAbsentees: { name: string; value: number; occurrences: number }[];
  reasons: { name: string; value: number }[];
  seasonality: { month: string; hoursLost: number; occurrences: number }[];
}

export function AbsenteeismInsightsCard({ topAbsentees, reasons, seasonality }: AbsenteeismInsightsProps) {
  const monthLabels = monthLabelsPtBR(seasonality.map((s) => s.month));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Absenteísmo — maiores ausentes, motivos e sazonalidade</CardTitle>
        <p className="text-xs text-muted-foreground">
          Calculado a partir das ausências e atestados cadastrados no período. Atualiza sozinho conforme novos
          registros são alimentados.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ausentes">
          <TabsList>
            <TabsTrigger value="ausentes">Maiores ausentes</TabsTrigger>
            <TabsTrigger value="motivos">Motivos</TabsTrigger>
            <TabsTrigger value="sazonalidade">Sazonalidade</TabsTrigger>
          </TabsList>

          <TabsContent value="ausentes">
            {topAbsentees.length > 0 ? (
              <RankingBarChart data={topAbsentees} color="#B23A48" />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem ausências registradas no período selecionado.
              </p>
            )}
          </TabsContent>

          <TabsContent value="motivos">
            {reasons.length > 0 ? (
              <RankingBarChart data={reasons} color="#C9922E" />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem motivos registrados no período selecionado.
              </p>
            )}
          </TabsContent>

          <TabsContent value="sazonalidade">
            {seasonality.some((s) => s.hoursLost > 0) ? (
              <TrendChart data={seasonality.map((s) => s.hoursLost)} labels={monthLabels} color="#1B2A4A" />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem histórico suficiente nos últimos 12 meses.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
