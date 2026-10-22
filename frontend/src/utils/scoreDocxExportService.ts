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
import { formatSessionDateHeader, buildScoreFilename, type ScoreExportData } from './scoreExportService';
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

export const exportScoresToDocx = async (data: ScoreExportData): Promise<void> => {
  const _isMultiWeek = (data.weeks || []).length > 1;
  const allEntryCols = (data.weeks || []).flatMap((w) =>
    (w.days || []).flatMap((d) =>
      (d.entries && d.entries.length > 0 ? d.entries : [{ entryIndex: 0, label: 'Session #1' }]).map((e) => ({
        dateKey: d.dateKey,
        dayNum: d.dayNum,
        entryIndex: e.entryIndex,
        entryLabel: e.label,
        dayEntryCount: d.entries?.length || 1,
      }))
    )
  );
  const totalDayCols = allEntryCols.length > 0 ? allEntryCols.length : 1;
  const isMonthly = totalDayCols > 5;
  const totalStudents = Math.max(data.students.length, 1);

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
  const rawBudgetPerStudentPt = (pageHeight / 20 - (data.taskTitle ? 260 : 250)) / totalStudents;
  const isDense = rawBudgetPerStudentPt < 13.5;
  const isCompact = rawBudgetPerStudentPt >= 13.5 && rawBudgetPerStudentPt < 17;
  const isMedium = rawBudgetPerStudentPt >= 17 && rawBudgetPerStudentPt < 22;

  // Margins scaled for 1-page fit
  const marginX = isMonthly ? 576 : 720;
  const marginTop = isDense ? 360 : isCompact ? 440 : isMedium ? 560 : isMonthly ? 680 : 760;
  const marginBottom = isDense ? 240 : isCompact ? 300 : isMedium ? 380 : isMonthly ? 460 : 500;
  const availWidth = pageWidth - marginX * 2;

  let depedBytes: Uint8Array | null = null;
  let pnahsBytes: Uint8Array | null = null;
  try {
    depedBytes = base64ToUint8Array(DEPED_LOGO_BASE64);
  } catch (e) {
    console.warn('Could not decode DepEd logo for Score DOCX:', e);
  }
  try {
    pnahsBytes = base64ToUint8Array(PNAHS_LOGO_BASE64);
  } catch (e) {
    console.warn('Could not decode PNAHS logo for Score DOCX:', e);
  }

  // 1. Header Table (3 columns: Left Logo, Center Letterhead, Right Logo)
  const logoColW = isMonthly ? 1100 : 1300;
  const centerTextColW = availWidth - logoColW * 2;
  const logoSizePt = isDense || isCompact ? 38 : 42;

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
                    text: (data.division || 'DIVISION OF MASBATE').toUpperCase(),
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
                    text: (data.district || 'PALANAS NORTH DISTRICT').toUpperCase(),
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
                    text: (data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL').toUpperCase(),
                    font: 'Times New Roman',
                    size: 23,
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
                    text: data.schoolAddress || 'Sta. Cruz, Palanas, Masbate',
                    font: 'Times New Roman',
                    size: 17,
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

  // 2. Title Section
  const afterTitleGap = isDense ? 80 : isCompact ? 120 : isMedium ? 160 : 220;
  const titleParagraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: isDense || isCompact ? 50 : 80, after: 15, line: 210 },
      children: [
        new TextRun({
          text: (data.subjectTitle || 'ARAL PROGRAM SCORE SHEET').toUpperCase(),
          font: 'Times New Roman',
          size: isDense ? 20 : 22, // 10pt vs 11pt
          bold: true,
          color: '0F172A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: data.taskTitle ? 10 : afterTitleGap, line: 210 },
      children: [
        new TextRun({
          text: (data.gradeSection || 'MIXED (GRADES 7-10)').toUpperCase(),
          font: 'Times New Roman',
          size: isDense ? 18 : 19, // 9pt vs 9.5pt
          bold: true,
          color: '334155',
        }),
      ],
    }),
  ];

  if (data.taskTitle) {
    titleParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: afterTitleGap, line: 200 },
        children: [
          new TextRun({
            text: data.taskTitle.toUpperCase(),
            font: 'Times New Roman',
            size: isDense ? 16 : 17, // 8pt vs 8.5pt
            color: '475569',
          }),
        ],
      })
    );
  }

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
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 4. Score Data Table Column Calculations (Proportioned to fit exactly in availWidth)
  let idxW: number;
  let nameW: number;
  let dayW: number;
  let totalW: number;

  if (totalDayCols <= 1) {
    idxW = 600;
    nameW = Math.floor(availWidth * 0.44);
    dayW = Math.floor(availWidth * 0.22);
    totalW = availWidth - idxW - nameW - dayW;
  } else if (totalDayCols <= 5) {
    idxW = 500;
    nameW = Math.floor(availWidth * 0.36);
    totalW = Math.floor(availWidth * 0.18);
    const remForDays = availWidth - idxW - nameW - totalW;
    dayW = Math.floor(remForDays / totalDayCols);
    totalW = availWidth - idxW - nameW - dayW * totalDayCols;
  } else if (totalDayCols <= 10) {
    idxW = 450;
    nameW = Math.floor(availWidth * 0.30);
    totalW = Math.floor(availWidth * 0.14);
    const remForDays = availWidth - idxW - nameW - totalW;
    dayW = Math.floor(remForDays / totalDayCols);
    totalW = availWidth - idxW - nameW - dayW * totalDayCols;
  } else {
    // Monthly mode (20-25 days)
    idxW = 400;
    nameW = Math.floor(availWidth * 0.25);
    totalW = Math.floor(availWidth * 0.11);
    const remForDays = availWidth - idxW - nameW - totalW;
    dayW = Math.floor(remForDays / totalDayCols);
    totalW = availWidth - idxW - nameW - dayW * totalDayCols;
  }

  // Calculate available vertical space for student rows on 1 page
  const headerDxa = (isDense ? 1750 : isCompact ? 1900 : 2150) + (data.taskTitle ? 220 : 0);
  const tableHeaderDxa = isDense ? 280 : isCompact ? 320 : 380;
  const sigBlockDxa = isDense ? 1200 : isCompact ? 1450 : isMedium ? 1750 : 2100;
  const availTableDxa = pageHeight - marginTop - marginBottom - headerDxa - tableHeaderDxa - sigBlockDxa;
  const rowBudgetPt = (availTableDxa / 20) / totalStudents;

  const headerFontSize = isMonthly ? (isDense ? 14 : 15) : (isDense ? 15 : 17);
  const dateFontSize = totalDayCols > 10 ? 12 : totalDayCols > 5 ? 14 : isMonthly ? 14 : (isDense ? 14 : 16);
  const studentFontSize =
    rowBudgetPt >= 18 ? (isMonthly ? 17 : 18) :
    rowBudgetPt >= 15.5 ? 17 :
    rowBudgetPt >= 13.5 ? 16 :
    rowBudgetPt >= 12 ? 15 :
    rowBudgetPt >= 10.5 ? 14 : 13;
  const scoreFontSize = studentFontSize;
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

  // Streamlined cell padding so scores and headers never feel cramped
  const headerCellMargins = {
    top: headSpaceY,
    bottom: headSpaceY,
    left: isMonthly ? 25 : 50,
    right: isMonthly ? 25 : 50,
  };

  const dayHeaderCellMargins = {
    top: Math.max(20, headSpaceY - 10),
    bottom: Math.max(20, headSpaceY - 10),
    left: isMonthly ? 15 : 30,
    right: isMonthly ? 15 : 30,
  };

  const dayCellMargins = {
    top: cellPadY,
    bottom: cellPadY,
    left: isMonthly ? 10 : 25,
    right: isMonthly ? 10 : 25,
  };

  const studentCellMargins = {
    top: cellPadY,
    bottom: cellPadY,
    left: 40,
    right: 40,
  };

  const tableRows: TableRow[] = [];

  // Single Header Row (Session Dates)
  const headRow1Cells: TableCell[] = [
    new TableCell({
      width: { size: idxW, type: WidthType.DXA },
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
      width: { size: nameW, type: WidthType.DXA },
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

  allEntryCols.forEach((col) => {
    let dateText = formatSessionDateHeader(col.dateKey);
    if (dayW < 450 && col.dateKey) {
      const parts = col.dateKey.split('-');
      if (parts.length === 3) {
        dateText = `${parts[1]}/${parts[2]}`;
      }
    }
    headRow1Cells.push(
      new TableCell({
        width: { size: dayW, type: WidthType.DXA },
        borders: cellBordersAll,
        shading: { fill: 'F8FAFC' },
        margins: dayHeaderCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: Math.max(20, headSpaceY - 10), after: Math.max(20, headSpaceY - 10), line: 220 },
            children: [
              new TextRun({
                text: dateText,
                font: 'Times New Roman',
                size: dateFontSize,
                bold: true,
                color: '0F172A',
              }),
            ],
          }),
        ],
      })
    );
  });

  headRow1Cells.push(
    new TableCell({
      width: { size: totalW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      margins: headerCellMargins,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: headSpaceY, after: headSpaceY, line: 220 },
          children: [new TextRun({ text: 'TOTAL SCORE', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
        }),
      ],
    })
  );

  tableRows.push(new TableRow({ tableHeader: true, cantSplit: true, children: headRow1Cells }));

  // Student rows
  data.students.forEach((student, idx) => {
    const cleanName = student.name.toUpperCase();
    const effectiveNameSize = cleanName.length > 32 ? Math.max(12, studentFontSize - 2) : studentFontSize;

    const rowCells: TableCell[] = [
      new TableCell({
        width: { size: idxW, type: WidthType.DXA },
        borders: cellBordersAll,
        margins: studentCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: rowLineSpacing },
            children: [new TextRun({ text: String(idx + 1), font: 'Times New Roman', size: studentFontSize, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: nameW, type: WidthType.DXA },
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

    allEntryCols.forEach((_, dIdx) => {
      const scoreVal = student.scores?.[dIdx] !== undefined && student.scores?.[dIdx] !== '' ? String(student.scores[dIdx]) : '';
      rowCells.push(
        new TableCell({
          width: { size: dayW, type: WidthType.DXA },
          borders: cellBordersAll,
          margins: dayCellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0, line: rowLineSpacing },
              children: [new TextRun({ text: scoreVal, font: 'Times New Roman', size: scoreFontSize, bold: true, color: '0F172A' })],
            }),
          ],
        })
      );
    });

    const totalVal = student.totalScore !== undefined && student.totalScore !== '' ? String(student.totalScore) : '';
    rowCells.push(
      new TableCell({
        width: { size: totalW, type: WidthType.DXA },
        borders: cellBordersAll,
        margins: studentCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: rowLineSpacing },
            children: [new TextRun({ text: totalVal, font: 'Times New Roman', size: scoreFontSize, bold: true, color: '0F172A' })],
          }),
        ],
      })
    );

    tableRows.push(new TableRow({ cantSplit: true, children: rowCells }));
  });

  const columnWidths = [
    idxW,
    nameW,
    ...allEntryCols.map(() => dayW),
    totalW,
  ];

  const mainTable = new Table({
    alignment: AlignmentType.CENTER,
    width: { size: availWidth, type: WidthType.DXA },
    columnWidths,
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
                    text: data.tutorTitle || 'ARAL Tutor',
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
                    text: data.checkedTitle || 'HT/Asst. to the Principal',
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
                    text: data.notedTitle || 'Principal I',
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

  // Assemble document
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
              right: marginX,
              bottom: marginBottom,
              left: marginX,
            },
          },
        },
        children: [
          headerTable,
          ...titleParagraphs,
          metaTable,
          new Paragraph({ spacing: { before: 0, after: isDense || isCompact ? 20 : 40, line: 40 } }),
          mainTable,
          sigBlockTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = buildScoreFilename(data, 'docx');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
