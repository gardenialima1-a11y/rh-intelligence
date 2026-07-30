import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * Cabeçalho padrão de TODOS os relatórios em PDF do sistema: logomarca (se
 * existir em /public/logo.png), nome da empresa, título do relatório e data
 * de geração. Qualquer novo relatório em PDF deve usar este componente, pra
 * manter a identidade visual consistente em todo o sistema.
 */
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#1E2A4A",
    paddingBottom: 12,
    marginBottom: 16,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 62,
    height: 28,
    objectFit: "contain",
  },
  companyName: {
    fontSize: 10,
    fontWeight: 700,
    color: "#1E2A4A",
  },
  titleBlock: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1E2A4A",
  },
  generatedAt: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 2,
  },
});

export function ReportHeader({
  title,
  logoDataUrl,
  companyName = "Gosto Mineiro",
}: {
  title: string;
  logoDataUrl: string | null;
  companyName?: string;
}) {
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {logoDataUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- é o Image do @react-pdf/renderer, não o <img> do HTML
          <Image src={logoDataUrl} style={styles.logo} />
        ) : (
          <Text style={styles.companyName}>{companyName}</Text>
        )}
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.generatedAt}>Gerado em {generatedAt}</Text>
      </View>
    </View>
  );
}
