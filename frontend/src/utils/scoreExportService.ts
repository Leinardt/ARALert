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

export const exportScoresToExcel = async (data: ScoreExportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Student Score Sheet');

  // Page setup with formal academic margins (1.0 inch / 25.4 mm on all sides)
  const paperCode: any = data.paperSize === 'letter' ? 1 : data.paperSize === 'folio' ? 14 : 9;
  worksheet.pageSetup = {
    orientation: 'portrait',
    paperSize: paperCode,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 1.0,
      right: 1.0,
      top: 1.0,
      bottom: 1.0,
      header: 0.5,
      footer: 0.5,
    },
  };

  const isDaily = data.weeks?.length === 1 && data.weeks[0].days?.length === 1;
  const allEntryCols = (data.weeks || []).flatMap((w) =>
    (w.days || []).flatMap((d) =>
      (d.entries && d.entries.length > 0 ? d.entries : [{ entryIndex: 0, label: '1' }]).map((e) => ({
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
    { key: 'colB', width: totalDayCols <= 1 ? 36 : totalDayCols <= 5 ? 30 : 28 }, // NAME OF THE STUDENTS
  ];

  allEntryCols.forEach((_, idx) => {
    columnsDef.push({
      key: `day_entry_${idx}`,
      width: totalDayCols <= 1 ? 16 : totalDayCols <= 5 ? 7.5 : 4.5,
    });
  });

  columnsDef.push({
    key: 'colTotal',
    width: totalDayCols <= 1 ? 22 : totalDayCols <= 5 ? 18 : 15,
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

  const whiteFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };

  // Row 1: Formal Top Margin Spacing
  const row1 = worksheet.getRow(1);
  row1.height = 24;

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
  }

  // Row 10: Blank spacing below Grade & Section / Task
  const row10 = worksheet.getRow(10);
  row10.height = 14;

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

  // 13 & 14 (or 13, 14, 15). Table Headers
  let currentRow = 15;

  if (isDaily) {
    // Daily mode: 2 header rows (13 & 14)
    worksheet.mergeCells('A13:A14');
    const cellA13 = worksheet.getCell('A13');
    cellA13.value = '#';
    cellA13.alignment = { horizontal: 'center', vertical: 'middle' };
    cellA13.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
    cellA13.border = tableBorder;
    cellA13.fill = headerFill;
    worksheet.getCell('A14').border = tableBorder;
    worksheet.getCell('A14').fill = headerFill;

    worksheet.mergeCells('B13:B14');
    const cellB13 = worksheet.getCell('B13');
    cellB13.value = 'NAME OF THE STUDENTS';
    cellB13.alignment = { horizontal: 'center', vertical: 'middle' };
    cellB13.font = { name: fontMain, size: 10, bold: true, color: colorSlate900 };
    cellB13.border = tableBorder;
    cellB13.fill = headerFill;
    worksheet.getCell('B14').border = tableBorder;
    worksheet.getCell('B14').fill = headerFill;

    // Row 13: Date header merged across all entries of this single day
    const startColLetter = getExcelColumnLetter(3);
    const endColLetter = getExcelColumnLetter(2 + totalDayCols);
    worksheet.mergeCells(`${startColLetter}13:${endColLetter}13`);
    const dCell = worksheet.getCell(`${startColLetter}13`);
    dCell.value = data.weeks[0]?.label || 'DATE';
    dCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dCell.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
    dCell.border = tableBorder;
    dCell.fill = headerFill;
    for (let c = 3; c <= 2 + totalDayCols; c++) {
      worksheet.getCell(`${getExcelColumnLetter(c)}13`).border = tableBorder;
      worksheet.getCell(`${getExcelColumnLetter(c)}13`).fill = headerFill;
    }

    // Row 14: Entry numbers (1, 2, ...) under the date
    const row14 = worksheet.getRow(14);
    row14.height = 20;
    allEntryCols.forEach((col, idx) => {
      const cLetter = getExcelColumnLetter(3 + idx);
      const cell = worksheet.getCell(`${cLetter}14`);
      cell.value = Number(col.entryLabel) || col.entryLabel;
      cell.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = tableBorder;
      cell.fill = whiteFill;
    });

    // TOTAL SCORE (merged 13:14)
    worksheet.mergeCells(`${lastColLetter}13:${lastColLetter}14`);
    const totalCell13 = worksheet.getCell(`${lastColLetter}13`);
    totalCell13.value = 'TOTAL SCORE';
    totalCell13.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell13.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
    totalCell13.border = tableBorder;
    totalCell13.fill = headerFill;
    worksheet.getCell(`${lastColLetter}14`).border = tableBorder;
    worksheet.getCell(`${lastColLetter}14`).fill = headerFill;

    currentRow = 15;
  } else {
    // Multi-week / multi-day: 3 Header Rows (13, 14, 15)
    worksheet.mergeCells('A13:A15');
    const cellA13 = worksheet.getCell('A13');
    cellA13.value = '#';
    cellA13.alignment = { horizontal: 'center', vertical: 'middle' };
    cellA13.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
    cellA13.border = tableBorder;
    cellA13.fill = headerFill;
    worksheet.getCell('A14').border = tableBorder;
    worksheet.getCell('A14').fill = headerFill;
    worksheet.getCell('A15').border = tableBorder;
    worksheet.getCell('A15').fill = headerFill;

    worksheet.mergeCells('B13:B15');
    const cellB13 = worksheet.getCell('B13');
    cellB13.value = 'NAME OF THE STUDENTS';
    cellB13.alignment = { horizontal: 'center', vertical: 'middle' };
    cellB13.font = { name: fontMain, size: 10, bold: true, color: colorSlate900 };
    cellB13.border = tableBorder;
    cellB13.fill = headerFill;
    worksheet.getCell('B14').border = tableBorder;
    worksheet.getCell('B14').fill = headerFill;
    worksheet.getCell('B15').border = tableBorder;
    worksheet.getCell('B15').fill = headerFill;

    // Row 13: Week ranges
    let curCol = 3;
    data.weeks.forEach((week) => {
      const weekColsCount = week.days.reduce((sum, d) => sum + (d.entries?.length || 1), 0);
      const startColLetter = getExcelColumnLetter(curCol);
      const endColLetter = getExcelColumnLetter(curCol + weekColsCount - 1);
      worksheet.mergeCells(`${startColLetter}13:${endColLetter}13`);
      const wCell = worksheet.getCell(`${startColLetter}13`);
      wCell.value = week.label;
      wCell.alignment = { horizontal: 'center', vertical: 'middle' };
      wCell.font = { name: fontMain, size: 9, bold: true, color: colorSlate900 };
      wCell.fill = headerFill;

      for (let c = curCol; c < curCol + weekColsCount; c++) {
        worksheet.getCell(`${getExcelColumnLetter(c)}13`).border = tableBorder;
        worksheet.getCell(`${getExcelColumnLetter(c)}13`).fill = headerFill;
      }
      curCol += weekColsCount;
    });

    // Row 14: Day Numbers (merged over each day's entries)
    const row14 = worksheet.getRow(14);
    row14.height = 18;
    let curDayCol = 3;
    data.weeks.forEach((week) => {
      week.days.forEach((day) => {
        const dayEntriesCount = day.entries?.length || 1;
        const startDayLetter = getExcelColumnLetter(curDayCol);
        const endDayLetter = getExcelColumnLetter(curDayCol + dayEntriesCount - 1);
        if (dayEntriesCount > 1) {
          worksheet.mergeCells(`${startDayLetter}14:${endDayLetter}14`);
        }
        const cell = worksheet.getCell(`${startDayLetter}14`);
        cell.value = Number(day.dayNum) || day.dayNum;
        cell.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = tableBorder;
        cell.fill = whiteFill;
        for (let c = curDayCol; c < curDayCol + dayEntriesCount; c++) {
          worksheet.getCell(`${getExcelColumnLetter(c)}14`).border = tableBorder;
          worksheet.getCell(`${getExcelColumnLetter(c)}14`).fill = whiteFill;
        }
        curDayCol += dayEntriesCount;
      });
    });

    // Row 15: Entry numbers (1, 2, ...) under each day
    const row15 = worksheet.getRow(15);
    row15.height = 18;
    allEntryCols.forEach((col, idx) => {
      const cLetter = getExcelColumnLetter(3 + idx);
      const cell = worksheet.getCell(`${cLetter}15`);
      cell.value = Number(col.entryLabel) || col.entryLabel;
      cell.font = { name: fontMain, size: 8.5, bold: true, color: colorSlate900 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = tableBorder;
      cell.fill = whiteFill;
    });

    // TOTAL SCORE (merged 13:15)
    worksheet.mergeCells(`${lastColLetter}13:${lastColLetter}15`);
    const totalCell13 = worksheet.getCell(`${lastColLetter}13`);
    totalCell13.value = 'TOTAL SCORE';
    totalCell13.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell13.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
    totalCell13.border = tableBorder;
    totalCell13.fill = headerFill;
    worksheet.getCell(`${lastColLetter}14`).border = tableBorder;
    worksheet.getCell(`${lastColLetter}14`).fill = headerFill;
    worksheet.getCell(`${lastColLetter}15`).border = tableBorder;
    worksheet.getCell(`${lastColLetter}15`).fill = headerFill;

    currentRow = 16;
  }

  // Data rows
  data.students.forEach((student, index) => {
    const sRow = worksheet.getRow(currentRow);
    const rowValues: any[] = [index + 1, student.name.toUpperCase()];

    allEntryCols.forEach((_, dIdx) => {
      const val = student.scores[dIdx];
      rowValues.push(val !== undefined && val !== '' ? val : '');
    });

    rowValues.push(student.totalScore !== undefined && student.totalScore !== '' ? student.totalScore : '');

    sRow.values = rowValues;
    sRow.height = 20;

    sRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = {
        name: fontMain,
        size: 9.5,
        bold: colNumber === 2 || colNumber === totalCols,
        color: colorSlate900,
      };
      cell.border = tableBorder;
      if (colNumber === 1 || colNumber >= 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    currentRow++;
  });

  // Footer Signatures
  currentRow += 2; // Spacing below table

  // Right Signatory Columns (Prepared by & Noted)
  const rightStartCol = Math.max(3, totalCols - 2);
  const rightStartLetter = getExcelColumnLetter(rightStartCol);

  // Prepared by (Tutor)
  const preparedByLabel = worksheet.getCell(`${rightStartLetter}${currentRow}`);
  preparedByLabel.value = 'Prepared by:';
  preparedByLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  preparedByLabel.alignment = { horizontal: 'left', vertical: 'middle' };

  // 3 blank rows for physical pen signing clearance
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  worksheet.getRow(currentRow + 3).height = 16;
  currentRow += 4;

  worksheet.mergeCells(`${rightStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const tutorCell = worksheet.getCell(`${rightStartLetter}${currentRow}`);
  tutorCell.value = data.tutorName.toUpperCase();
  tutorCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  tutorCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 20;

  for (let c = rightStartCol; c <= totalCols; c++) {
    worksheet.getCell(`${getExcelColumnLetter(c)}${currentRow}`).border = {
      bottom: { style: 'medium', color: colorSlate900 },
    };
  }

  currentRow++;
  worksheet.mergeCells(`${rightStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const tutorTitleCell = worksheet.getCell(`${rightStartLetter}${currentRow}`);
  tutorTitleCell.value = data.tutorTitle;
  tutorTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  tutorTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 16;

  // Spacing between Tutor block and Checked/Noted block
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  currentRow += 3;

  // Checked (Column B) and Noted (right columns)
  const checkedLabel = worksheet.getCell(`B${currentRow}`);
  checkedLabel.value = 'Checked:';
  checkedLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  checkedLabel.alignment = { horizontal: 'left', vertical: 'middle' };

  const notedLabel = worksheet.getCell(`${rightStartLetter}${currentRow}`);
  notedLabel.value = 'Noted:';
  notedLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  notedLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 18;

  // 3 blank rows for physical pen signing clearance
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  worksheet.getRow(currentRow + 3).height = 16;
  currentRow += 4;

  // Checked Name (Column B)
  const checkedCell = worksheet.getCell(`B${currentRow}`);
  checkedCell.value = data.checkedName.toUpperCase();
  checkedCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  checkedCell.border = { bottom: { style: 'medium', color: colorSlate900 } };
  checkedCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Noted Name (right columns)
  worksheet.mergeCells(`${rightStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const notedCell = worksheet.getCell(`${rightStartLetter}${currentRow}`);
  notedCell.value = data.notedName.toUpperCase();
  notedCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  notedCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 20;

  for (let c = rightStartCol; c <= totalCols; c++) {
    worksheet.getCell(`${getExcelColumnLetter(c)}${currentRow}`).border = {
      bottom: { style: 'medium', color: colorSlate900 },
    };
  }

  currentRow++;
  // Checked Title
  const checkedTitleCell = worksheet.getCell(`B${currentRow}`);
  checkedTitleCell.value = data.checkedTitle;
  checkedTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  checkedTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Noted Title
  worksheet.mergeCells(`${rightStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const notedTitleCell = worksheet.getCell(`${rightStartLetter}${currentRow}`);
  notedTitleCell.value = data.notedTitle;
  notedTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  notedTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 16;

  // Bottom margin spacing row
  currentRow++;
  worksheet.getRow(currentRow).height = 24;

  // Generate buffer & trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${data.subjectTitle.replace(/\s+/g, '_')}_Score_Sheet_${data.gradeSection.replace(/\s+/g, '_')}.xlsx`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
