import { readFile } from "fs/promises";
import path from "path";

/**
 * Lê a logomarca de /public/logo.png pra embutir nos relatórios em PDF.
 * Se o arquivo ainda não existir, devolve null — o relatório sai sem logo em
 * vez de quebrar. Assim que o arquivo for adicionado no repositório, todos os
 * relatórios passam a usar a logo automaticamente, sem precisar mexer em nada.
 */
export async function loadCompanyLogoDataUrl(): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "logo.png");
    const buffer = await readFile(filePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
