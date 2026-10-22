import ExcelJS from 'exceljs';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';

export interface ScoreExportDay {
  dateKey: string;
  dayNum: number | string;
  dayName?: string;
  entries?: Array<{
    entryIndex: number;
    label: string; // '1', '2', etc.
  }>;
}

export interface ScoreExportWeek {
  label: string; // e.g. "November 3-7, 2025" or "03/08/2026"
  days: ScoreExportDay[];
}

export interface ScoreExportStudent {
  id: string;
  name: string;
  scores: (number | string)[];
  scoresByDate?: Record<string, number | string>;
  totalScore?: number | string;
}

export interface ScoreExportData {
  division: string;
  district: string;
  schoolName: string;
  schoolAddress: string;
  subjectTitle: string;
  gradeSection: string;
  taskTitle?: string;
  weekNumber?: string;
  dateStr: string;
  paperSize?: 'a4' | 'folio' | 'letter';
  /** Assessment type prefix: 'MOSY' | 'EOSY' | 'ARAL Summer Assessment'. Omit for plain 'SCORE_SHEET'. */
  assessmentType?: string;
  tutorName: string;
  tutorTitle: string;
  checkedName: string;
  checkedTitle: string;
  notedName: string;
  notedTitle: string;
  weeks: ScoreExportWeek[];
  students: ScoreExportStudent[];
}

const getExcelColumnLetter = (colNum: number): string => {
  let letter = '';
  while (colNum > 0) {
    const mod = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return letter;
};

export const formatSessionDateHeader = (dateKey?: string): string => {
  if (!dateKey) return '';
  const parts = dateKey.split('-');
  if (parts.length === 3) {
    const [y, m, day] = parts;
    return `${m.padStart(2, '0')}/${day.padStart(2, '0')}/${y}`;
  }
  return dateKey;
};

/**
 * Builds the standardised score-sheet export filename.
 * Format: {ASSESSMENT_TYPE_}SCORE_SHEET_{GRADE_SECTION}_{DATE_OR_RANGE}_{PAPERSIZE}.{ext}
 * e.g.  MOSY_SCORE_SHEET_GRADE-8-MANGO_09_15_2026-09_19_2026_LONG.xlsx
 *       ARAL_SUMMER_ASSESS_SCORE_SHEET_GRADE-8-MANGO_09_15_2026-09_19_2026_LONG.xlsx
 *       SCORE_SHEET_GRADE-8-MANGO_09_15_2026_A4.pdf   (no assessment type)
 */
export const buildScoreFilename = (
  data: Pick<ScoreExportData, 'gradeSection' | 'dateStr' | 'paperSize' | 'assessmentType'>,
  ext: 'xlsx' | 'docx' | 'pdf'
): string => {
  // Optional assessment-type prefix (MOSY / EOSY / ARAL_SUMMER_ASSESS)
  let prefix = '';
  if (
    data.assessmentType &&
    data.assessmentType.trim() !== '' &&
    !data.assessmentType.toLowerCase().includes('intervention') &&
    data.assessmentType.toLowerCase() !== 'none'
  ) {
    const rawType = data.assessmentType.toUpperCase().trim();
    if (rawType.includes('SUMMER') || rawType.includes('BOSY') || rawType === 'ARAL_SUMMER_ASSESS') {
      prefix = 'ARAL_SUMMER_ASSESS_';
    } else if (rawType.includes('MOSY')) {
      prefix = 'MOSY_';
    } else if (rawType.includes('EOSY')) {
      prefix = 'EOSY_';
    } else {
      prefix = `${rawType.replace(/[^A-Z0-9]/g, '_')}_`;
    }
  }

  // Normalise grade-section: uppercase, collapse whitespace and hyphens
  const section = (data.gradeSection || 'CLASS')
    .toUpperCase()
    .trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '');

  // Normalise date/date-range:
  //   "09/15/2026"                   → "09_15_2026"
  //   "09/15/2026 - 09/19/2026"      → "09_15_2026-09_19_2026"
  const date = (data.dateStr || 'DATE')
    .trim()
    .replace(/\s*-\s*/g, '-') // collapse " - " to "-"
    .replace(/\//g, '_');     // replace "/" with "_"

  const paperLabel =
    data.paperSize === 'folio' ? 'LONG' :
    data.paperSize === 'letter' ? 'SHORT' : 'A4';

  return `${prefix}SCORE_SHEET_${section}_${date}_${paperLabel}.${ext}`;
};

export const exportScoresToExcel = async (data: ScoreExportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Student Score Sheet');

  // Page setup with calibrated margins and strict 1-page fit
  const totalStudents = Math.max(data.students.length, 1);
  const paperCode: any = data.paperSize === 'letter' ? 1 : data.paperSize === 'folio' ? 14 : 9;
  const pageHeightPt = data.paperSize === 'folio' ? 936 : data.paperSize === 'a4' ? 842 : 792;
  const rawRowBudget = (pageHeightPt - (data.taskTitle ? 275 : 260)) / totalStudents;
  const isDense = rawRowBudget < 13.5;
  const isCompact = rawRowBudget >= 13.5 && rawRowBudget < 17;

  worksheet.pageSetup = {
    orientation: 'portrait',
    paperSize: paperCode,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: {
      left: 0.4,
      right: 0.4,
      top: isDense ? 0.3 : isCompact ? 0.35 : 0.45,
      bottom: isDense ? 0.25 : isCompact ? 0.3 : 0.35,
      header: 0.15,
      footer: 0.15,
    },
  };

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
  const totalCols = 2 + totalDayCols + 1; // # + Name + Entry Columns + Total Score
  const lastColLetter = getExcelColumnLetter(totalCols);

  // Column widths definition - proportioned for formal academic printing
  const columnsDef: Array<{ key: string; width: number }> = [
    { key: 'colA', width: totalDayCols <= 1 ? 5.5 : 5 }, // #
    { key: 'colB', width: totalDayCols <= 1 ? 36 : totalDayCols <= 5 ? 30 : 26 }, // NAME OF THE STUDENTS
  ];

  allEntryCols.forEach((_, idx) => {
    columnsDef.push({
      key: `day_entry_${idx}`,
      width: totalDayCols <= 1 ? 16 : totalDayCols <= 5 ? 13 : 11.5,
    });
  });

  columnsDef.push({
    key: 'colTotal',
    width: totalDayCols <= 1 ? 18 : totalDayCols <= 5 ? 15 : 12,
  });
  worksheet.columns = columnsDef;

  // Helper styling matching the on-screen preview & DepEd standard (Times New Roman)
  const fontMain = 'Times New Roman';
  const colorSlate900 = { argb: 'FF0F172A' };
  const colorSlate700 = { argb: 'FF334155' };
  const colorSlate600 = { argb: 'FF475569' };
  const colorSlate500 = { argb: 'FF64748B' };
  const colorHeaderBg = { argb: 'FFF8FAFC' }; // bg-slate-50
  const colorBorderSlate800 = { argb: 'FF1E293B' }; // border-slate-800

  const fontHeaderSub = { name: fontMain, size: 9.5, color: colorSlate600 };
  const fontSchoolName = { name: fontMain, size: 11.5, bold: true, color: colorSlate900 };
  const fontAddress = { name: fontMain, size: 9, color: colorSlate500 };
  const fontSubjectTitle = { name: fontMain, size: 11.5, bold: true, color: colorSlate900 };
  const fontGradeSection = { name: fontMain, size: 10, bold: true, color: colorSlate700 };
  const fontTaskTitle = { name: fontMain, size: 9.5, color: colorSlate600 };

  const tableBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: colorBorderSlate800 },
    left: { style: 'thin', color: colorBorderSlate800 },
    bottom: { style: 'thin', color: colorBorderSlate800 },
    right: { style: 'thin', color: colorBorderSlate800 },
  };

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: colorHeaderBg,
  };

  // Row 1: Formal Top Margin Spacing
  const row1 = worksheet.getRow(1);
  row1.height = isDense ? 14 : 24;

  // Header rows heights matching official DepEd letterhead standard
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 22;
  worksheet.getRow(5).height = 18;

  // 2. Division
  worksheet.mergeCells(`A2:${lastColLetter}2`);
  const r2 = worksheet.getCell('A2');
  r2.value = data.division.toUpperCase();
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  r2.font = fontHeaderSub;

  // 3. District
  worksheet.mergeCells(`A3:${lastColLetter}3`);
  const r3 = worksheet.getCell('A3');
  r3.value = data.district.toUpperCase();
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  r3.font = fontHeaderSub;

  // 4. School Name
  worksheet.mergeCells(`A4:${lastColLetter}4`);
  const r4 = worksheet.getCell('A4');
  r4.value = data.schoolName.toUpperCase();
  r4.alignment = { horizontal: 'center', vertical: 'middle' };
  r4.font = fontSchoolName;

  // 5. Address
  worksheet.mergeCells(`A5:${lastColLetter}5`);
  const r5 = worksheet.getCell('A5');
  r5.value = data.schoolAddress;
  r5.alignment = { horizontal: 'center', vertical: 'middle' };
  r5.font = fontAddress;

  // Embed Official DepEd (Left) and PNAHS (Right) Logos in the Header
  try {
    const depedImageId = workbook.addImage({
      base64: DEPED_LOGO_BASE64,
      extension: 'png',
    });
    const pnahsImageId = workbook.addImage({
      base64: PNAHS_LOGO_BASE64,
      extension: 'png',
    });

    const colWidthsPx = columnsDef.map((col) => Math.floor((col.width || 10) * 7.5 + 5));
    const totalTableWidthPx = colWidthsPx.reduce((sum, w) => sum + w, 0);
    const tableCenterPx = totalTableWidthPx / 2;

    const schoolNameLen = (data.schoolName || '').trim().length;
    const divisionLen = (data.division || '').trim().length;
    const districtLen = (data.district || '').trim().length;
    const addressLen = (data.schoolAddress || '').trim().length;

    const headerTextWidthPx = Math.max(
      schoolNameLen * 9.6,
      divisionLen * 8.0,
      districtLen * 8.0,
      addressLen * 7.0,
      330
    );
    const halfTextWidthPx = headerTextWidthPx / 2;

    const logoPx = 56;
    const sideMarginPx = 16;
    const availableSideSpacePx = tableCenterPx - halfTextWidthPx;
    const maxSafeGapPx = Math.max(16, availableSideSpacePx - logoPx - sideMarginPx);
    const equalGapPx = Math.min(48, maxSafeGapPx);

    const leftLogoXPx = Math.max(sideMarginPx, tableCenterPx - halfTextWidthPx - equalGapPx - logoPx);
    const rightLogoXPx = Math.min(totalTableWidthPx - logoPx - sideMarginPx, tableCenterPx + halfTextWidthPx + equalGapPx);

    const pixelXToNativeCol = (targetXPx: number): { nativeCol: number; nativeColOff: number } => {
      let accumulated = 0;
      for (let i = 0; i < colWidthsPx.length; i++) {
        const w = colWidthsPx[i];
        if (accumulated + w >= targetXPx || i === colWidthsPx.length - 1) {
          const offsetInColPx = Math.max(0, targetXPx - accumulated);
          return {
            nativeCol: i,
            nativeColOff: Math.floor(offsetInColPx * 9525),
          };
        }
        accumulated += w;
      }
      return { nativeCol: 0, nativeColOff: 0 };
    };

    const leftAnchor = pixelXToNativeCol(leftLogoXPx);
    const rightAnchor = pixelXToNativeCol(rightLogoXPx);
    const logoRowAnchor = { nativeRow: 1, nativeRowOff: 10 * 9525 };

    worksheet.addImage(depedImageId, {
      tl: {
        nativeCol: leftAnchor.nativeCol,
        nativeColOff: leftAnchor.nativeColOff,
        nativeRow: logoRowAnchor.nativeRow,
        nativeRowOff: logoRowAnchor.nativeRowOff,
      } as any,
      ext: { width: logoPx, height: logoPx },
      editAs: 'oneCell',
    });

    worksheet.addImage(pnahsImageId, {
      tl: {
        nativeCol: rightAnchor.nativeCol,
        nativeColOff: rightAnchor.nativeColOff,
        nativeRow: logoRowAnchor.nativeRow,
        nativeRowOff: logoRowAnchor.nativeRowOff,
      } as any,
      ext: { width: logoPx, height: logoPx },
      editAs: 'oneCell',
    });
  } catch (logoErr) {
    console.warn('Could not embed header logos in score excel sheet:', logoErr);
  }

  // Row 6: Blank spacing
  const row6 = worksheet.getRow(6);
  row6.height = 6;

  // 7. Subject Title
  worksheet.mergeCells(`A7:${lastColLetter}7`);
  const r7 = worksheet.getCell('A7');
  r7.value = data.subjectTitle.toUpperCase();
  r7.alignment = { horizontal: 'center', vertical: 'middle' };
  r7.font = fontSubjectTitle;
  worksheet.getRow(7).height = 20;

  // 8. Grade & Section
  worksheet.mergeCells(`A8:${lastColLetter}8`);
  const r8 = worksheet.getCell('A8');
  r8.value = data.gradeSection.toUpperCase();
  r8.alignment = { horizontal: 'center', vertical: 'middle' };
  r8.font = fontGradeSection;
  worksheet.getRow(8).height = 18;

  // 9. Task Title (if provided)
  if (data.taskTitle) {
    worksheet.mergeCells(`A9:${lastColLetter}9`);
    const r9 = worksheet.getCell('A9');
    r9.value = data.taskTitle.toUpperCase();
    r9.alignment = { horizontal: 'center', vertical: 'middle' };
    r9.font = fontTaskTitle;
    worksheet.getRow(9).height = 18;
  } else {
    worksheet.getRow(9).height = 0.1;
    worksheet.getRow(9).hidden = true;
  }

  // Row 10: Blank spacing below Grade & Section / Task
  const row10 = worksheet.getRow(10);
  row10.height = isDense ? 8 : 14;

  // 11. Week # and Date Row
  const row11 = worksheet.getRow(11);
  row11.height = 20;

  worksheet.mergeCells('A11:B11');
  const r11Left = worksheet.getCell('A11');
  r11Left.value = {
    richText: [
      { text: 'WEEK:  ', font: { name: fontMain, size: 9.5, bold: true, color: colorSlate900 } },
      { text: `\u00A0\u00A0\u00A0\u00A0${data.weekNumber || '1'}\u00A0\u00A0\u00A0\u00A0`, font: { name: fontMain, size: 9.5, bold: true, underline: true, color: colorSlate900 } },
      { text: '\u200B', font: { name: fontMain, size: 9.5 } },
    ],
  };
  r11Left.alignment = { horizontal: 'left', vertical: 'middle' };

  let dateStartCol = totalCols;
  let dateColsWidth = 0;
  for (let c = totalCols; c >= 3; c--) {
    dateColsWidth += columnsDef[c - 1]?.width || 10;
    dateStartCol = c;
    if (dateColsWidth >= 26) break;
  }
  const dateStartLetter = getExcelColumnLetter(dateStartCol);
  worksheet.mergeCells(`${dateStartLetter}11:${lastColLetter}11`);
  const r11Right = worksheet.getCell(`${dateStartLetter}11`);
  r11Right.value = {
    richText: [
      { text: 'DATE:  ', font: { name: fontMain, size: 9.5, bold: true, color: colorSlate900 } },
      { text: `\u00A0\u00A0\u00A0\u00A0${data.dateStr || '_______'}\u00A0\u00A0\u00A0\u00A0`, font: { name: fontMain, size: 9.5, bold: true, underline: true, color: colorSlate900 } },
      { text: '\u200B', font: { name: fontMain, size: 9.5 } },
    ],
  };
  r11Right.alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 12: Spacing
  const row12 = worksheet.getRow(12);
  row12.height = 6;

  // Row 13: Single Header Row with Dates
  const row13 = worksheet.getRow(13);
  row13.height = isDense ? 17 : 20;

  const cellA13 = worksheet.getCell('A13');
  cellA13.value = '#';
  cellA13.alignment = { horizontal: 'center', vertical: 'middle' };
  cellA13.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
  cellA13.border = tableBorder;
  cellA13.fill = headerFill;

  const cellB13 = worksheet.getCell('B13');
  cellB13.value = 'NAME OF THE STUDENTS';
  cellB13.alignment = { horizontal: 'center', vertical: 'middle' };
  cellB13.font = { name: fontMain, size: 10, bold: true, color: colorSlate900 };
  cellB13.border = tableBorder;
  cellB13.fill = headerFill;

  allEntryCols.forEach((col, idx) => {
    const cLetter = getExcelColumnLetter(3 + idx);
    const cell = worksheet.getCell(`${cLetter}13`);
    cell.value = formatSessionDateHeader(col.dateKey);
    cell.font = { name: fontMain, size: allEntryCols.length > 8 ? 8.5 : 9, bold: true, color: colorSlate900 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true, wrapText: false };
    cell.border = tableBorder;
    cell.fill = headerFill;
  });

  const totalCell13 = worksheet.getCell(`${lastColLetter}13`);
  totalCell13.value = 'TOTAL SCORE';
  totalCell13.alignment = { horizontal: 'center', vertical: 'middle' };
  totalCell13.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
  totalCell13.border = tableBorder;
  totalCell13.fill = headerFill;

  let currentRow = 14;

  // Data rows (dynamically scaled row height & font size based on student count and paper size)
  const studentRowHeight = Math.min(18.5, Math.max(11.5, Math.round(rawRowBudget * 10) / 10));
  const studentFontSize =
    studentRowHeight >= 17 ? 9.5 :
    studentRowHeight >= 15 ? 9 :
    studentRowHeight >= 13.5 ? 8.5 :
    studentRowHeight >= 12 ? 8 : 7.5;

  data.students.forEach((student, index) => {
    const sRow = worksheet.getRow(currentRow);
    const rowValues: any[] = [index + 1, student.name.toUpperCase()];

    allEntryCols.forEach((_, dIdx) => {
      const val = student.scores[dIdx];
      rowValues.push(val !== undefined && val !== '' ? val : '');
    });

    rowValues.push(student.totalScore !== undefined && student.totalScore !== '' ? student.totalScore : '');

    sRow.values = rowValues;
    sRow.height = studentRowHeight;

    sRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = {
        name: fontMain,
        size: studentFontSize,
        bold: colNumber === 2 || colNumber === totalCols,
        color: colorSlate900,
      };
      cell.border = tableBorder;
      if (colNumber === 1 || colNumber >= 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true, wrapText: false };
      }
    });

    currentRow++;
  });

  // Footer Signatures (Order: 1. Line for signature, 2. Fullname below line, 3. Role below fullname)
  worksheet.getRow(currentRow).height = isDense ? 8 : isCompact ? 12 : 16;
  currentRow++;

  // Calculate right signature column bounds (target width >= 34 units for generous readable clearance)
  let rightSigWidth = 0;
  let rightSigStartCol = totalCols;
  for (let c = totalCols; c >= 3; c--) {
    const colW = columnsDef[c - 1]?.width || 10;
    rightSigWidth += colW;
    rightSigStartCol = c;
    if (rightSigWidth >= 34) {
      break;
    }
  }
  const rightSigStartLetter = getExcelColumnLetter(rightSigStartCol);
  const sigNameFontSize = isDense ? 9.5 : 10;

  // Prepared by (Tutor) - merged across rightSigStartLetter to lastColLetter
  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const preparedByLabel = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  preparedByLabel.value = 'Prepared by:';
  preparedByLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  preparedByLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(currentRow).height = isDense ? 14 : 16;

  // 1. Blank rows for physical pen signing clearance + Signature Line at the bottom of signing space
  worksheet.getRow(currentRow + 1).height = isDense ? 10 : isCompact ? 12 : 14;
  worksheet.getRow(currentRow + 2).height = isDense ? 12 : isCompact ? 14 : 16;
  for (let c = rightSigStartCol; c <= totalCols; c++) {
    worksheet.getCell(`${getExcelColumnLetter(c)}${currentRow + 2}`).border = {
      bottom: { style: 'medium', color: colorSlate900 },
    };
  }
  currentRow += 3;

  // 2. Tutor Fullname below the signature line
  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const tutorCell = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  tutorCell.value = data.tutorName.toUpperCase();
  tutorCell.font = { name: fontMain, size: sigNameFontSize, bold: true, color: colorSlate900 };
  tutorCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true, wrapText: false };
  worksheet.getRow(currentRow).height = isDense ? 16 : 19;

  // 3. Tutor Role below the fullname
  currentRow++;
  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const tutorTitleCell = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  tutorTitleCell.value = data.tutorTitle || 'ARAL Tutor';
  tutorTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  tutorTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 15;

  // Spacing between Tutor block and Checked/Noted block
  currentRow++;
  worksheet.getRow(currentRow).height = isDense ? 10 : isCompact ? 12 : 16;
  currentRow++;

  // Checked (Column A:B merged for ~35 unit width) and Noted (Right columns, width >= 34)
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const checkedLabel = worksheet.getCell(`A${currentRow}`);
  checkedLabel.value = 'Checked:';
  checkedLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  checkedLabel.alignment = { horizontal: 'left', vertical: 'middle' };

  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const notedLabel = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  notedLabel.value = 'Noted:';
  notedLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  notedLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(currentRow).height = isDense ? 14 : 16;

  // 1. Blank rows for physical pen signing clearance + Signature Lines at the bottom of signing space
  worksheet.getRow(currentRow + 1).height = isDense ? 10 : isCompact ? 12 : 14;
  worksheet.getRow(currentRow + 2).height = isDense ? 12 : isCompact ? 14 : 16;
  worksheet.getCell(`A${currentRow + 2}`).border = { bottom: { style: 'medium', color: colorSlate900 } };
  worksheet.getCell(`B${currentRow + 2}`).border = { bottom: { style: 'medium', color: colorSlate900 } };
  for (let c = rightSigStartCol; c <= totalCols; c++) {
    worksheet.getCell(`${getExcelColumnLetter(c)}${currentRow + 2}`).border = {
      bottom: { style: 'medium', color: colorSlate900 },
    };
  }
  currentRow += 3;

  // 2. Checked & Noted Fullnames below the signature lines
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const checkedCell = worksheet.getCell(`A${currentRow}`);
  checkedCell.value = data.checkedName.toUpperCase();
  checkedCell.font = { name: fontMain, size: sigNameFontSize, bold: true, color: colorSlate900 };
  checkedCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true, wrapText: false };

  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const notedCell = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  notedCell.value = data.notedName.toUpperCase();
  notedCell.font = { name: fontMain, size: sigNameFontSize, bold: true, color: colorSlate900 };
  notedCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true, wrapText: false };
  worksheet.getRow(currentRow).height = isDense ? 16 : 19;

  // 3. Checked & Noted Roles below the fullnames
  currentRow++;
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const checkedTitleCell = worksheet.getCell(`A${currentRow}`);
  checkedTitleCell.value = data.checkedTitle;
  checkedTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  checkedTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const notedTitleCell = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  notedTitleCell.value = data.notedTitle;
  notedTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  notedTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 15;

  // Bottom margin spacing row
  currentRow++;
  worksheet.getRow(currentRow).height = isDense ? 8 : 16;

  // Generate buffer & trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = buildScoreFilename(data, 'xlsx');
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
