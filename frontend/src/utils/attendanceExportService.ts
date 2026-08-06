import ExcelJS from 'exceljs';

export interface AttendanceExportData {
  division: string;
  district: string;
  schoolName: string;
  schoolAddress: string;
  subjectTitle: string;
  gradeSection: string;
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
    lrn?: string | null;
    status: string; // 'Present' | 'Late' | 'Absent'
    timeIn?: string | null;
    activityTitle?: string | null;
    presentCount?: number;
    lateCount?: number;
    absentCount?: number;
    attendanceRate?: number;
  }>;
}

export const exportAttendanceToExcel = async (data: AttendanceExportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Student Attendance Record');

  // Page setup for printing
  worksheet.pageSetup = {
    orientation: 'portrait',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
  };

  // Set column widths
  worksheet.columns = [
    { key: 'colA', width: 6 },   // Row #
    { key: 'colB', width: 34 },  // Student Name
    { key: 'colC', width: 16 },  // LRN
    { key: 'colD', width: 14 },  // Status
    { key: 'colE', width: 14 },  // Time In
    { key: 'colF', width: 22 },  // Linked Activity / Remarks
    { key: 'colG', width: 18 },  // Signature
  ];

  // Helper styling
  const fontHeader = { name: 'Calibri', size: 11, bold: false };
  const fontHeaderBold = { name: 'Calibri', size: 12, bold: true };
  const fontTitleBold = { name: 'Calibri', size: 13, bold: true };

  // 1. Division
  worksheet.mergeCells('A1:G1');
  const r1 = worksheet.getCell('A1');
  r1.value = data.division.toUpperCase();
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  r1.font = fontHeader;

  // 2. District
  worksheet.mergeCells('A2:G2');
  const r2 = worksheet.getCell('A2');
  r2.value = data.district.toUpperCase();
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  r2.font = fontHeader;

  // 3. School Name
  worksheet.mergeCells('A3:G3');
  const r3 = worksheet.getCell('A3');
  r3.value = data.schoolName.toUpperCase();
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  r3.font = fontTitleBold;

  // 4. Address
  worksheet.mergeCells('A4:G4');
  const r4 = worksheet.getCell('A4');
  r4.value = data.schoolAddress;
  r4.alignment = { horizontal: 'center', vertical: 'middle' };
  r4.font = fontHeader;

  // Row 5: Blank
  worksheet.addRow([]);

  // 6. Subject Title
  worksheet.mergeCells('A6:G6');
  const r6 = worksheet.getCell('A6');
  r6.value = data.subjectTitle.toUpperCase();
  r6.alignment = { horizontal: 'center', vertical: 'middle' };
  r6.font = fontHeaderBold;

  // 7. Grade & Section
  worksheet.mergeCells('A7:G7');
  const r7 = worksheet.getCell('A7');
  r7.value = data.gradeSection.toUpperCase();
  r7.alignment = { horizontal: 'center', vertical: 'middle' };
  r7.font = fontHeader;

  // Row 8: Blank
  worksheet.addRow([]);

  // 9. Date Header
  worksheet.mergeCells('E9:G9');
  const r9 = worksheet.getCell('E9');
  r9.value = `Date / Period: ${data.dateStr || '_________'}`;
  r9.alignment = { horizontal: 'right', vertical: 'middle' };
  r9.font = { name: 'Calibri', size: 11, bold: true };

  // Row 10: Blank
  worksheet.addRow([]);

  // 11. Table Header
  const headerRow = worksheet.getRow(11);
  headerRow.values = ['#', 'NAME OF STUDENTS', 'LRN', 'STATUS', 'TIME IN', 'ACTIVITY / REMARKS', 'SIGNATURE'];
  headerRow.height = 24;

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.border = thinBorder;
    cell.alignment = {
      horizontal: colNumber === 2 ? 'left' : 'center',
      vertical: 'middle',
      wrapText: true,
    };
  });

  // Data rows
  let currentRow = 12;
  data.students.forEach((student, index) => {
    const sRow = worksheet.getRow(currentRow);
    sRow.values = [
      index + 1,
      student.name,
      student.lrn || 'N/A',
      student.status,
      student.timeIn || '—',
      student.activityTitle || 'General',
      '',
    ];
    sRow.height = 20;

    sRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.border = thinBorder;

      if (colNumber === 4) {
        // Color code status text
        const statusVal = String(cell.value).toUpperCase();
        if (statusVal.includes('PRESENT')) {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF15803D' } }; // Green
        } else if (statusVal.includes('LATE')) {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB45309' } }; // Amber
        } else if (statusVal.includes('ABSENT')) {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB91C1C' } }; // Red
        }
      }

      if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 7) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    currentRow++;
  });

  // Footer Signatures
  currentRow += 2; // Spacing

  // Prepared by (Tutor)
  const preparedByLabel = worksheet.getCell(`E${currentRow}`);
  preparedByLabel.value = 'Prepared by:';
  preparedByLabel.font = { name: 'Calibri', size: 11, italic: true };
  preparedByLabel.alignment = { horizontal: 'center' };

  currentRow += 2;
  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  const tutorCell = worksheet.getCell(`E${currentRow}`);
  tutorCell.value = data.tutorName.toUpperCase();
  tutorCell.font = { name: 'Calibri', size: 11, bold: true, underline: true };
  tutorCell.alignment = { horizontal: 'center' };

  currentRow++;
  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  const tutorTitleCell = worksheet.getCell(`E${currentRow}`);
  tutorTitleCell.value = data.tutorTitle;
  tutorTitleCell.font = { name: 'Calibri', size: 10 };
  tutorTitleCell.alignment = { horizontal: 'center' };

  currentRow += 2; // Spacing

  // Checked and Noted
  const checkedLabel = worksheet.getCell(`A${currentRow}`);
  checkedLabel.value = 'Checked:';
  checkedLabel.font = { name: 'Calibri', size: 11, italic: true };
  checkedLabel.alignment = { horizontal: 'left' };

  const notedLabel = worksheet.getCell(`E${currentRow}`);
  notedLabel.value = 'Noted:';
  notedLabel.font = { name: 'Calibri', size: 11, italic: true };
  notedLabel.alignment = { horizontal: 'center' };

  currentRow += 2;
  // Checked Name
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  const checkedCell = worksheet.getCell(`A${currentRow}`);
  checkedCell.value = data.checkedName.toUpperCase();
  checkedCell.font = { name: 'Calibri', size: 11, bold: true, underline: true };
  checkedCell.alignment = { horizontal: 'center' };

  // Noted Name
  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  const notedCell = worksheet.getCell(`E${currentRow}`);
  notedCell.value = data.notedName.toUpperCase();
  notedCell.font = { name: 'Calibri', size: 11, bold: true, underline: true };
  notedCell.alignment = { horizontal: 'center' };

  currentRow++;
  // Checked Title
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  const checkedTitleCell = worksheet.getCell(`A${currentRow}`);
  checkedTitleCell.value = data.checkedTitle;
  checkedTitleCell.font = { name: 'Calibri', size: 10 };
  checkedTitleCell.alignment = { horizontal: 'center' };

  // Noted Title
  worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
  const notedTitleCell = worksheet.getCell(`E${currentRow}`);
  notedTitleCell.value = data.notedTitle;
  notedTitleCell.font = { name: 'Calibri', size: 10 };
  notedTitleCell.alignment = { horizontal: 'center' };

  // Generate buffer & trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `Student_Attendance_${data.gradeSection.replace(/\s+/g, '_')}_${data.dateStr.replace(/[\/\s]/g, '_')}.xlsx`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
