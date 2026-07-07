"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv } from "@/lib/csv";

interface ExportCsvButtonProps {
  data: Record<string, unknown>[];
  columns?: { key: string; label: string }[];
  filename: string;
}

export function ExportCsvButton({ data, columns, filename }: ExportCsvButtonProps) {
  function handleExport() {
    const csv = toCsv(data, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={data.length === 0}>
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </Button>
  );
}
