import { CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";

interface TableCardHeaderProps {
  title: string;
  data: Record<string, unknown>[];
  columns?: { key: string; label: string }[];
  filename: string;
}

export function TableCardHeader({ title, data, columns, filename }: TableCardHeaderProps) {
  return (
    <CardHeader className="flex-row items-center justify-between space-y-0">
      <CardTitle>{title}</CardTitle>
      <ExportCsvButton data={data} columns={columns} filename={filename} />
    </CardHeader>
  );
}
