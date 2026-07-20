export const downloadPdf = async (
  fileName: string,
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>
) => {
  const jsPDFModule = await import('jspdf/dist/jspdf.es.min.js');
  await import('jspdf-autotable/es');
  const JsPDF = (jsPDFModule as any).default ?? jsPDFModule;
  const doc = new JsPDF();
  const leftMargin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const titleY = 18;

  doc.setFontSize(14);
  doc.text(title, leftMargin, titleY);
  doc.setFontSize(10);

  (doc as any).autoTable({
    startY: titleY + 6,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: leftMargin, right: leftMargin },
    didDrawPage: () => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${pageCount}`, pageWidth - leftMargin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }
  });

  doc.save(fileName);
};
