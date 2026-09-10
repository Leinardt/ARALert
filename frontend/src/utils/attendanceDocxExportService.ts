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
import type { AttendanceExportData } from './attendanceExportService';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';

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
  color: '1E293B',
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

export const exportAttendanceToDocx = async (data: AttendanceExportData): Promise<void> => {
  const allDays = data.weeks.flatMap((w) => w.days);
  const totalDayCols = allDays.length;

  // Paper setup matching Excel & preview: always PORTRAIT, sized by data.paperSize
  const paper = data.paperSize || 'letter';
  let pageWidth = 12240; // 8.5 in (Letter & Folio width)
  let pageHeight = 15840; // 11 in (Letter height)

  if (paper === 'a4') {
    pageWidth = 11906; // 8.27 in
    pageHeight = 16838; // 11.69 in
  } else if (paper === 'folio') {
    pageWidth = 12240; // 8.5 in
    pageHeight = 18720; // 13 in
  }

  // Margins: 0.5 in (720 dxa) for monthly to comfortably fit 20-22 days in portrait without clipping;
  // 0.75 in (1080 dxa) for weekly / daily
  const marginX = totalDayCols > 5 ? 720 : 1080;
  const marginY = totalDayCols > 5 ? 720 : 1080;
  const availWidth = pageWidth - marginX * 2;

  // Convert logos
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

  // 1. Header Table (3 columns: Left Logo, Center Letterhead, Right Logo)
  // Logos sized at 65×65 pt with balanced spacing from the header text
  const logoSizePt = 65;
  const logoColW = 1550;
  const centerTextColW = 5800;
  const headerTableW = logoColW * 2 + centerTextColW; // 8900 dxa

  const headerTable = new Table({
    alignment: AlignmentType.CENTER,
    width: { size: headerTableW, type: WidthType.DXA },
    columnWidths: [logoColW, centerTextColW, logoColW],
    borders: cellBordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: logoColW, type: WidthType.DXA },
            borders: cellBordersNone,
            margins: { top: 0, bottom: 0, left: 0, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              depedBytes
                ? new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: depedBytes,
                        transformation: { width: logoSizePt, height: logoSizePt },
                      }),
                    ],
                  })
                : new Paragraph({ children: [] }),
            ],
          }),
          new TableCell({
            width: { size: centerTextColW, type: WidthType.DXA },
            borders: cellBordersNone,
            margins: { top: 0, bottom: 0, left: 100, right: 100 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 20, line: 240 },
                children: [
                  new TextRun({
                    text: data.division.toUpperCase(),
                    font: 'Times New Roman',
                    size: 19, // 9.5pt
                    color: '475569',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 20, line: 240 },
                children: [
                  new TextRun({
                    text: data.district.toUpperCase(),
                    font: 'Times New Roman',
                    size: 19,
                    color: '475569',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 20, line: 240 },
                children: [
                  new TextRun({
                    text: data.schoolName.toUpperCase(),
                    font: 'Times New Roman',
                    size: 23, // 11.5pt
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 240 },
                children: [
                  new TextRun({
                    text: data.schoolAddress,
                    font: 'Times New Roman',
                    size: 18, // 9pt
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: logoColW, type: WidthType.DXA },
            borders: cellBordersNone,
            margins: { top: 0, bottom: 0, left: 120, right: 0 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              pnahsBytes
                ? new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: pnahsBytes,
                        transformation: { width: logoSizePt, height: logoSizePt },
                      }),
                    ],
                  })
                : new Paragraph({ children: [] }),
            ],
          }),
        ],
      }),
    ],
  });

  // 2. Document Title & Section
  const subjectTitlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 140, after: 20, line: 240 },
    children: [
      new TextRun({
        text: data.subjectTitle.toUpperCase(),
        font: 'Times New Roman',
        size: 23, // 11.5pt
        bold: true,
        color: '0F172A',
      }),
    ],
  });

  const gradeSectionPara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 20, after: 140, line: 240 },
    children: [
      new TextRun({
        text: data.gradeSection.toUpperCase(),
        font: 'Times New Roman',
        size: 20, // 10pt
        bold: true,
        color: '334155',
      }),
    ],
  });

  // 3. Period Meta Line (WEEK on left, DATE on right with underline)
  const metaHalfW = Math.floor(availWidth / 2);
  const metaTable = new Table({
    width: { size: availWidth, type: WidthType.DXA },
    columnWidths: [metaHalfW, availWidth - metaHalfW],
    borders: cellBordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: metaHalfW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: 'WEEK:  ',
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    color: '0F172A',
                  }),
                  new TextRun({
                    text: `\u00A0\u00A0\u00A0\u00A0${data.weekNumber || '1'}\u00A0\u00A0\u00A0\u00A0`,
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    underline: {},
                    color: '0F172A',
                  }),
                  new TextRun({
                    text: '\u200B',
                    font: 'Times New Roman',
                    size: 19,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: availWidth - metaHalfW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'DATE:  ',
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    color: '0F172A',
                  }),
                  new TextRun({
                    text: `\u00A0\u00A0\u00A0\u00A0${data.dateStr || '_______'}\u00A0\u00A0\u00A0\u00A0`,
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    underline: {},
                    color: '0F172A',
                  }),
                  new TextRun({
                    text: '\u200B',
                    font: 'Times New Roman',
                    size: 19,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 4. Attendance Data Table - Proportioned to match Excel columns exactly
  let indexColWidth: number;
  let nameColWidth: number;
  let sigColWidth: number;
  let dayColWidth: number;

  if (totalDayCols <= 1) {
    indexColWidth = 600;
    nameColWidth = Math.floor(availWidth * 0.44);
    dayColWidth = Math.floor(availWidth * 0.22);
    sigColWidth = availWidth - indexColWidth - nameColWidth - dayColWidth;
  } else if (totalDayCols <= 5) {
    indexColWidth = 500;
    nameColWidth = Math.floor(availWidth * 0.35);
    sigColWidth = Math.floor(availWidth * 0.20);
    const remForDays = availWidth - indexColWidth - nameColWidth - sigColWidth;
    dayColWidth = Math.floor(remForDays / totalDayCols);
    sigColWidth = availWidth - indexColWidth - nameColWidth - (dayColWidth * totalDayCols);
  } else {
    // Monthly mode (20-22 days)
    indexColWidth = 420;
    nameColWidth = Math.floor(availWidth * 0.25); // ~2650 dxa
    sigColWidth = Math.floor(availWidth * 0.12);  // ~1250 dxa
    const remForDays = availWidth - indexColWidth - nameColWidth - sigColWidth;
    dayColWidth = Math.floor(remForDays / totalDayCols);
    sigColWidth = availWidth - indexColWidth - nameColWidth - (dayColWidth * totalDayCols);
  }

  const tableRows: TableRow[] = [];
  const isMonthly = totalDayCols > 5;
  const headerFontSize = isMonthly ? 16 : 19; // 8pt vs 9.5pt
  const nameFontSize = isMonthly ? 17 : 19;   // 8.5pt vs 9.5pt
  const markFontSize = isMonthly ? 17 : 21;   // 8.5pt vs 10.5pt
  const weekFontSize = isMonthly ? 15 : 18;   // 7.5pt vs 9pt

  // Generous padding inside column labels so headers are never cramped
  const headerCellMargins = {
    top: isMonthly ? 100 : 130,
    bottom: isMonthly ? 100 : 130,
    left: isMonthly ? 40 : 80,
    right: isMonthly ? 40 : 80,
  };

  const dayHeaderCellMargins = {
    top: isMonthly ? 80 : 110,
    bottom: isMonthly ? 80 : 110,
    left: isMonthly ? 20 : 40,
    right: isMonthly ? 20 : 40,
  };

  const dayCellMargins = {
    top: isMonthly ? 50 : 70,
    bottom: isMonthly ? 50 : 70,
    left: isMonthly ? 15 : 40,
    right: isMonthly ? 15 : 40,
  };

  const studentCellMargins = {
    top: isMonthly ? 50 : 70,
    bottom: isMonthly ? 50 : 70,
    left: isMonthly ? 60 : 80,
    right: isMonthly ? 60 : 80,
  };

  // Header Row 1
  if (totalDayCols <= 1) {
    tableRows.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: indexColWidth, type: WidthType.DXA },
            borders: cellBordersAll,
            shading: { fill: 'F8FAFC' },
            margins: headerCellMargins,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40, line: 240 },
                children: [new TextRun({ text: '#', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: nameColWidth, type: WidthType.DXA },
            borders: cellBordersAll,
            shading: { fill: 'F8FAFC' },
            margins: headerCellMargins,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40, line: 240 },
                children: [new TextRun({ text: 'NAME OF THE STUDENTS', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: dayColWidth, type: WidthType.DXA },
            borders: cellBordersAll,
            shading: { fill: 'F8FAFC' },
            margins: headerCellMargins,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40, line: 240 },
                children: [new TextRun({ text: data.weeks[0]?.label || 'DATE', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: sigColWidth, type: WidthType.DXA },
            borders: cellBordersAll,
            shading: { fill: 'F8FAFC' },
            margins: headerCellMargins,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40, line: 240 },
                children: [new TextRun({ text: 'SIGNATURE', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
              }),
            ],
          }),
        ],
      })
    );
  } else {
    // Multi-day Header Row 1: Week ranges
    const headRow1Cells: TableCell[] = [
      new TableCell({
        width: { size: indexColWidth, type: WidthType.DXA },
        rowSpan: 2,
        borders: cellBordersAll,
        shading: { fill: 'F8FAFC' },
        margins: headerCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 50, after: 50, line: 240 },
            children: [new TextRun({ text: '#', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: nameColWidth, type: WidthType.DXA },
        rowSpan: 2,
        borders: cellBordersAll,
        shading: { fill: 'F8FAFC' },
        margins: headerCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 50, after: 50, line: 240 },
            children: [new TextRun({ text: 'NAME OF THE STUDENTS', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
          }),
        ],
      }),
    ];

    data.weeks.forEach((week) => {
      headRow1Cells.push(
        new TableCell({
          columnSpan: week.days.length,
          width: { size: dayColWidth * week.days.length, type: WidthType.DXA },
          borders: cellBordersAll,
          shading: { fill: 'F8FAFC' },
          margins: headerCellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40, line: 240 },
              children: [new TextRun({ text: week.label, font: 'Times New Roman', size: weekFontSize, bold: true, color: '0F172A' })],
            }),
          ],
        })
      );
    });

    headRow1Cells.push(
      new TableCell({
        width: { size: sigColWidth, type: WidthType.DXA },
        rowSpan: 2,
        borders: cellBordersAll,
        shading: { fill: 'F8FAFC' },
        margins: headerCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 50, after: 50, line: 240 },
            children: [new TextRun({ text: 'SIGNATURE', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
          }),
        ],
      })
    );

    tableRows.push(new TableRow({ tableHeader: true, cantSplit: true, children: headRow1Cells }));

    // Multi-day Header Row 2: Day Numbers
    const headRow2Cells: TableCell[] = [];
    allDays.forEach((day) => {
      headRow2Cells.push(
        new TableCell({
          width: { size: dayColWidth, type: WidthType.DXA },
          borders: cellBordersAll,
          shading: { fill: 'FFFFFF' },
          margins: dayHeaderCellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 30, after: 30, line: 240 },
              children: [new TextRun({ text: String(day.dayNum), font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
            }),
          ],
        })
      );
    });
    tableRows.push(new TableRow({ tableHeader: true, cantSplit: true, children: headRow2Cells }));
  }

  // Student Data Rows
  data.students.forEach((student, idx) => {
    const studentCells: TableCell[] = [
      new TableCell({
        width: { size: indexColWidth, type: WidthType.DXA },
        borders: cellBordersAll,
        margins: studentCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 20, after: 20, line: 240 },
            children: [new TextRun({ text: String(idx + 1), font: 'Times New Roman', size: headerFontSize, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: nameColWidth, type: WidthType.DXA },
        borders: cellBordersAll,
        margins: studentCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 20, after: 20, line: 240 },
            children: [new TextRun({ text: student.name.toUpperCase(), font: 'Times New Roman', size: nameFontSize, bold: true, color: '0F172A' })],
          }),
        ],
      }),
    ];

    allDays.forEach((day) => {
      const status = student.statusByDate[day.dateKey] || '';
      let markText = '';
      let markColor = '0F172A';
      if (status === 'P' || status === 'present') {
        markText = '/';
        markColor = '047857'; // emerald-700
      } else if (status === 'L' || status === 'late') {
        markText = '/';
        markColor = 'B45309'; // amber-700
      } else if (status === 'A' || status === 'absent') {
        markText = 'X';
        markColor = 'BE123C'; // rose-700
      }

      studentCells.push(
        new TableCell({
          width: { size: dayColWidth, type: WidthType.DXA },
          borders: cellBordersAll,
          margins: dayCellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 20, line: 240 },
              children: [new TextRun({ text: markText, font: 'Times New Roman', size: markFontSize, bold: true, color: markColor })],
            }),
          ],
        })
      );
    });

    studentCells.push(
      new TableCell({
        width: { size: sigColWidth, type: WidthType.DXA },
        borders: cellBordersAll,
        margins: studentCellMargins,
        children: [new Paragraph({ children: [] })],
      })
    );

    tableRows.push(new TableRow({ cantSplit: true, children: studentCells }));
  });

  const colWidthsArray = [
    indexColWidth,
    nameColWidth,
    ...allDays.map(() => dayColWidth),
    sigColWidth,
  ];

  const attendanceTable = new Table({
    width: { size: availWidth, type: WidthType.DXA },
    columnWidths: colWidthsArray,
    borders: cellBordersAll,
    rows: tableRows,
  });

  // 5. Signature Section - Proportioned cleanly matching Excel export
  const signatureBorderBottom = {
    style: BorderStyle.SINGLE,
    size: 12, // medium border
    color: '0F172A',
  };

  const leftSigW = Math.floor(availWidth * 0.44);
  const spacerW = Math.floor(availWidth * 0.12);
  const rightSigW = availWidth - leftSigW - spacerW;

  const sigBlockTable = new Table({
    width: { size: availWidth, type: WidthType.DXA },
    columnWidths: [leftSigW, spacerW, rightSigW],
    borders: cellBordersNone,
    rows: [
      // Top spacing
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            borders: cellBordersNone,
            children: [new Paragraph({ spacing: { before: 200 } })],
          }),
        ],
      }),
      // "Prepared by:" on the right
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftSigW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: spacerW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: rightSigW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'Prepared by:', font: 'Times New Roman', size: 19, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: 260 } }), // Physical pen signing space
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: data.tutorName.toUpperCase(),
                    font: 'Times New Roman',
                    size: 21,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: data.tutorTitle,
                    font: 'Times New Roman',
                    size: 18,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Spacing between Tutor block and Checked/Noted block
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            borders: cellBordersNone,
            children: [new Paragraph({ spacing: { before: 180 } })],
          }),
        ],
      }),
      // "Checked:" (Left) and "Noted:" (Right)
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftSigW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'Checked:', font: 'Times New Roman', size: 19, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: 260 } }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: data.checkedName.toUpperCase(),
                    font: 'Times New Roman',
                    size: 21,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: data.checkedTitle,
                    font: 'Times New Roman',
                    size: 18,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: spacerW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: rightSigW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'Noted:', font: 'Times New Roman', size: 19, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: 260 } }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: data.notedName.toUpperCase(),
                    font: 'Times New Roman',
                    size: 21,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: data.notedTitle,
                    font: 'Times New Roman',
                    size: 18,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Construct Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageWidth,
              height: pageHeight,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: marginY,
              bottom: marginY,
              left: marginX,
              right: marginX,
            },
          },
        },
        children: [
          headerTable,
          subjectTitlePara,
          gradeSectionPara,
          metaTable,
          new Paragraph({ spacing: { before: 0, after: 80 } }),
          attendanceTable,
          sigBlockTable,
        ],
      },
    ],
  });

  // Export buffer & download
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `Student_Attendance_Register_${(data.gradeSection || 'Class').replace(/\s+/g, '_')}_${(data.dateStr || 'Register').replace(/[\/\s:]/g, '_')}.docx`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
