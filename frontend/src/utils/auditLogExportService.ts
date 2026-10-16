import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
} from 'docx';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';

export interface AuditLogExportItem {
  id: string;
  timestamp: string;
  action: string;
  target?: string;
  name: string;
  role: string;
  email: string;
  lrn: string;
}

export interface AuditLogExportData {
  division?: string;
  district?: string;
  schoolName?: string;
  schoolAddress?: string;
  title?: string;
  dateRangeStr?: string;
  paperSize?: 'letter' | 'a4' | 'folio';
  preparedByName?: string;
  preparedByTitle?: string;
  notedByName?: string;
  notedByTitle?: string;
  logs: AuditLogExportItem[];
}

export const formatAuditEmail = (log: AuditLogExportItem): string => {
  if (log.role?.toLowerCase() === 'student') return '—';
  if (!log.email || log.email === '—' || log.email.endsWith('@aralert.local') || log.email.startsWith('student-')) {
    return '—';
  }
  return log.email;
};

function base64ToUint8Array(base64Str: string): Uint8Array {
  const clean = base64Str.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const buildAuditLogFilename = (
  dateRangeStr?: string,
  paperSize?: string,
  ext: string = 'xlsx'
): string => {
  const rangeClean = (dateRangeStr || 'ALL_DATES')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
  const sizePart = (paperSize || 'LETTER').toUpperCase();
  return `PNAHS_AUDIT_LOG_${rangeClean}_${sizePart}.${ext}`;
};

// ── 1. Export to Excel (.xlsx) ─────────────────────────────────────────────────
export const exportAuditLogsToExcel = async (data: AuditLogExportData): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const paper = data.paperSize || 'letter';

  const worksheet = workbook.addWorksheet('Audit Log', {
    pageSetup: {
      paperSize: (paper === 'a4' ? 9 : paper === 'folio' ? 14 : 1) as any,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  // Set column widths
  worksheet.columns = [
    { key: 'index', width: 6 },
    { key: 'timestamp', width: 25 },
    { key: 'action', width: 30 },
    { key: 'target', width: 26 },
    { key: 'name', width: 26 },
    { key: 'role', width: 16 },
    { key: 'email', width: 30 },
    { key: 'lrn', width: 18 },
  ];

  // Embed official DepEd (Left) and PNAHS (Right) Logos in header
  try {
    const depedImageId = workbook.addImage({
      base64: DEPED_LOGO_BASE64,
      extension: 'png',
    });
    worksheet.addImage(depedImageId, {
      tl: { col: 0.2, row: 0.3 },
      ext: { width: 55, height: 55 },
    });
  } catch (e) {
    console.warn('Could not add DepEd logo to Excel:', e);
  }

  try {
    const pnahsImageId = workbook.addImage({
      base64: PNAHS_LOGO_BASE64,
      extension: 'png',
    });
    worksheet.addImage(pnahsImageId, {
      tl: { col: 6.8, row: 0.3 },
      ext: { width: 55, height: 55 },
    });
  } catch (e) {
    console.warn('Could not add PNAHS logo to Excel:', e);
  }

  // Header Letterhead
  const divRow = worksheet.addRow(['', '', data.division || 'DIVISION OF MASBATE', '', '', '', '']);
  worksheet.mergeCells('A1:G1');
  divRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  divRow.getCell(1).font = { name: 'Times New Roman', size: 10, color: { argb: 'FF475569' } };

  const distRow = worksheet.addRow(['', '', data.district || 'PALANAS NORTH DISTRICT', '', '', '', '']);
  worksheet.mergeCells('A2:G2');
  distRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  distRow.getCell(1).font = { name: 'Times New Roman', size: 10, color: { argb: 'FF475569' } };

  const schoolRow = worksheet.addRow(['', '', data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL', '', '', '', '']);
  worksheet.mergeCells('A3:G3');
  schoolRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  schoolRow.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF0F172A' } };

  const addrRow = worksheet.addRow(['', '', data.schoolAddress || 'Sta. Cruz, Palanas, Masbate', '', '', '', '']);
  worksheet.mergeCells('A4:G4');
  addrRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  addrRow.getCell(1).font = { name: 'Times New Roman', size: 9, italic: true, color: { argb: 'FF64748B' } };

  worksheet.addRow([]); // Blank spacer

  const titleRow = worksheet.addRow(['', '', data.title || 'ARAL PROGRAM SYSTEM AUDIT LOG RECORD', '', '', '', '']);
  worksheet.mergeCells('A6:G6');
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.getCell(1).font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: 'FF0052B7' } };

  const rangeRow = worksheet.addRow(['', '', `DATE RANGE: ${data.dateRangeStr || 'ALL RECORDED DATES'}`, '', '', '', '']);
  worksheet.mergeCells('A7:G7');
  rangeRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  rangeRow.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF334155' } };

  const now = new Date();
  const genRow = worksheet.addRow(['', '', `Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()} PHT`, '', '', '', '']);
  worksheet.mergeCells('A8:G8');
  genRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  genRow.getCell(1).font = { name: 'Times New Roman', size: 9, italic: true, color: { argb: 'FF64748B' } };

  worksheet.addRow([]); // Blank spacer

  // Table Column Headers
  const headerRow = worksheet.addRow([
    '#',
    'TIMESTAMP (PHT)',
    'ACTION / EVENT',
    'TARGET',
    'ACTOR NAME',
    'ROLE',
    'EMAIL',
    'LRN',
  ]);
  headerRow.height = 24;

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0052B7' },
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Times New Roman',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  for (let c = 1; c <= 8; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  }

  // Populate data rows
  const dataFont: Partial<ExcelJS.Font> = {
    name: 'Times New Roman',
    size: 9.5,
    color: { argb: 'FF0F172A' },
  };

  data.logs.forEach((log, idx) => {
    const row = worksheet.addRow([
      idx + 1,
      log.timestamp,
      log.action.replace(/_/g, ' '),
      log.target || '—',
      log.name || 'System',
      log.role || '—',
      formatAuditEmail(log),
      log.lrn || '—',
    ]);
    row.height = 20;

    const isEven = idx % 2 === 1;
    const rowBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.font = dataFont;
      cell.border = thinBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBg },
      };
    }
  });

  // Write and download buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = buildAuditLogFilename(data.dateRangeStr, data.paperSize, 'xlsx');

  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(anchor.href);
};

// ── 2. Export to Word Document (.docx) ──────────────────────────────────────────
export const exportAuditLogsToDocx = async (data: AuditLogExportData): Promise<void> => {
  const paper = data.paperSize || 'letter';
  const paperWidthDxa = paper === 'a4' ? 11906 : paper === 'folio' ? 12240 : 12240;
  const paperHeightDxa = paper === 'a4' ? 16838 : paper === 'folio' ? 18720 : 15840;

  let depedBytes: Uint8Array | null = null;
  let pnahsBytes: Uint8Array | null = null;

  try {
    depedBytes = base64ToUint8Array(DEPED_LOGO_BASE64);
  } catch (e) {
    console.warn('Could not decode DepEd logo for DOCX:', e);
  }

  try {
    pnahsBytes = base64ToUint8Array(PNAHS_LOGO_BASE64);
  } catch (e) {
    console.warn('Could not decode PNAHS logo for DOCX:', e);
  }

  const borderThin = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const borderNone = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  const cellBordersData = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };
  const cellBordersNone = { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone };

  // Header 3-column table
  const headerTable = new Table({
    width: { size: 10000, type: WidthType.DXA },
    borders: cellBordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1200, type: WidthType.DXA },
            borders: cellBordersNone,
            verticalAlign: VerticalAlign.CENTER,
            children: depedBytes
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: depedBytes,
                        transformation: { width: 50, height: 50 },
                        type: 'png',
                      }),
                    ],
                  }),
                ]
              : [],
          }),
          new TableCell({
            width: { size: 7600, type: WidthType.DXA },
            borders: cellBordersNone,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: data.division || 'DIVISION OF MASBATE', font: 'Times New Roman', size: 18, color: '475569' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: data.district || 'PALANAS NORTH DISTRICT', font: 'Times New Roman', size: 18, color: '475569' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL', font: 'Times New Roman', size: 22, bold: true, color: '0F172A' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: data.schoolAddress || 'Sta. Cruz, Palanas, Masbate', font: 'Times New Roman', size: 16, italics: true, color: '64748B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1200, type: WidthType.DXA },
            borders: cellBordersNone,
            verticalAlign: VerticalAlign.CENTER,
            children: pnahsBytes
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: pnahsBytes,
                        transformation: { width: 50, height: 50 },
                        type: 'png',
                      }),
                    ],
                  }),
                ]
              : [],
          }),
        ],
      }),
    ],
  });

  // Table column widths (total = 10,000 dxa)
  const colWidths = [450, 1850, 1800, 1600, 1500, 900, 1100, 800];

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      { text: '#', width: colWidths[0], align: AlignmentType.CENTER },
      { text: 'TIMESTAMP (PHT)', width: colWidths[1], align: AlignmentType.CENTER },
      { text: 'ACTION / EVENT', width: colWidths[2], align: AlignmentType.LEFT },
      { text: 'TARGET', width: colWidths[3], align: AlignmentType.LEFT },
      { text: 'ACTOR NAME', width: colWidths[4], align: AlignmentType.LEFT },
      { text: 'ROLE', width: colWidths[5], align: AlignmentType.CENTER },
      { text: 'EMAIL', width: colWidths[6], align: AlignmentType.LEFT },
      { text: 'LRN', width: colWidths[7], align: AlignmentType.CENTER },
    ].map(
      (col) =>
        new TableCell({
          width: { size: col.width, type: WidthType.DXA },
          shading: { fill: '0052B7' },
          borders: cellBordersData,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: col.align,
              children: [new TextRun({ text: col.text, font: 'Times New Roman', size: 17, bold: true, color: 'FFFFFF' })],
            }),
          ],
        })
    ),
  });

  const dataRows = data.logs.map((log, idx) => {
    const isEven = idx % 2 === 1;
    const bgFill = isEven ? 'F8FAFC' : 'FFFFFF';
    return new TableRow({
      children: [
        { text: String(idx + 1), width: colWidths[0], align: AlignmentType.CENTER },
        { text: log.timestamp, width: colWidths[1], align: AlignmentType.CENTER },
        { text: log.action.replace(/_/g, ' '), width: colWidths[2], align: AlignmentType.LEFT },
        { text: log.target || '—', width: colWidths[3], align: AlignmentType.LEFT },
        { text: log.name || 'System', width: colWidths[4], align: AlignmentType.LEFT },
        { text: log.role || '—', width: colWidths[5], align: AlignmentType.CENTER },
        { text: formatAuditEmail(log), width: colWidths[6], align: AlignmentType.LEFT },
        { text: log.lrn || '—', width: colWidths[7], align: AlignmentType.CENTER },
      ].map(
        (col) =>
          new TableCell({
            width: { size: col.width, type: WidthType.DXA },
            shading: { fill: bgFill },
            borders: cellBordersData,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: col.align,
                children: [new TextRun({ text: col.text, font: 'Times New Roman', size: 16, color: '0F172A' })],
              }),
            ],
          })
      ),
    });
  });

  const auditTable = new Table({
    width: { size: 10000, type: WidthType.DXA },
    borders: cellBordersData,
    rows: [headerRow, ...dataRows],
  });



  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: paperWidthDxa, height: paperHeightDxa },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          headerTable,
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: data.title || 'ARAL PROGRAM SYSTEM AUDIT LOG RECORD', font: 'Times New Roman', size: 24, bold: true, color: '0052B7' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `DATE RANGE: ${data.dateRangeStr || 'ALL RECORDED DATES'}`, font: 'Times New Roman', size: 19, bold: true, color: '334155' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Total Events: ${data.logs.length}`, font: 'Times New Roman', size: 16, italics: true, color: '64748B' })],
          }),
          new Paragraph({ text: '' }),
          auditTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = buildAuditLogFilename(data.dateRangeStr, data.paperSize, 'docx');

  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(anchor.href);
};

// ── 3. Export to PDF (.pdf) ────────────────────────────────────────────────────
export const exportAuditLogsToPdf = async (data: AuditLogExportData): Promise<void> => {
  const paper = data.paperSize || 'letter';
  let pageWidth = 612;
  let pageHeight = 792;
  let pageFormat: string | [number, number] = 'letter';

  if (paper === 'a4') {
    pageWidth = 595.28;
    pageHeight = 841.89;
    pageFormat = 'a4';
  } else if (paper === 'folio') {
    pageWidth = 612;
    pageHeight = 936;
    pageFormat = [612, 936];
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: pageFormat,
  });

  const marginX = 36;
  const marginTop = 36;
  const availWidth = pageWidth - marginX * 2;
  const centerX = pageWidth / 2;

  // Header logos
  const logoSize = 42;
  const logoY = marginTop;

  try {
    if (DEPED_LOGO_BASE64) {
      pdf.addImage(DEPED_LOGO_BASE64, 'PNG', centerX - 165, logoY, logoSize, logoSize);
    }
  } catch (e) {
    console.warn('Could not add DepEd logo to PDF:', e);
  }

  try {
    if (PNAHS_LOGO_BASE64) {
      pdf.addImage(PNAHS_LOGO_BASE64, 'PNG', centerX + 125, logoY, logoSize, logoSize);
    }
  } catch (e) {
    console.warn('Could not add PNAHS logo to PDF:', e);
  }

  // School metadata letterhead
  pdf.setFont('times', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(data.division || 'DIVISION OF MASBATE', centerX, logoY + 10, { align: 'center' });
  pdf.text(data.district || 'PALANAS NORTH DISTRICT', centerX, logoY + 20, { align: 'center' });

  pdf.setFont('times', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL', centerX, logoY + 32, { align: 'center' });

  pdf.setFont('times', 'italic');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(data.schoolAddress || 'Sta. Cruz, Palanas, Masbate', centerX, logoY + 41, { align: 'center' });

  // Document Title
  let curY = logoY + 58;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(0, 82, 183);
  pdf.text(data.title || 'ARAL PROGRAM SYSTEM AUDIT LOG RECORD', centerX, curY, { align: 'center' });

  curY += 13;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`DATE RANGE: ${data.dateRangeStr || 'ALL RECORDED DATES'}`, centerX, curY, { align: 'center' });

  curY += 10;
  pdf.setFont('times', 'italic');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Total Records: ${data.logs.length}`, centerX, curY, { align: 'center' });

  curY += 12;

  // Table Columns Widths (sum = availWidth)
  const colWidths = [
    22,  // #
    86,  // Timestamp
    90,  // Event
    85,  // Target
    85,  // Actor Name
    48,  // Role
    65,  // Email
    availWidth - (22 + 86 + 90 + 85 + 85 + 48 + 65), // LRN
  ];

  const headerLabels = ['#', 'TIMESTAMP (PHT)', 'ACTION / EVENT', 'TARGET', 'ACTOR NAME', 'ROLE', 'EMAIL', 'LRN'];
  const headerHeight = 18;
  const rowHeight = 16;

  const renderTableHeader = (yPos: number) => {
    pdf.setFillColor(0, 82, 183);
    pdf.rect(marginX, yPos, availWidth, headerHeight, 'F');
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.5);
    pdf.rect(marginX, yPos, availWidth, headerHeight, 'S');

    let x = marginX;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);

    headerLabels.forEach((label, i) => {
      const w = colWidths[i];
      pdf.text(label, x + w / 2, yPos + 11.5, { align: 'center' });
      x += w;
    });
  };

  renderTableHeader(curY);
  curY += headerHeight;

  // Render Rows
  pdf.setFont('times', 'normal');
  pdf.setFontSize(7.5);

  data.logs.forEach((log, idx) => {
    if (curY + rowHeight > pageHeight - 90) {
      pdf.addPage(pageFormat, 'portrait');
      curY = marginTop;
      renderTableHeader(curY);
      curY += headerHeight;
    }

    const isEven = idx % 2 === 1;
    if (isEven) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(marginX, curY, availWidth, rowHeight, 'F');
    }

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.rect(marginX, curY, availWidth, rowHeight, 'S');

    let x = marginX;
    pdf.setTextColor(15, 23, 42);

    const values = [
      String(idx + 1),
      log.timestamp,
      log.action.replace(/_/g, ' '),
      log.target || '—',
      log.name || 'System',
      log.role || '—',
      formatAuditEmail(log),
      log.lrn || '—',
    ];

    values.forEach((val, i) => {
      const w = colWidths[i];
      let txt = String(val);
      // Truncate if too long for column
      const maxChar = i === 1 ? 26 : i === 2 ? 22 : i === 3 ? 20 : i === 4 ? 20 : i === 6 ? 18 : 14;
      if (txt.length > maxChar) txt = txt.slice(0, maxChar - 1) + '…';

      if (i === 0 || i === 1 || i === 5 || i === 7) {
        pdf.text(txt, x + w / 2, curY + 11, { align: 'center' });
      } else {
        pdf.text(txt, x + 4, curY + 11, { align: 'left' });
      }
      x += w;
    });

    curY += rowHeight;
  });



  const filename = buildAuditLogFilename(data.dateRangeStr, data.paperSize, 'pdf');
  pdf.save(filename);
};

// ── 4. Export to CSV (.csv) ────────────────────────────────────────────────────
export const exportAuditLogsToCsv = (data: AuditLogExportData): void => {
  const headers = ['#', 'Timestamp (PHT)', 'Action / Event', 'Target', 'Actor Name', 'Role', 'Email', 'LRN'];
  const rows = data.logs.map((log, idx) => [
    `"${idx + 1}"`,
    `"${log.timestamp.replace(/"/g, '""')}"`,
    `"${log.action.replace(/_/g, ' ').replace(/"/g, '""')}"`,
    `"${(log.target || '—').replace(/"/g, '""')}"`,
    `"${(log.name || 'System').replace(/"/g, '""')}"`,
    `"${(log.role || '—').replace(/"/g, '""')}"`,
    `"${formatAuditEmail(log).replace(/"/g, '""')}"`,
    `"${(log.lrn || '—').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = buildAuditLogFilename(data.dateRangeStr, data.paperSize, 'csv');

  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(anchor.href);
};
