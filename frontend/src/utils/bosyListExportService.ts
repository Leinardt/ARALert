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
  PageOrientation,
} from 'docx';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';
import { formatStudentName, compareNamesByLastName } from './studentFormatters';

export interface BosyExportStudent {
  id: string;
  full_name: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  lrn?: string | null;
  grade_level?: string | null;
  subject?: string | null;
  parent_guardian_name?: string | null;
  contact_number?: string | null;
  has_bosy?: boolean;
  has_mosy?: boolean;
  has_eosy?: boolean;
  has_summer?: boolean;
  assigned_tutor_name?: string | null;
}

export interface BosyExportData {
  division?: string;
  district?: string;
  schoolName?: string;
  schoolAddress?: string;
  title?: string;
  schoolYear?: string;
  gradeLevel?: string;
  tutorName?: string;
  adviserName?: string;
  asstPrincipalName?: string;
  principalName?: string;
  paperSize?: 'letter' | 'a4' | 'legal' | 'folio';
  students: BosyExportStudent[];
}

function base64ToUint8Array(base64Str: string): Uint8Array {
  const clean = base64Str.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const tableBorderThin = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '000000',
};

const cellBordersAll = {
  top: tableBorderThin,
  bottom: tableBorderThin,
  left: tableBorderThin,
  right: tableBorderThin,
};

const invisibleBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
};

const cellBordersNone = {
  top: invisibleBorder,
  bottom: invisibleBorder,
  left: invisibleBorder,
  right: invisibleBorder,
};

/**
 * Export official 8-column List of ARAL Tutees to Excel (.xlsx)
 * Strictly matching the official template:
 * No., Name of Learner, BOSY, MOSY, EOSY, Subject Focus, Parent/Guardian, Contact No.
 */
export const exportBosyListToExcel = async (data: BosyExportData): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('BOSY LIST OF ARAL TUTEES');

  const paper = data.paperSize || 'letter';
  let excelPaperSize = 1; // Letter
  if (paper === 'a4') excelPaperSize = 9;
  else if (paper === 'legal' || paper === 'folio') excelPaperSize = 5;

  worksheet.pageSetup = {
    orientation: 'portrait',
    paperSize: excelPaperSize,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
    },
  };

  // 8 columns matching the client template
  worksheet.columns = [
    { key: 'no', width: 6 }, // A: No.
    { key: 'name', width: 34 }, // B: Name of Learner
    { key: 'bosy', width: 9 }, // C: BOSY
    { key: 'mosy', width: 9 }, // D: MOSY
    { key: 'eosy', width: 9 }, // E: EOSY
    { key: 'subject', width: 16 }, // F: Subject Focus
    { key: 'guardian', width: 26 }, // G: Parent/Guardian
    { key: 'contact', width: 18 }, // H: Contact No.
  ];

  const fontSchool = { name: 'Bookman Old Style', size: 16, bold: true };
  const fontTitle = { name: 'Bookman Old Style', size: 16, bold: true };
  const fontYear = { name: 'Bookman Old Style', size: 11, bold: true };
  const fontSub = { name: 'Bookman Old Style', size: 11, bold: true };
  const fontCell = { name: 'Bookman Old Style', size: 11 };
  const fontCellBold = { name: 'Bookman Old Style', size: 11, bold: true };
  const fontSigLabel = { name: 'Times New Roman', size: 11 };
  const fontSigName = { name: 'Times New Roman', size: 11, bold: true, underline: true };

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // 1. School Header Box (Rows 1 & 2 merged horizontally across A to H with enclosing border box)
  worksheet.mergeCells('A1:H1');
  const r1 = worksheet.getCell('A1');
  r1.value = (data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL').toUpperCase();
  r1.font = fontSchool;
  r1.alignment = { horizontal: 'center', vertical: 'middle' };

  // 2. Title
  worksheet.mergeCells('A2:H2');
  const r2 = worksheet.getCell('A2');
  r2.value = (data.title || 'BOSY LIST OF ARAL TUTEES').toUpperCase();
  r2.font = fontTitle;
  r2.alignment = { horizontal: 'center', vertical: 'middle' };

  // Apply outer box border around A1:H2 matching the example template box
  for (let col = 1; col <= 8; col++) {
    const c1 = worksheet.getRow(1).getCell(col);
    const c2 = worksheet.getRow(2).getCell(col);
    c1.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: col === 1 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined,
      right: col === 8 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined,
    };
    c2.border = {
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      left: col === 1 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined,
      right: col === 8 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined,
    };
  }
  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 24;

  // 3. School Year
  worksheet.mergeCells('A3:H3');
  const r3 = worksheet.getCell('A3');
  r3.value = data.schoolYear || '2026-2027';
  r3.font = fontYear;
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(3).height = 18;

  // 4. Blank row
  worksheet.addRow([]);

  // 5. Grade Level & Tutor Row (Size 11 Bold)
  const gradeRow = worksheet.addRow([
    `GRADE LEVEL: ${(data.gradeLevel || '7- HYACINTH').toUpperCase()}`,
    '',
    '',
    '',
    `TUTOR: ${(data.tutorName || 'RIZA J. GADIA').toUpperCase()}`,
    '',
    '',
    '',
  ]);
  gradeRow.font = fontSub;
  gradeRow.height = 20;

  // 6. Table Headers (Size 11 Bold)
  const headerRow = worksheet.addRow([
    'No.',
    'Name of Learner',
    'BOSY',
    'MOSY',
    'EOSY',
    'Subject Focus',
    'Parent/Guardian',
    'Contact No.',
  ]);

  headerRow.eachCell((cell) => {
    cell.font = fontCellBold;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });
  headerRow.height = 24;

  // 7. Student Rows (Sorted by Last Name, Size 11 Normal)
  const sortedStudents = [...data.students].sort(compareNamesByLastName);

  sortedStudents.forEach((student, index) => {
    const formattedName = formatStudentName(student);

    const row = worksheet.addRow([
      index + 1,
      formattedName,
      student.has_bosy ?? true ? 'TRUE' : '',
      student.has_mosy ? 'TRUE' : '',
      student.has_eosy ? 'TRUE' : '',
      (student.subject || 'ENGLISH').toUpperCase(),
      (student.parent_guardian_name || '').toUpperCase(),
      student.contact_number || '',
    ]);

    row.eachCell((cell, colNumber) => {
      cell.font = fontCell;
      cell.border = borderThin;
      // Centered: No (1), BOSY (3), MOSY (4), EOSY (5), Subject (6), Contact (8)
      if ([1, 3, 4, 5, 6, 8].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
    row.height = 20;
  });

  // 8. Signatories Section matching exact template placement (Size 11)
  worksheet.addRow([]); // Blank
  worksheet.addRow([]); // Blank

  // Prepared by: (on right side above tutor/adviser)
  const prepRow = worksheet.addRow(['', '', '', '', '', 'Prepared by:', '', '']);
  prepRow.getCell(6).font = fontSigLabel;

  worksheet.addRow([]); // Blank

  // Row 1: Adviser & Tutor
  const sigRow1 = worksheet.addRow([
    '',
    '',
    (data.adviserName || 'HAROLD M. BALBUENA').toUpperCase(),
    '',
    '',
    (data.tutorName || 'RIZA J. GADIA').toUpperCase(),
    '',
    '',
  ]);
  sigRow1.getCell(3).font = fontSigName;
  sigRow1.getCell(3).alignment = { horizontal: 'center' };
  sigRow1.getCell(6).font = fontSigName;
  sigRow1.getCell(6).alignment = { horizontal: 'center' };

  const subRow1 = worksheet.addRow(['', '', 'Adviser', '', '', 'TUTOR', '', '']);
  subRow1.getCell(3).font = fontSigLabel;
  subRow1.getCell(3).alignment = { horizontal: 'center' };
  subRow1.getCell(6).font = fontSigLabel;
  subRow1.getCell(6).alignment = { horizontal: 'center' };

  worksheet.addRow([]); // Blank

  // Checked:
  const checkRow = worksheet.addRow(['Checked:', '', '', '', '', '', '', '']);
  checkRow.getCell(1).font = fontSigLabel;

  const sigRow2 = worksheet.addRow([
    '',
    (data.asstPrincipalName || 'GEORGE B. BASAS').toUpperCase(),
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  sigRow2.getCell(2).font = fontSigName;
  sigRow2.getCell(2).alignment = { horizontal: 'center' };

  const subRow2 = worksheet.addRow(['', 'Asst to the Principal/ HT-I', '', '', '', '', '', '']);
  subRow2.getCell(2).font = fontSigLabel;
  subRow2.getCell(2).alignment = { horizontal: 'center' };

  worksheet.addRow([]); // Blank

  // Noted:
  const noteRow = worksheet.addRow(['', '', '', 'Noted:', '', '', '', '']);
  noteRow.getCell(4).font = fontSigLabel;

  const sigRow3 = worksheet.addRow([
    '',
    '',
    '',
    (data.principalName || 'EULOGIO C. GADIA').toUpperCase(),
    '',
    '',
    '',
    '',
  ]);
  sigRow3.getCell(4).font = fontSigName;
  sigRow3.getCell(4).alignment = { horizontal: 'center' };

  const subRow3 = worksheet.addRow(['', '', '', 'Principal I', '', '', '', '']);
  subRow3.getCell(4).font = fontSigLabel;
  subRow3.getCell(4).alignment = { horizontal: 'center' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const titleClean = (data.title || 'LIST_OF_ARAL_TUTEES').replace(/[^a-zA-Z0-9]/g, '_');
  const gradeLabel = (data.gradeLevel || 'GRADE_7').replace(/[^a-zA-Z0-9]/g, '_');
  anchor.download = `PNAHS_${titleClean}_${gradeLabel}_${data.schoolYear || '2026-2027'}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

/**
 * Export official 8-column List of ARAL Tutees to Microsoft Word (.docx)
 * Strictly matching the official Bookman Old Style template:
 * Header: 16pt (bold), All other elements: 11pt
 */
export const exportBosyListToDocx = async (data: BosyExportData): Promise<void> => {
  const paper = data.paperSize || 'letter';
  let pageWidth = 12240; // 8.5 in (Portrait Letter)
  let pageHeight = 15840; // 11 in

  if (paper === 'a4') {
    pageWidth = 11906; // 8.27 in
    pageHeight = 16838; // 11.69 in
  } else if (paper === 'legal' || paper === 'folio') {
    pageWidth = 12240; // 8.5 in
    pageHeight = 18720; // 13 in
  }

  const marginX = 720; // 0.5 in
  const marginY = 720;
  const availWidth = pageWidth - marginX * 2;

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

  // Header Table (3 columns: Left Logo, Center Letterhead, Right Logo)
  const logoColW = 1200;
  const centerTextColW = availWidth - logoColW * 2;
  const logoSizePt = 44;

  const headerTable = new Table({
    alignment: AlignmentType.CENTER,
    width: { size: availWidth, type: WidthType.DXA },
    columnWidths: [logoColW, centerTextColW, logoColW],
    borders: cellBordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: logoColW, type: WidthType.DXA },
            borders: cellBordersNone,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              depedBytes
                ? new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new ImageRun({
                        data: depedBytes,
                        transformation: { width: logoSizePt, height: logoSizePt },
                        type: 'png',
                      }),
                    ],
                  })
                : new Paragraph({}),
            ],
          }),
          new TableCell({
            width: { size: centerTextColW, type: WidthType.DXA },
            borders: cellBordersNone,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 200, before: 0, after: 10 },
                children: [
                  new TextRun({
                    text: 'Republic of the Philippines',
                    size: 22, // 11pt
                    font: 'Bookman Old Style',
                    color: '475569',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 200, before: 0, after: 10 },
                children: [
                  new TextRun({
                    text: 'Department of Education',
                    size: 22, // 11pt
                    bold: true,
                    font: 'Bookman Old Style',
                    color: '0F172A',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: logoColW, type: WidthType.DXA },
            borders: cellBordersNone,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              pnahsBytes
                ? new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new ImageRun({
                        data: pnahsBytes,
                        transformation: { width: logoSizePt, height: logoSizePt },
                        type: 'png',
                      }),
                    ],
                  })
                : new Paragraph({}),
            ],
          }),
        ],
      }),
    ],
  });

  // Boxed Header (School Name & BOSY List Title) - Size 16 (32 half-pts) Bold
  const boxedHeaderTable = new Table({
    alignment: AlignmentType.CENTER,
    width: { size: availWidth, type: WidthType.DXA },
    borders: cellBordersAll,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: availWidth, type: WidthType.DXA },
            borders: cellBordersAll,
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 30 },
                children: [
                  new TextRun({
                    text: (data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL').toUpperCase(),
                    size: 32, // 16pt
                    bold: true,
                    font: 'Bookman Old Style',
                    color: '000000',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: (data.title || 'BOSY LIST OF ARAL TUTEES').toUpperCase(),
                    size: 32, // 16pt
                    bold: true,
                    font: 'Bookman Old Style',
                    color: '000000',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // School Year Paragraph (Size 11 Bold)
  const schoolYearParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 120 },
    children: [
      new TextRun({
        text: data.schoolYear || '2026-2027',
        size: 22, // 11pt
        bold: true,
        font: 'Bookman Old Style',
        color: '000000',
      }),
    ],
  });

  // Meta row (GRADE LEVEL & TUTOR - Size 11 Bold)
  const metaParagraph = new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { before: 60, after: 80 },
    children: [
      new TextRun({
        text: `GRADE LEVEL: ${(data.gradeLevel || '7- HYACINTH').toUpperCase()}`,
        size: 22, // 11pt
        bold: true,
        font: 'Bookman Old Style',
      }),
      new TextRun({
        text: `\t\t\t\tTUTOR: ${(data.tutorName || 'RIZA J. GADIA').toUpperCase()}`,
        size: 22, // 11pt
        bold: true,
        font: 'Bookman Old Style',
      }),
    ],
  });

  // 8 Table Columns Widths (matching the client template proportions)
  const colWidths = [
    Math.round(availWidth * 0.05), // 1. No.
    Math.round(availWidth * 0.30), // 2. Name of Learner
    Math.round(availWidth * 0.08), // 3. BOSY
    Math.round(availWidth * 0.08), // 4. MOSY
    Math.round(availWidth * 0.08), // 5. EOSY
    Math.round(availWidth * 0.13), // 6. Subject Focus
    Math.round(availWidth * 0.16), // 7. Parent/Guardian
    Math.round(availWidth * 0.12), // 8. Contact No.
  ];
  colWidths[7] = availWidth - colWidths.slice(0, 7).reduce((a, b) => a + b, 0);

  const headerLabels = [
    'No.',
    'Name of Learner',
    'BOSY',
    'MOSY',
    'EOSY',
    'Subject Focus',
    'Parent/Guardian',
    'Contact No.',
  ];

  const headerRowCells = headerLabels.map((lbl, idx) => {
    return new TableCell({
      width: { size: colWidths[idx], type: WidthType.DXA },
      borders: cellBordersAll,
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: lbl,
              size: 22, // 11pt
              bold: true,
              font: 'Bookman Old Style',
              color: '000000',
            }),
          ],
        }),
      ],
    });
  });

  const sortedStudents = [...data.students].sort(compareNamesByLastName);

  const studentRows = sortedStudents.map((student, sIdx) => {
    const values = [
      String(sIdx + 1),
      formatStudentName(student),
      student.has_bosy ?? true ? 'TRUE' : '',
      student.has_mosy ? 'TRUE' : '',
      student.has_eosy ? 'TRUE' : '',
      (student.subject || 'ENGLISH').toUpperCase(),
      (student.parent_guardian_name || '').toUpperCase(),
      student.contact_number || '',
    ];

    return new TableRow({
      children: values.map((val, colIdx) => {
        const isCenter = [0, 2, 3, 4, 5, 7].includes(colIdx);
        return new TableCell({
          width: { size: colWidths[colIdx], type: WidthType.DXA },
          borders: cellBordersAll,
          margins: { top: 50, bottom: 50, left: 40, right: 40 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: isCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: val,
                  size: 22, // 11pt
                  font: 'Bookman Old Style',
                  color: '000000',
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  const dataTable = new Table({
    alignment: AlignmentType.CENTER,
    width: { size: availWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    borders: cellBordersAll,
    rows: [new TableRow({ children: headerRowCells }), ...studentRows],
  });

  // Signatories matching exact screenshot layout (Size 11, Times New Roman):
  const sigTableColW = Math.round(availWidth / 2);
  const signatoriesTable = new Table({
    alignment: AlignmentType.CENTER,
    width: { size: availWidth, type: WidthType.DXA },
    columnWidths: [sigTableColW, sigTableColW],
    borders: cellBordersNone,
    rows: [
      // Prepared by:
      new TableRow({
        children: [
          new TableCell({ width: { size: sigTableColW, type: WidthType.DXA }, borders: cellBordersNone, children: [] }),
          new TableCell({
            width: { size: sigTableColW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 240, after: 120 },
                children: [new TextRun({ text: 'Prepared by:', size: 22, font: 'Times New Roman' })],
              }),
            ],
          }),
        ],
      }),
      // Adviser & Tutor Names
      new TableRow({
        children: [
          new TableCell({
            width: { size: sigTableColW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: (data.adviserName || 'HAROLD M. BALBUENA').toUpperCase(),
                    size: 22,
                    bold: true,
                    underline: {},
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Adviser', size: 22, font: 'Times New Roman', color: '475569' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: sigTableColW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: (data.tutorName || 'RIZA J. GADIA').toUpperCase(),
                    size: 22,
                    bold: true,
                    underline: {},
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'TUTOR', size: 22, font: 'Times New Roman', color: '475569' })],
              }),
            ],
          }),
        ],
      }),
      // Checked: (Asst Principal)
      new TableRow({
        children: [
          new TableCell({
            width: { size: sigTableColW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                spacing: { before: 200, after: 40 },
                children: [new TextRun({ text: 'Checked:', size: 22, font: 'Times New Roman' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: (data.asstPrincipalName || 'GEORGE B. BASAS').toUpperCase(),
                    size: 22,
                    bold: true,
                    underline: {},
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Asst to the Principal/ HT-I', size: 22, font: 'Times New Roman', color: '475569' })],
              }),
            ],
          }),
          new TableCell({ width: { size: sigTableColW, type: WidthType.DXA }, borders: cellBordersNone, children: [] }),
        ],
      }),
      // Noted: (Principal)
      new TableRow({
        children: [
          new TableCell({
            width: { size: availWidth, type: WidthType.DXA },
            columnSpan: 2,
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 180, after: 40 },
                children: [new TextRun({ text: 'Noted:', size: 22, font: 'Times New Roman' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: (data.principalName || 'EULOGIO C. GADIA').toUpperCase(),
                    size: 22,
                    bold: true,
                    underline: {},
                    font: 'Times New Roman',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Principal I', size: 22, font: 'Times New Roman', color: '475569' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: pageWidth, height: pageHeight, orientation: PageOrientation.PORTRAIT },
            margin: { top: marginY, bottom: marginY, left: marginX, right: marginX },
          },
        },
        children: [
          headerTable,
          boxedHeaderTable,
          schoolYearParagraph,
          metaParagraph,
          dataTable,
          signatoriesTable,
        ],
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(buffer);
  const anchor = document.createElement('a');
  anchor.href = url;
  const titleClean = (data.title || 'LIST_OF_ARAL_TUTEES').replace(/[^a-zA-Z0-9]/g, '_');
  const gradeLabel = (data.gradeLevel || 'GRADE_7').replace(/[^a-zA-Z0-9]/g, '_');
  anchor.download = `PNAHS_${titleClean}_${gradeLabel}_${data.schoolYear || '2026-2027'}.docx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

/**
 * Export official 8-column List of ARAL Tutees to PDF (.pdf)
 * Strictly matching the official Bookman Old Style template:
 * Header: 16pt (bold), All other elements: 11pt
 */
export const exportBosyListToPdf = async (data: BosyExportData): Promise<void> => {
  const paper = data.paperSize || 'letter';
  let pageWidth = 612; // 8.5 in (Portrait Letter)
  let pageHeight = 792; // 11 in
  let pageFormat: string | [number, number] = 'letter';

  if (paper === 'a4') {
    pageWidth = 595.28; // 8.27 in
    pageHeight = 841.89; // 11.69 in
    pageFormat = 'a4';
  } else if (paper === 'legal' || paper === 'folio') {
    pageWidth = 612; // 8.5 in
    pageHeight = 936; // 13 in
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

  // Header Letterhead Logos
  const logoSize = 40;
  const logoY = marginTop;

  try {
    pdf.addImage(DEPED_LOGO_BASE64, 'PNG', centerX - 160, logoY, logoSize, logoSize);
  } catch (e) {
    console.warn('Could not add DepEd logo to PDF:', e);
  }

  try {
    pdf.addImage(PNAHS_LOGO_BASE64, 'PNG', centerX + 120, logoY, logoSize, logoSize);
  } catch (e) {
    console.warn('Could not add PNAHS logo to PDF:', e);
  }

  // Boxed Header for School Name & Document Title (Size 16 Bold)
  const boxW = Math.min(availWidth * 0.9, 440);
  const boxX = centerX - boxW / 2;
  const boxY = marginTop + 44;
  const boxH = 46;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(1);
  pdf.rect(boxX, boxY, boxW, boxH, 'S');

  pdf.setFont('times', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text((data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL').toUpperCase(), centerX, boxY + 19, { align: 'center' });
  pdf.text((data.title || 'BOSY LIST OF ARAL TUTEES').toUpperCase(), centerX, boxY + 37, { align: 'center' });

  // School Year (Size 11 Bold)
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.text(data.schoolYear || '2026-2027', centerX, boxY + 62, { align: 'center' });

  // Sub-header Row: Grade Level (Left) & Tutor (Right) - Size 11 Bold
  const metaY = boxY + 80;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.text(`GRADE LEVEL: ${(data.gradeLevel || '7- HYACINTH').toUpperCase()}`, marginX, metaY);
  pdf.text(`TUTOR: ${(data.tutorName || 'RIZA J. GADIA').toUpperCase()}`, pageWidth - marginX, metaY, { align: 'right' });

  // 8 Table Columns Widths
  const colWidths = [
    availWidth * 0.06, // 1. No.
    availWidth * 0.32, // 2. Name of Learner
    availWidth * 0.08, // 3. BOSY
    availWidth * 0.08, // 4. MOSY
    availWidth * 0.08, // 5. EOSY
    availWidth * 0.12, // 6. Subject Focus
    availWidth * 0.14, // 7. Parent/Guardian
    availWidth * 0.12, // 8. Contact No.
  ];
  colWidths[7] = availWidth - colWidths.slice(0, 7).reduce((a, b) => a + b, 0);

  const headerLabels = [
    'No.',
    'Name of Learner',
    'BOSY',
    'MOSY',
    'EOSY',
    'Subject Focus',
    'Parent/Guardian',
    'Contact No.',
  ];

  let curY = metaY + 8;
  const rowHeight = 18;
  const headerHeight = 22;

  // Header Row (Size 11 / 10pt bold)
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.rect(marginX, curY, availWidth, headerHeight, 'S');

  let curX = marginX;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);

  headerLabels.forEach((lbl, idx) => {
    const colW = colWidths[idx];
    pdf.line(curX, curY, curX, curY + headerHeight);
    pdf.text(lbl, curX + colW / 2, curY + 15, { align: 'center' });
    curX += colW;
  });

  curY += headerHeight;

  // Student Rows (Size 11 / 10pt normal)
  const sortedStudents = [...data.students].sort(compareNamesByLastName);

  sortedStudents.forEach((student, idx) => {
    if (curY + rowHeight > pageHeight - 110) {
      pdf.addPage(pageFormat, 'portrait');
      curY = marginTop;
      pdf.rect(marginX, curY, availWidth, headerHeight, 'S');

      let rx = marginX;
      headerLabels.forEach((lbl, hIdx) => {
        const colW = colWidths[hIdx];
        pdf.line(rx, curY, rx, curY + headerHeight);
        pdf.text(lbl, rx + colW / 2, curY + 15, { align: 'center' });
        rx += colW;
      });
      curY += headerHeight;
    }

    pdf.rect(marginX, curY, availWidth, rowHeight, 'S');

    const values = [
      String(idx + 1),
      formatStudentName(student),
      student.has_bosy ?? true ? 'TRUE' : '',
      student.has_mosy ? 'TRUE' : '',
      student.has_eosy ? 'TRUE' : '',
      (student.subject || 'ENGLISH').toUpperCase(),
      (student.parent_guardian_name || '').toUpperCase(),
      student.contact_number || '',
    ];

    let rowX = marginX;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(0, 0, 0);

    values.forEach((val, cIdx) => {
      const colW = colWidths[cIdx];
      pdf.line(rowX, curY, rowX, curY + rowHeight);
      const isCenter = [0, 2, 3, 4, 5, 7].includes(cIdx);
      if (isCenter) {
        pdf.text(val, rowX + colW / 2, curY + 12, { align: 'center' });
      } else {
        pdf.text(val, rowX + 4, curY + 12, { maxWidth: colW - 6 });
      }
      rowX += colW;
    });

    curY += rowHeight;
  });

  // Signatories Section (Size 11)
  let sigY = curY + 24;
  if (sigY + 90 > pageHeight) {
    pdf.addPage(pageFormat, 'portrait');
    sigY = marginTop + 20;
  }

  // Prepared by: (right side)
  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text('Prepared by:', marginX + (availWidth / 2) + 40, sigY);

  sigY += 26;

  // Adviser & Tutor
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.text((data.adviserName || 'HAROLD M. BALBUENA').toUpperCase(), marginX + 60, sigY, { align: 'center' });
  pdf.text((data.tutorName || 'RIZA J. GADIA').toUpperCase(), marginX + (availWidth / 2) + 90, sigY, { align: 'center' });

  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text('Adviser', marginX + 60, sigY + 12, { align: 'center' });
  pdf.text('TUTOR', marginX + (availWidth / 2) + 90, sigY + 12, { align: 'center' });

  sigY += 26;

  // Checked: (Asst Principal)
  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text('Checked:', marginX, sigY);

  sigY += 18;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.text((data.asstPrincipalName || 'GEORGE B. BASAS').toUpperCase(), marginX + 60, sigY, { align: 'center' });
  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text('Asst to the Principal/ HT-I', marginX + 60, sigY + 12, { align: 'center' });

  sigY += 26;

  // Noted: (Principal)
  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text('Noted:', centerX, sigY, { align: 'center' });

  sigY += 18;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.text((data.principalName || 'EULOGIO C. GADIA').toUpperCase(), centerX, sigY, { align: 'center' });
  pdf.setFont('times', 'normal');
  pdf.setFontSize(11);
  pdf.text('Principal I', centerX, sigY + 12, { align: 'center' });

  const titleClean = (data.title || 'LIST_OF_ARAL_TUTEES').replace(/[^a-zA-Z0-9]/g, '_');
  const gradeLabel = (data.gradeLevel || 'GRADE_7').replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`PNAHS_${titleClean}_${gradeLabel}_${data.schoolYear || '2026-2027'}.pdf`);
};

/**
 * Export official 8-column List of ARAL Tutees to CSV (.csv)
 */
export const exportBosyListToCsv = (data: BosyExportData): void => {
  const headers = [
    'No.',
    'Name of Learner',
    'BOSY',
    'MOSY',
    'EOSY',
    'Subject Focus',
    'Parent/Guardian',
    'Contact No.',
  ];

  const sortedStudents = [...data.students].sort(compareNamesByLastName);

  const rows = sortedStudents.map((student, idx) => {
    const formattedName = formatStudentName(student);

    return [
      idx + 1,
      `"${formattedName.replace(/"/g, '""')}"`,
      student.has_bosy ?? true ? 'TRUE' : '',
      student.has_mosy ? 'TRUE' : '',
      student.has_eosy ? 'TRUE' : '',
      `"${(student.subject || 'ENGLISH').replace(/"/g, '""')}"`,
      `"${(student.parent_guardian_name || '').replace(/"/g, '""')}"`,
      `"${(student.contact_number || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const metaHeader = [
    `"${data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL'}"`,
    `"${data.title || 'BOSY LIST OF ARAL TUTEES'}"`,
    `"${data.schoolYear || '2026-2027'}"`,
    `"GRADE LEVEL: ${(data.gradeLevel || '7- HYACINTH')}"`,
    `"TUTOR: ${(data.tutorName || 'RIZA J. GADIA')}"`,
    '',
  ].join('\n');

  const csvContent = `${metaHeader}\n${headers.join(',')}\n${rows.join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const titleClean = (data.title || 'LIST_OF_ARAL_TUTEES').replace(/[^a-zA-Z0-9]/g, '_');
  const gradeLabel = (data.gradeLevel || 'GRADE_7').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `PNAHS_${titleClean}_${gradeLabel}_${data.schoolYear || '2026-2027'}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

