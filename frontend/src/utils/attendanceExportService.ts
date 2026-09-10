import ExcelJS from 'exceljs';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';

export interface AttendanceExportWeek {
  label: string; // e.g. "November 3-7, 2025" (kept in standard date range format)
  days: Array<{
    dateKey: string;
    dayNum: number | string;
    dayName?: string;
  }>;
}

export interface AttendanceExportStudent {
  id: string;
  name: string;
  lrn?: string | null;
  statusByDate: Record<string, string>; // 'P' | 'L' | 'A' | ''
}

export interface AttendanceExportData {
  division: string;
  district: string;
  schoolName: string;
  schoolAddress: string;
  subjectTitle: string;
  gradeSection: string;
  weekNumber?: string;
  dateStr: string;
  paperSize?: 'a4' | 'folio' | 'letter';
  tutorName: string;
  tutorTitle: string;
  checkedName: string;
  checkedTitle: string;
  notedName: string;
  notedTitle: string;
  weeks: AttendanceExportWeek[];
  students: AttendanceExportStudent[];
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

export const exportAttendanceToExcel = async (data: AttendanceExportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Student Attendance Record');

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

  const allDays = data.weeks.flatMap((w) => w.days);
  const totalDayCols = allDays.length;
  const totalCols = 2 + totalDayCols + 1; // # + Name + Days + Signature
  const lastColLetter = getExcelColumnLetter(totalCols);

  // Column widths definition - proportioned for formal academic printing
  const columnsDef: Array<{ key: string; width: number }> = [
    { key: 'colA', width: totalDayCols <= 1 ? 5.5 : 5 }, // #
    { key: 'colB', width: totalDayCols <= 1 ? 36 : totalDayCols <= 5 ? 30 : 28 }, // NAME OF THE STUDENTS
  ];

  allDays.forEach((_, idx) => {
    columnsDef.push({
      key: `day_${idx}`,
      width: totalDayCols <= 1 ? 16 : totalDayCols <= 5 ? 7.5 : 4.5,
    });
  });

  columnsDef.push({
    key: 'colSig',
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

  // Header rows heights
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
  // RULE: Exact pixel-level equidistant placement using OpenXML EMUs (1px = 9525 EMUs)
  try {
    const depedImageId = workbook.addImage({
      base64: DEPED_LOGO_BASE64,
      extension: 'png',
    });
    const pnahsImageId = workbook.addImage({
      base64: PNAHS_LOGO_BASE64,
      extension: 'png',
    });

    // 1. Calculate each column's rendered pixel width according to OpenXML standards
    const colWidthsPx = columnsDef.map((col) => Math.floor((col.width || 10) * 7.5 + 5));
    const totalTableWidthPx = colWidthsPx.reduce((sum, w) => sum + w, 0);
    const tableCenterPx = totalTableWidthPx / 2;

    // 2. Measure max width of centered text in the 4 letterhead rows in pixels
    // Times New Roman uppercase bold characters in 11.5pt are ~9.6px wide; 9.5pt ~8.0px; 9pt ~7.0px
    const schoolNameLen = (data.schoolName || '').trim().length;
    const divisionLen = (data.division || '').trim().length;
    const districtLen = (data.district || '').trim().length;
    const addressLen = (data.schoolAddress || '').trim().length;

    const headerTextWidthPx = Math.max(
      schoolNameLen * 9.6,
      divisionLen * 8.0,
      districtLen * 8.0,
      addressLen * 7.0,
      330 // Minimum safe width for formal DepEd header text
    );
    const halfTextWidthPx = headerTextWidthPx / 2;

    // 3. Logo dimensions: 56px square
    const logoPx = 56;
    const sideMarginPx = 16;

    // 4. Equal distance rule:
    // Move logos comfortably away from the header text (48px gap) to avoid sitting on or crowding the text.
    // If available side space is constrained, scale proportionally so both sides remain 100% equal.
    const availableSideSpacePx = tableCenterPx - halfTextWidthPx;
    const maxSafeGapPx = Math.max(16, availableSideSpacePx - logoPx - sideMarginPx);
    const equalGapPx = Math.min(48, maxSafeGapPx);

    // Exact pixel X positions flanking the centered text:
    const leftLogoXPx = Math.max(sideMarginPx, tableCenterPx - halfTextWidthPx - equalGapPx - logoPx);
    const rightLogoXPx = Math.min(totalTableWidthPx - logoPx - sideMarginPx, tableCenterPx + halfTextWidthPx + equalGapPx);

    // Helper: Map absolute pixel X coordinate to OpenXML { nativeCol, nativeColOff } in EMUs
    const pixelXToNativeCol = (targetXPx: number): { nativeCol: number; nativeColOff: number } => {
      let accumulated = 0;
      for (let i = 0; i < colWidthsPx.length; i++) {
        const w = colWidthsPx[i];
        if (targetXPx < accumulated + w) {
          const offsetInColPx = targetXPx - accumulated;
          return {
            nativeCol: i,
            nativeColOff: Math.round(offsetInColPx * 9525), // 9525 EMUs per pixel at 96 DPI
          };
        }
        accumulated += w;
      }
      return { nativeCol: colWidthsPx.length - 1, nativeColOff: 0 };
    };

    const leftAnchor = pixelXToNativeCol(leftLogoXPx);
    const rightAnchor = pixelXToNativeCol(rightLogoXPx);

    // Vertical alignment: Rows 2-5 span 76pt (101.3px). Vertically centered:
    // NativeRow 1 (Row 2, 0-indexed) with 215,900 EMUs offset centers the 56px logo across the 4 rows
    const logoRowAnchor = {
      nativeRow: 1,
      nativeRowOff: 215900,
    };

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
    console.warn('Could not embed header logos in attendance excel sheet:', logoErr);
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

  // 8. Grade & Section
  worksheet.mergeCells(`A8:${lastColLetter}8`);
  const r8 = worksheet.getCell('A8');
  r8.value = data.gradeSection.toUpperCase();
  r8.alignment = { horizontal: 'center', vertical: 'middle' };
  r8.font = fontGradeSection;

  // Row 9: Blank spacing below Grade & Section
  const row9 = worksheet.getRow(9);
  row9.height = 14;

  // Row 10: Period Meta Row (WEEK on the left and DATE on the right, both with underlined data)
  const row10 = worksheet.getRow(10);
  row10.height = 20;

  // Merge A10:B10 on the left for Week
  worksheet.mergeCells('A10:B10');
  const r10Left = worksheet.getCell('A10');
  r10Left.value = {
    richText: [
      { text: 'WEEK:  ', font: { name: fontMain, size: 9.5, bold: true, color: colorSlate900 } },
      { text: `\u00A0\u00A0\u00A0\u00A0${data.weekNumber || '1'}\u00A0\u00A0\u00A0\u00A0`, font: { name: fontMain, size: 9.5, bold: true, underline: true, color: colorSlate900 } },
      { text: '\u200B', font: { name: fontMain, size: 9.5 } },
    ],
  };
  r10Left.alignment = { horizontal: 'left', vertical: 'middle' };

  // Calculate merge columns for Date on the right
  let dateStartCol = totalCols;
  let dateColsWidth = 0;
  for (let c = totalCols; c >= 3; c--) {
    dateColsWidth += columnsDef[c - 1]?.width || 10;
    dateStartCol = c;
    if (dateColsWidth >= 26) break;
  }
  const dateStartLetter = getExcelColumnLetter(dateStartCol);
  worksheet.mergeCells(`${dateStartLetter}10:${lastColLetter}10`);
  const r10Right = worksheet.getCell(`${dateStartLetter}10`);
  r10Right.value = {
    richText: [
      { text: 'DATE:  ', font: { name: fontMain, size: 9.5, bold: true, color: colorSlate900 } },
      { text: `\u00A0\u00A0\u00A0\u00A0${data.dateStr || '_______'}\u00A0\u00A0\u00A0\u00A0`, font: { name: fontMain, size: 9.5, bold: true, underline: true, color: colorSlate900 } },
      { text: '\u200B', font: { name: fontMain, size: 9.5 } },
    ],
  };
  r10Right.alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 11: Blank spacing below Week & Date row
  const row11 = worksheet.getRow(11);
  row11.height = 14;

  // 12 & 13. Table Headers
  // # Column (Row 12:13 merged)
  worksheet.mergeCells('A12:A13');
  const cellA12 = worksheet.getCell('A12');
  cellA12.value = '#';
  cellA12.alignment = { horizontal: 'center', vertical: 'middle' };
  cellA12.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
  cellA12.border = tableBorder;
  cellA12.fill = headerFill;
  worksheet.getCell('A13').border = tableBorder;
  worksheet.getCell('A13').fill = headerFill;

  // NAME OF THE STUDENTS (Row 12:13 merged)
  worksheet.mergeCells('B12:B13');
  const cellB12 = worksheet.getCell('B12');
  cellB12.value = 'NAME OF THE STUDENTS';
  cellB12.alignment = { horizontal: 'left', vertical: 'middle' };
  cellB12.font = { name: fontMain, size: 10, bold: true, color: colorSlate900 };
  cellB12.border = tableBorder;
  cellB12.fill = headerFill;
  worksheet.getCell('B13').border = tableBorder;
  worksheet.getCell('B13').fill = headerFill;

  if (totalDayCols === 1) {
    // Daily mode: Single merged cell for date (Row 12:13 merged)
    worksheet.mergeCells('C12:C13');
    const dCell = worksheet.getCell('C12');
    dCell.value = data.weeks[0]?.label || 'DATE';
    dCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dCell.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
    dCell.border = tableBorder;
    dCell.fill = headerFill;
    worksheet.getCell('C13').border = tableBorder;
    worksheet.getCell('C13').fill = headerFill;
  } else {
    // Multi-week / multi-day: Week Date Ranges on Row 12
    let currentDayCol = 3;
    data.weeks.forEach((week) => {
      const startColLetter = getExcelColumnLetter(currentDayCol);
      const endColLetter = getExcelColumnLetter(currentDayCol + week.days.length - 1);
      worksheet.mergeCells(`${startColLetter}12:${endColLetter}12`);
      const wCell = worksheet.getCell(`${startColLetter}12`);
      wCell.value = week.label;
      wCell.alignment = { horizontal: 'center', vertical: 'middle' };
      wCell.font = { name: fontMain, size: 9, bold: true, color: colorSlate900 };
      wCell.fill = headerFill;

      for (let c = currentDayCol; c < currentDayCol + week.days.length; c++) {
        const cLetter = getExcelColumnLetter(c);
        worksheet.getCell(`${cLetter}12`).border = tableBorder;
        worksheet.getCell(`${cLetter}12`).fill = headerFill;
      }
      currentDayCol += week.days.length;
    });

    // Row 13: Normal Upright Day Numbers
    const row13 = worksheet.getRow(13);
    row13.height = 20;

    let dayColIndex = 3;
    allDays.forEach((day) => {
      const colLetter = getExcelColumnLetter(dayColIndex);
      const cell = worksheet.getCell(`${colLetter}13`);
      cell.value = Number(day.dayNum) || day.dayNum;
      cell.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = tableBorder;
      cell.fill = whiteFill;
      dayColIndex++;
    });
  }

  // SIGNATURE (Row 12:13 merged)
  worksheet.mergeCells(`${lastColLetter}12:${lastColLetter}13`);
  const sigCell12 = worksheet.getCell(`${lastColLetter}12`);
  sigCell12.value = 'SIGNATURE';
  sigCell12.alignment = { horizontal: 'center', vertical: 'middle' };
  sigCell12.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
  sigCell12.border = tableBorder;
  sigCell12.fill = headerFill;
  worksheet.getCell(`${lastColLetter}13`).border = tableBorder;
  worksheet.getCell(`${lastColLetter}13`).fill = headerFill;

  worksheet.getRow(12).height = 20;
  worksheet.getRow(13).height = 18;

  // 14. Student Rows
  let currentRow = 14;
  data.students.forEach((student, index) => {
    const sRow = worksheet.getRow(currentRow);
    sRow.height = 19;

    // Index
    const cIdx = worksheet.getCell(`A${currentRow}`);
    cIdx.value = index + 1;
    cIdx.alignment = { horizontal: 'center', vertical: 'middle' };
    cIdx.font = { name: fontMain, size: 9.5, color: colorSlate900 };
    cIdx.border = tableBorder;

    // Student Name (Single line, uppercase, bold matching preview)
    const cName = worksheet.getCell(`B${currentRow}`);
    cName.value = student.name.toUpperCase();
    cName.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
    cName.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };
    cName.border = tableBorder;

    // Day Cells
    allDays.forEach((day, dIdx) => {
      const colLetter = getExcelColumnLetter(3 + dIdx);
      const cDay = worksheet.getCell(`${colLetter}${currentRow}`);
      const rawStatus = student.statusByDate[day.dateKey] || '';

      if (rawStatus === 'P') {
        cDay.value = '/';
        cDay.font = { name: fontMain, size: 10.5, bold: true, color: { argb: 'FF047857' } }; // emerald-700
      } else if (rawStatus === 'L') {
        cDay.value = '/';
        cDay.font = { name: fontMain, size: 10.5, bold: true, color: { argb: 'FFB45309' } }; // amber-700
      } else if (rawStatus === 'A') {
        cDay.value = 'X';
        cDay.font = { name: fontMain, size: 10, bold: true, color: { argb: 'FFBE123C' } }; // rose-700
      } else {
        cDay.value = '';
      }

      cDay.alignment = { horizontal: 'center', vertical: 'middle' };
      cDay.border = tableBorder;
    });

    // Signature Column
    const cSig = worksheet.getCell(`${lastColLetter}${currentRow}`);
    cSig.value = '';
    cSig.border = tableBorder;

    currentRow++;
  });

  // Footer Signatures
  currentRow += 2; // Spacing below table

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

  // Prepared by (Tutor) - aligned right matching preview
  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const preparedByLabel = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  preparedByLabel.value = 'Prepared by:';
  preparedByLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  preparedByLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 18;

  // 3 blank rows for physical pen signing clearance
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  worksheet.getRow(currentRow + 3).height = 16;
  currentRow += 4;

  // Tutor Name (merged across rightSigStartLetter to lastColLetter with shrinkToFit)
  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const tutorCell = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  tutorCell.value = data.tutorName.toUpperCase();
  tutorCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  tutorCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true, wrapText: false };
  worksheet.getRow(currentRow).height = 22;
  for (let c = rightSigStartCol; c <= totalCols; c++) {
    worksheet.getCell(`${getExcelColumnLetter(c)}${currentRow}`).border = {
      bottom: { style: 'medium', color: colorSlate900 },
    };
  }

  // Spacing between Tutor block and Checked/Noted block
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  currentRow += 3;

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
  worksheet.getRow(currentRow).height = 18;

  // 3 blank rows for physical pen signing clearance
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  worksheet.getRow(currentRow + 3).height = 16;
  currentRow += 4;

  // Checked Name (in Columns A:B merged for ~35 unit width)
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const checkedCell = worksheet.getCell(`A${currentRow}`);
  checkedCell.value = data.checkedName.toUpperCase();
  checkedCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  checkedCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true, wrapText: false };
  worksheet.getRow(currentRow).height = 22;
  worksheet.getCell(`A${currentRow}`).border = { bottom: { style: 'medium', color: colorSlate900 } };
  worksheet.getCell(`B${currentRow}`).border = { bottom: { style: 'medium', color: colorSlate900 } };

  // Noted Name (in right columns merged for width >= 34 units)
  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const notedCell = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
  notedCell.value = data.notedName.toUpperCase();
  notedCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  notedCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true, wrapText: false };
  worksheet.getRow(currentRow).height = 22;
  for (let c = rightSigStartCol; c <= totalCols; c++) {
    worksheet.getCell(`${getExcelColumnLetter(c)}${currentRow}`).border = {
      bottom: { style: 'medium', color: colorSlate900 },
    };
  }

  currentRow++;
  // Checked Title (Columns A:B merged)
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const checkedTitleCell = worksheet.getCell(`A${currentRow}`);
  checkedTitleCell.value = data.checkedTitle;
  checkedTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  checkedTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Noted Title (Right columns merged)
  worksheet.mergeCells(`${rightSigStartLetter}${currentRow}:${lastColLetter}${currentRow}`);
  const notedTitleCell = worksheet.getCell(`${rightSigStartLetter}${currentRow}`);
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
  const fileName = `Student_Attendance_Register_${data.gradeSection.replace(/\s+/g, '_')}_${data.dateStr.replace(/[\/\s:]/g, '_')}.xlsx`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
