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

  // Margins: comfortable top margin (0.5 - 0.55 in) above header, balanced side margins
  const marginX = isMonthly ? 576 : 720;
  const marginY = isMonthly ? 720 : 800;
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
  const logoSizePt = 42;

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
                spacing: { before: 0, after: 20, line: 240 },
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
                spacing: { before: 0, after: 20, line: 240 },
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
                spacing: { before: 0, after: 20, line: 240 },
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
                spacing: { before: 0, after: 0, line: 240 },
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
  const titleParagraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 15, line: 220 },
      children: [
        new TextRun({
          text: (data.subjectTitle || 'ARAL PROGRAM SCORE SHEET').toUpperCase(),
          font: 'Times New Roman',
          size: 22, // 11pt
          bold: true,
          color: '0F172A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: data.taskTitle ? 15 : 240, line: 220 },
      children: [
        new TextRun({
          text: (data.gradeSection || 'GRADE 8-MANGO').toUpperCase(),
          font: 'Times New Roman',
          size: 19, // 9.5pt
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
        spacing: { before: 0, after: 240, line: 220 },
        children: [
          new TextRun({
            text: data.taskTitle.toUpperCase(),
            font: 'Times New Roman',
            size: 17, // 8.5pt
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

  const totalStudents = Math.max(data.students.length, 1);
  const headerFontSize = isMonthly ? 15 : 17; // 7.5pt vs 8.5pt
  const dateFontSize = totalDayCols > 10 ? 12 : totalDayCols > 5 ? 14 : isMonthly ? 14 : 16;
  const sessionLabelFontSize = totalDayCols > 10 ? 12 : totalDayCols > 5 ? 14 : isMonthly ? 14 : 16;
  const studentFontSize = totalStudents > 22 ? 16 : isMonthly ? 16 : 18; // 8pt vs 9pt
  const scoreFontSize = totalStudents > 22 ? 16 : isMonthly ? 16 : 18;   // 8pt vs 9pt

  // Streamlined cell padding so scores and headers never feel cramped
  const headerCellMargins = {
    top: 50,
    bottom: 50,
    left: isMonthly ? 25 : 50,
    right: isMonthly ? 25 : 50,
  };

  const dayHeaderCellMargins = {
    top: 40,
    bottom: 40,
    left: isMonthly ? 15 : 30,
    right: isMonthly ? 15 : 30,
  };

  const dayCellMargins = {
    top: totalStudents > 22 ? 20 : 35,
    bottom: totalStudents > 22 ? 20 : 35,
    left: isMonthly ? 10 : 25,
    right: isMonthly ? 10 : 25,
  };

  const studentCellMargins = {
    top: totalStudents > 22 ? 20 : 35,
    bottom: totalStudents > 22 ? 20 : 35,
    left: 40,
    right: 40,
  };

  const tableRows: TableRow[] = [];

  // 2 Header Rows (Row 1: Session Dates, Row 2: Session Labels)
  const headRow1Cells: TableCell[] = [
    new TableCell({
      rowSpan: 2,
      width: { size: idxW, type: WidthType.DXA },
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
      rowSpan: 2,
      width: { size: nameW, type: WidthType.DXA },
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
            spacing: { before: 40, after: 40, line: 240 },
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
      rowSpan: 2,
      width: { size: totalW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      margins: headerCellMargins,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 50, after: 50, line: 240 },
          children: [new TextRun({ text: 'TOTAL SCORE', font: 'Times New Roman', size: headerFontSize, bold: true, color: '0F172A' })],
        }),
      ],
    })
  );

  tableRows.push(new TableRow({ tableHeader: true, cantSplit: true, children: headRow1Cells }));

  // Row 2: Session labels under each date
  const headRow2Cells: TableCell[] = [];
  allEntryCols.forEach((col, idx) => {
    let labelText = col.entryLabel;
    if (dayW < 400) {
      labelText = `S${idx + 1}`;
    } else if (dayW < 550) {
      labelText = `S#${idx + 1}`;
    }
    headRow2Cells.push(
      new TableCell({
        width: { size: dayW, type: WidthType.DXA },
        borders: cellBordersAll,
        shading: { fill: 'FFFFFF' },
        margins: dayHeaderCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30, line: 240 },
            children: [new TextRun({ text: labelText, font: 'Times New Roman', size: sessionLabelFontSize, bold: true, color: '0F172A' })],
          }),
        ],
      })
    );
  });
  tableRows.push(new TableRow({ tableHeader: true, cantSplit: true, children: headRow2Cells }));

  // Student rows
  data.students.forEach((student, idx) => {
    const rowCells: TableCell[] = [
      new TableCell({
        width: { size: idxW, type: WidthType.DXA },
        borders: cellBordersAll,
        margins: studentCellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 220 },
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
            spacing: { before: 0, after: 0, line: 220 },
            children: [new TextRun({ text: student.name.toUpperCase(), font: 'Times New Roman', size: studentFontSize, bold: true, color: '0F172A' })],
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
              spacing: { before: 0, after: 0, line: 220 },
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
            spacing: { before: 0, after: 0, line: 220 },
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

  // 5. Signature Section - Proportioned cleanly matching Excel and PDF exports
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
      // Top spacing (comfortable gap between bottom of student table and signature block)
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            borders: cellBordersNone,
            children: [new Paragraph({ spacing: { before: totalStudents > 22 ? 300 : 400 } })],
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
                children: [new TextRun({ text: 'Prepared by:', font: 'Times New Roman', size: 17, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: totalStudents > 22 ? 360 : 420 } }), // Generous physical pen signing space
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: (data.tutorName || 'TUTOR FULL NAME').toUpperCase(),
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20 },
                children: [
                  new TextRun({
                    text: data.tutorTitle || 'Learning Camp Volunteer',
                    font: 'Times New Roman',
                    size: 16,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Spacing between Tutor block and Checked/Noted block (comfortable gap above Checked/Noted fields)
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            borders: cellBordersNone,
            children: [new Paragraph({ spacing: { before: totalStudents > 22 ? 220 : 280 } })],
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
                children: [new TextRun({ text: 'Checked:', font: 'Times New Roman', size: 17, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: totalStudents > 22 ? 360 : 420 } }), // Generous physical pen signing space
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: (data.checkedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase(),
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20 },
                children: [
                  new TextRun({
                    text: data.checkedTitle || 'HT/Asst. to the Principal',
                    font: 'Times New Roman',
                    size: 16,
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
                children: [new TextRun({ text: 'Noted:', font: 'Times New Roman', size: 17, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: totalStudents > 22 ? 360 : 420 } }), // Generous physical pen signing space
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: (data.notedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase(),
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20 },
                children: [
                  new TextRun({
                    text: data.notedTitle || 'Principal I',
                    font: 'Times New Roman',
                    size: 16,
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
              top: marginY,
              right: marginX,
              bottom: isMonthly ? 500 : 540,
              left: marginX,
            },
          },
        },
        children: [
          headerTable,
          ...titleParagraphs,
          metaTable,
          new Paragraph({ spacing: { before: 0, after: 40 } }),
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
