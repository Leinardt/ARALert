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
import { formatAttendanceDateHeader, buildAttendanceFilename, type AttendanceExportData } from './attendanceExportService';
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
  const isMonthly = totalDayCols > 5;
  const totalStudents = Math.max(data.students.length, 1);

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

  // Adaptive density scaling based on both student count and selected paper height (20 dxa = 1 pt)
  const rawBudgetPerStudentPt = (pageHeight / 20 - 250) / totalStudents;
  const isDense = rawBudgetPerStudentPt < 13.5;
  const isCompact = rawBudgetPerStudentPt >= 13.5 && rawBudgetPerStudentPt < 17;
  const isMedium = rawBudgetPerStudentPt >= 17 && rawBudgetPerStudentPt < 22;

  // Margins scaled for 1-page fit
  const marginX = isMonthly ? 576 : 720;
  const marginTop = isDense ? 360 : isCompact ? 440 : isMedium ? 560 : isMonthly ? 680 : 760;
  const marginBottom = isDense ? 240 : isCompact ? 300 : isMedium ? 380 : isMonthly ? 460 : 500;
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
  const logoSizePt = isDense || isCompact ? 38 : 42;
  const logoColW = isMonthly ? 1100 : 1300;
  const centerTextColW = availWidth - logoColW * 2;
  const headerTableW = availWidth;

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
                spacing: { before: 0, after: 15, line: 220 },
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
                spacing: { before: 0, after: 15, line: 220 },
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
                spacing: { before: 0, after: 15, line: 220 },
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
                spacing: { before: 0, after: 0, line: 220 },
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
    spacing: { before: isDense || isCompact ? 50 : 80, after: 15, line: 210 },
    children: [
      new TextRun({
        text: data.subjectTitle.toUpperCase(),
        font: 'Times New Roman',
        size: isDense ? 20 : 22, // 10pt vs 11pt
        bold: true,
        color: '0F172A',
      }),
    ],
  });

  const gradeSectionPara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 10, after: isDense ? 80 : isCompact ? 120 : isMedium ? 160 : 220, line: 210 },
    children: [
      new TextRun({
        text: (data.gradeSection || 'MIXED (GRADES 7-10)').toUpperCase(),
        font: 'Times New Roman',
        size: isDense ? 18 : 19, // 9pt vs 9.5pt
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

  // Calculate available vertical space for student rows on 1 page
  const headerDxa = isDense ? 1750 : isCompact ? 1900 : 2150;
  const tableHeaderDxa = isDense ? 280 : isCompact ? 320 : 380;
  const sigBlockDxa = isDense ? 1200 : isCompact ? 1450 : isMedium ? 1750 : 2100;
  const availTableDxa = pageHeight - marginTop - marginBottom - headerDxa - tableHeaderDxa - sigBlockDxa;
  const rowBudgetPt = (availTableDxa / 20) / totalStudents;

  const tableRows: TableRow[] = [];
  const headerFontSize = isMonthly ? (isDense ? 14 : 15) : (isDense ? 15 : 17);
  const nameFontSize =
    rowBudgetPt >= 18 ? (isMonthly ? 17 : 18) :
    rowBudgetPt >= 15.5 ? 17 :
    rowBudgetPt >= 13.5 ? 16 :
    rowBudgetPt >= 12 ? 15 :
    rowBudgetPt >= 10.5 ? 14 : 13;
  const indexFontSize = Math.min(headerFontSize, nameFontSize);
  const markFontSize = Math.min(isMonthly ? 16 : 19, nameFontSize + 1);
  const cellPadY =
    rowBudgetPt >= 18 ? 35 :
    rowBudgetPt >= 15.5 ? 24 :
    rowBudgetPt >= 13.5 ? 16 :
    rowBudgetPt >= 12 ? 10 :
    rowBudgetPt >= 10.5 ? 6 : 2;
  const rowLineSpacing =
    rowBudgetPt >= 15.5 ? 220 :
    rowBudgetPt >= 13 ? 200 :
    rowBudgetPt >= 11 ? 185 : 170;
  const headSpaceY = isDense ? 25 : isCompact ? 35 : 50;

  // Streamlined padding inside column labels so headers are never cramped
  const headerCellMargins = {
    top: headSpaceY,
    bottom: headSpaceY,
    left: isMonthly ? 25 : 50,
    right: isMonthly ? 25 : 50,
  };

  const dayHeaderCellMargins = {
    top: Math.max(20, headSpaceY - 10),
    bottom: Math.max(20, headSpaceY - 10),
    left: 15,
    right: 15,
  };

  const dayCellMargins = {
    top: cellPadY,
    bottom: cellPadY,
    left: 15,
    right: 15,
  };

  const studentCellMargins = {
    top: cellPadY,
    bottom: cellPadY,
    left: 40,
    right: 40,
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
                spacing: { before: headSpaceY, after: headSpaceY, line: 220 },
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
                spacing: { before: headSpaceY, after: headSpaceY, line: 220 },
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
                spacing: { before: headSpaceY, after: headSpaceY, line: 220 },
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
                spacing: { before: headSpaceY, after: headSpaceY, line: 220 },
                children: [new TextRun({ text: 'SIGNATURE', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
              }),
            ],
          }),
        ],
      })
    );
  } else {
    // Multi-day Header: Single clean row with Day Numbers (no redundant week date range row)
    const headCells: TableCell[] = [
      new TableCell({
        width: { size: indexColWidth, type: WidthType.DXA },
        borders: cellBordersAll,
        shading: { fill: 'F8FAFC' },
        margins: headerCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: headSpaceY, after: headSpaceY, line: 220 },
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
            spacing: { before: headSpaceY, after: headSpaceY, line: 220 },
            children: [new TextRun({ text: 'NAME OF THE STUDENTS', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
          }),
        ],
      }),
    ];

    allDays.forEach((day) => {
      const cellText = totalDayCols <= 1 ? formatAttendanceDateHeader(day.dateKey, day.dayNum) : String(day.dayNum);

      headCells.push(
        new TableCell({
          width: { size: dayColWidth, type: WidthType.DXA },
          borders: cellBordersAll,
          shading: { fill: 'F8FAFC' },
          margins: dayHeaderCellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: Math.max(20, headSpaceY - 10), after: Math.max(20, headSpaceY - 10), line: 220 },
              children: [new TextRun({ text: cellText, font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
            }),
          ],
        })
      );
    });

    headCells.push(
      new TableCell({
        width: { size: sigColWidth, type: WidthType.DXA },
        borders: cellBordersAll,
        shading: { fill: 'F8FAFC' },
        margins: headerCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: headSpaceY, after: headSpaceY, line: 220 },
            children: [new TextRun({ text: 'SIGNATURE', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
          }),
        ],
      })
    );

    tableRows.push(new TableRow({ tableHeader: true, cantSplit: true, children: headCells }));
  }

  // Student Data Rows
  data.students.forEach((student, idx) => {
    const cleanName = student.name.toUpperCase();
    const effectiveNameSize = cleanName.length > 32 ? Math.max(12, nameFontSize - 2) : nameFontSize;

    const studentCells: TableCell[] = [
      new TableCell({
        width: { size: indexColWidth, type: WidthType.DXA },
        borders: cellBordersAll,
        margins: studentCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: rowLineSpacing },
            children: [new TextRun({ text: String(idx + 1), font: 'Times New Roman', size: indexFontSize, color: '0F172A' })],
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
            spacing: { before: 0, after: 0, line: rowLineSpacing },
            children: [new TextRun({ text: cleanName, font: 'Times New Roman', size: effectiveNameSize, bold: true, color: '0F172A' })],
          }),
        ],
      }),
    ];

    allDays.forEach((day) => {
      const status = student.statusByDate[day.dateKey] || '';
      let markText = '';
      const markColor = '0F172A';
      if (status === 'P' || status === 'present') {
        markText = '/';
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
              spacing: { before: 0, after: 0, line: rowLineSpacing },
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
        children: [new Paragraph({ spacing: { before: 0, after: 0, line: rowLineSpacing }, children: [] })],
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

  // 5. Signature Section (Order: 1. Signature Line, 2. Fullname below line, 3. Role below fullname)
  const signatureBorderBottom = {
    style: BorderStyle.SINGLE,
    size: 12, // medium border
    color: '0F172A',
  };

  const leftSigW = Math.floor(availWidth * 0.44);
  const spacerW = Math.floor(availWidth * 0.12);
  const rightSigW = availWidth - leftSigW - spacerW;

  const sigTopGapDxa = isDense ? 140 : isCompact ? 200 : isMedium ? 260 : 340;
  const sigSignSpaceDxa = isDense ? 180 : isCompact ? 240 : isMedium ? 300 : 380;
  const sigMidGapDxa = isDense ? 120 : isCompact ? 160 : isMedium ? 200 : 260;
  const sigLabelSize = isDense ? 16 : 17;
  const sigNameBaseSize = isDense ? 17 : isCompact ? 18 : 19;
  const sigRoleSize = isDense ? 15 : 16;

  const tutorNameStr = (data.tutorName || 'TUTOR FULL NAME').toUpperCase();
  const checkedNameStr = (data.checkedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase();
  const notedNameStr = (data.notedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase();

  const sigBlockTable = new Table({
    width: { size: availWidth, type: WidthType.DXA },
    columnWidths: [leftSigW, spacerW, rightSigW],
    borders: cellBordersNone,
    rows: [
      // "Prepared by:" on the right
      new TableRow({
        cantSplit: true,
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
                spacing: { before: sigTopGapDxa, after: 0, line: 200 },
                children: [new TextRun({ text: 'Prepared by:', font: 'Times New Roman', size: sigLabelSize, italics: true, color: '0F172A' })],
              }),
              // 1. Line for the signature
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: sigSignSpaceDxa, after: 40, line: 40 },
                border: { bottom: signatureBorderBottom },
                children: [new TextRun({ text: '', font: 'Times New Roman', size: 4 })],
              }),
              // 2. Fullname below the line
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 10, line: 200 },
                children: [
                  new TextRun({
                    text: tutorNameStr,
                    font: 'Times New Roman',
                    size: tutorNameStr.length > 26 ? Math.max(14, sigNameBaseSize - 2) : sigNameBaseSize,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              // 3. Role below the fullname
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 10, after: 0, line: 180 },
                children: [
                  new TextRun({
                    text: data.tutorTitle,
                    font: 'Times New Roman',
                    size: sigRoleSize,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      // "Checked:" (Left) and "Noted:" (Right)
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: leftSigW, type: WidthType.DXA },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: sigMidGapDxa, after: 0, line: 200 },
                children: [new TextRun({ text: 'Checked:', font: 'Times New Roman', size: sigLabelSize, italics: true, color: '0F172A' })],
              }),
              // 1. Line for the signature
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: sigSignSpaceDxa, after: 40, line: 40 },
                border: { bottom: signatureBorderBottom },
                children: [new TextRun({ text: '', font: 'Times New Roman', size: 4 })],
              }),
              // 2. Fullname below the line
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 10, line: 200 },
                children: [
                  new TextRun({
                    text: checkedNameStr,
                    font: 'Times New Roman',
                    size: checkedNameStr.length > 26 ? Math.max(14, sigNameBaseSize - 2) : sigNameBaseSize,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              // 3. Role below the fullname
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 10, after: 0, line: 180 },
                children: [
                  new TextRun({
                    text: data.checkedTitle,
                    font: 'Times New Roman',
                    size: sigRoleSize,
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
                spacing: { before: sigMidGapDxa, after: 0, line: 200 },
                children: [new TextRun({ text: 'Noted:', font: 'Times New Roman', size: sigLabelSize, italics: true, color: '0F172A' })],
              }),
              // 1. Line for the signature
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: sigSignSpaceDxa, after: 40, line: 40 },
                border: { bottom: signatureBorderBottom },
                children: [new TextRun({ text: '', font: 'Times New Roman', size: 4 })],
              }),
              // 2. Fullname below the line
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 10, line: 200 },
                children: [
                  new TextRun({
                    text: notedNameStr,
                    font: 'Times New Roman',
                    size: notedNameStr.length > 26 ? Math.max(14, sigNameBaseSize - 2) : sigNameBaseSize,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              // 3. Role below the fullname
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 10, after: 0, line: 180 },
                children: [
                  new TextRun({
                    text: data.notedTitle,
                    font: 'Times New Roman',
                    size: sigRoleSize,
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
              top: marginTop,
              bottom: marginBottom,
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
          new Paragraph({ spacing: { before: 0, after: isDense || isCompact ? 20 : 40, line: 40 } }),
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
  const fileName = buildAttendanceFilename(data, 'docx');
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
