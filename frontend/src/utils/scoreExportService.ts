import ExcelJS from 'exceljs';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';

export interface ScoreExportData {
  division: string;
  district: string;
  schoolName: string;
  schoolAddress: string;
  subjectTitle: string;
  gradeSection: string;
  taskTitle: string;
  weekNumber: string;
  dateStr: string;
  tutorName: string;
  tutorTitle: string;
  checkedName: string;
  checkedTitle: string;
  notedName: string;
  notedTitle: string;
  students: Array<{
    id: string;
    name: string;
    scores: (number | string)[];
    totalScore?: number | string;
  }>;
}

export const exportScoresToExcel = async (data: ScoreExportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Weekly Task Scores');

  // Page setup with formal academic margins (1.0 inch / 25.4 mm on all sides)
  worksheet.pageSetup = {
    orientation: 'portrait',
    paperSize: 9, // A4
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

  // Set column widths proportioned for formal academic printing
  worksheet.columns = [
    { key: 'colA', width: 5.5 },  // Row #
    { key: 'colB', width: 30 },   // Student Name
    { key: 'colC', width: 8.5 },  // Score 1
    { key: 'colD', width: 8.5 },  // Score 2
    { key: 'colE', width: 8.5 },  // Score 3
    { key: 'colF', width: 8.5 },  // Score 4
    { key: 'colG', width: 14 },   // Total Score
  ];

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
    right: { style: 'thin', color: colorBorderSlate800 }
  };

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: colorHeaderBg,
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
  worksheet.mergeCells('A2:G2');
  const r2 = worksheet.getCell('A2');
  r2.value = data.division.toUpperCase();
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  r2.font = fontHeaderSub;

  // 3. District
  worksheet.mergeCells('A3:G3');
  const r3 = worksheet.getCell('A3');
  r3.value = data.district.toUpperCase();
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  r3.font = fontHeaderSub;

  // 4. School Name
  worksheet.mergeCells('A4:G4');
  const r4 = worksheet.getCell('A4');
  r4.value = data.schoolName.toUpperCase();
  r4.alignment = { horizontal: 'center', vertical: 'middle' };
  r4.font = fontSchoolName;

  // 5. Address
  worksheet.mergeCells('A5:G5');
  const r5 = worksheet.getCell('A5');
  r5.value = data.schoolAddress;
  r5.alignment = { horizontal: 'center', vertical: 'middle' };
  r5.font = fontAddress;

  // Embed Official DepEd (Left) and PNAHS (Right) Logos in Header
  // RULE: Symmetrical, equidistant placement flanking the centered letterhead text with comfortable spacing
  try {
    const depedImageId = workbook.addImage({
      base64: DEPED_LOGO_BASE64,
      extension: 'png',
    });
    const pnahsImageId = workbook.addImage({
      base64: PNAHS_LOGO_BASE64,
      extension: 'png',
    });

    const columnsDef = [
      { width: 5.5 },
      { width: 30 },
      { width: 8.5 },
      { width: 8.5 },
      { width: 8.5 },
      { width: 8.5 },
      { width: 14 },
    ];

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
    console.warn('Could not embed header logos in score excel sheet:', logoErr);
  }

  // Row 6: Blank
  const row6 = worksheet.getRow(6);
  row6.height = 6;

  // 7. Subject Title
  worksheet.mergeCells('A7:G7');
  const r7 = worksheet.getCell('A7');
  r7.value = data.subjectTitle.toUpperCase();
  r7.alignment = { horizontal: 'center', vertical: 'middle' };
  r7.font = fontSubjectTitle;
  worksheet.getRow(7).height = 20;

  // 8. Grade & Section
  worksheet.mergeCells('A8:G8');
  const r8 = worksheet.getCell('A8');
  r8.value = data.gradeSection.toUpperCase();
  r8.alignment = { horizontal: 'center', vertical: 'middle' };
  r8.font = fontGradeSection;
  worksheet.getRow(8).height = 18;

  // 9. Task Title
  worksheet.mergeCells('A9:G9');
  const r9 = worksheet.getCell('A9');
  r9.value = data.taskTitle.toUpperCase();
  r9.alignment = { horizontal: 'center', vertical: 'middle' };
  r9.font = fontTaskTitle;
  worksheet.getRow(9).height = 18;

  // Row 10: Blank spacing below Grade & Section / Task
  const row10 = worksheet.getRow(10);
  row10.height = 14;

  // 11. Week # and Date
  const row11 = worksheet.getRow(11);
  row11.height = 20;
  worksheet.mergeCells('A11:C11');
  const r11a = worksheet.getCell('A11');
  r11a.value = `WEEK #  ${data.weekNumber || '_________'}`;
  r11a.alignment = { horizontal: 'left', vertical: 'middle' };
  r11a.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };

  worksheet.mergeCells('E11:G11');
  const r11b = worksheet.getCell('E11');
  r11b.value = `Date:  ${data.dateStr || '_________'}`;
  r11b.alignment = { horizontal: 'right', vertical: 'middle' };
  r11b.font = { name: fontMain, size: 9.5, bold: true, color: colorSlate900 };

  // Row 12: Blank
  const row12 = worksheet.getRow(12);
  row12.height = 6;

  // 13. Table Header
  const headerRow = worksheet.getRow(13);
  headerRow.values = ['', 'NAME OF STUDENTS', '1', '2', '3', '4', 'Total Score'];
  headerRow.height = 24;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: fontMain, size: 10, bold: true, color: colorSlate900 };
    cell.border = tableBorder;
    cell.fill = headerFill;
    cell.alignment = {
      horizontal: colNumber === 2 ? 'left' : 'center',
      vertical: 'middle',
      wrapText: true
    };
  });

  // Data rows
  let currentRow = 14;
  data.students.forEach((student, index) => {
    const sRow = worksheet.getRow(currentRow);

    const score1 = student.scores[0] !== undefined ? student.scores[0] : '';
    const score2 = student.scores[1] !== undefined ? student.scores[1] : '';
    const score3 = student.scores[2] !== undefined ? student.scores[2] : '';
    const score4 = student.scores[3] !== undefined ? student.scores[3] : '';

    let calcTotal = student.totalScore;
    if (calcTotal === undefined || calcTotal === '') {
      const nums = [score1, score2, score3, score4].filter(s => typeof s === 'number') as number[];
      calcTotal = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : '';
    }

    sRow.values = [index + 1, student.name.toUpperCase(), score1, score2, score3, score4, calcTotal];
    sRow.height = 20;

    sRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: fontMain, size: 9.5, bold: colNumber === 2 || colNumber === 7, color: colorSlate900 };
      cell.border = tableBorder;
      if (colNumber === 1 || (colNumber >= 3 && colNumber <= 7)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    currentRow++;
  });

  // Footer Signatures
  currentRow += 2; // Spacing below table

  // Prepared by (Tutor) - aligned right matching preview (Columns E to G: width 31)
  const preparedByLabel = worksheet.getCell(`E${currentRow}`);
  preparedByLabel.value = 'Prepared by:';
  preparedByLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  preparedByLabel.alignment = { horizontal: 'left', vertical: 'middle' };

  // 3 blank rows for physical pen signing clearance
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  worksheet.getRow(currentRow + 3).height = 16;
  currentRow += 4;

  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  const tutorCell = worksheet.getCell(`E${currentRow}`);
  tutorCell.value = data.tutorName.toUpperCase();
  tutorCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  tutorCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 20;
  ['E', 'F', 'G'].forEach((col) => {
    worksheet.getCell(`${col}${currentRow}`).border = {
      bottom: { style: 'medium', color: colorSlate900 },
    };
  });

  currentRow++;
  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  const tutorTitleCell = worksheet.getCell(`E${currentRow}`);
  tutorTitleCell.value = data.tutorTitle;
  tutorTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  tutorTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 16;

  // Spacing between Tutor block and Checked/Noted block
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  currentRow += 3;

  // Checked (Column B) and Noted (Columns E:G)
  const checkedLabel = worksheet.getCell(`B${currentRow}`);
  checkedLabel.value = 'Checked:';
  checkedLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  checkedLabel.alignment = { horizontal: 'left', vertical: 'middle' };

  const notedLabel = worksheet.getCell(`E${currentRow}`);
  notedLabel.value = 'Noted:';
  notedLabel.font = { name: fontMain, size: 9.5, italic: true, color: colorSlate900 };
  notedLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 18;

  // 3 blank rows for physical pen signing clearance
  worksheet.getRow(currentRow + 1).height = 14;
  worksheet.getRow(currentRow + 2).height = 16;
  worksheet.getRow(currentRow + 3).height = 16;
  currentRow += 4;

  // Checked Name (in Column B alone for ~30 unit bounded underline)
  const checkedCell = worksheet.getCell(`B${currentRow}`);
  checkedCell.value = data.checkedName.toUpperCase();
  checkedCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  checkedCell.border = { bottom: { style: 'medium', color: colorSlate900 } };
  checkedCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Noted Name (in Columns E:G for ~31 unit bounded underline)
  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  const notedCell = worksheet.getCell(`E${currentRow}`);
  notedCell.value = data.notedName.toUpperCase();
  notedCell.font = { name: fontMain, size: 10.5, bold: true, color: colorSlate900 };
  notedCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(currentRow).height = 20;
  ['E', 'F', 'G'].forEach((col) => {
    worksheet.getCell(`${col}${currentRow}`).border = {
      bottom: { style: 'medium', color: colorSlate900 },
    };
  });

  currentRow++;
  // Checked Title
  const checkedTitleCell = worksheet.getCell(`B${currentRow}`);
  checkedTitleCell.value = data.checkedTitle;
  checkedTitleCell.font = { name: fontMain, size: 9, color: colorSlate600 };
  checkedTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Noted Title
  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  const notedTitleCell = worksheet.getCell(`E${currentRow}`);
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
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${data.subjectTitle.replace(/\s+/g, '_')}_Weekly_Task_${data.gradeSection.replace(/\s+/g, '_')}.xlsx`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
