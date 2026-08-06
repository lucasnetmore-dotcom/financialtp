import { formatDate, money, totals, type Entry } from "@/lib/finance";

const HEADER = [
  "Tipo",
  "Valor",
  "Data",
  "Categoria",
  "Descrição",
  "Pagamento",
  "Cliente",
  "Observações",
];

function rowsOf(entries: Entry[]) {
  return entries.map((e) => [
    e.type === "income" ? "Entrada" : "Saída",
    Number(e.value),
    e.entry_date,
    e.category,
    e.description,
    e.payment,
    e.client,
    e.notes,
  ]);
}

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportCsv(entries: Entry[]) {
  const lines = rowsOf(entries).map((r) =>
    r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";"),
  );
  download(
    new Blob([[HEADER.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }),
    `lancamentos-${stamp()}.csv`,
  );
}

export async function exportExcel(entries: Entry[], currency = "EUR") {
  const XLSX = await import("xlsx");
  const t = totals(entries);

  const sheet = XLSX.utils.aoa_to_sheet([
    HEADER,
    ...rowsOf(entries),
    [],
    ["Entradas", t.income],
    ["Saídas", t.expense],
    ["Saldo", t.balance],
  ]);
  sheet["!cols"] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 32 },
    { wch: 16 },
    { wch: 20 },
    { wch: 30 },
  ];

  const byCategory = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== "expense") continue;
    byCategory.set(e.category || "Geral", (byCategory.get(e.category || "Geral") ?? 0) + Number(e.value));
  }
  const resume = XLSX.utils.aoa_to_sheet([
    ["Resumo", `Moeda: ${currency}`],
    [],
    ["Despesas por categoria", "Total"],
    ...[...byCategory.entries()].sort((a, b) => b[1] - a[1]),
  ]);

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Lançamentos");
  XLSX.utils.book_append_sheet(book, resume, "Resumo");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `lancamentos-${stamp()}.xlsx`,
  );
}

export async function exportPdf(
  entries: Entry[],
  opts: { company?: string; currency?: string } = {},
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const currency = opts.currency ?? "EUR";
  const t = totals(entries);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text(opts.company || "Relatório financeiro", 40, 46);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `Gerado a ${new Date().toLocaleString("pt-PT")} · ${entries.length} lançamentos`,
    40,
    64,
  );
  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.text(
    `Entradas: ${money(t.income, currency)}    Saídas: ${money(t.expense, currency)}    Saldo: ${money(t.balance, currency)}`,
    40,
    86,
  );

  autoTable(doc, {
    startY: 104,
    head: [HEADER],
    body: entries.map((e) => [
      e.type === "income" ? "Entrada" : "Saída",
      money(Number(e.value), currency),
      formatDate(e.entry_date),
      e.category,
      e.description,
      e.payment,
      e.client,
      e.notes,
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${page}`, width - 70, doc.internal.pageSize.getHeight() - 20);
    },
  });

  doc.save(`relatorio-${stamp()}.pdf`);
}
