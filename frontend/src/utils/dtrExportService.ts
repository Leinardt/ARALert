import ExcelJS from 'exceljs';
import type { Attendance } from '../types';

const formatTime = (value: string | null | undefined) => {
  if (!value) return '';
  const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const timeToMinutes = (value: string | null | undefined) => {
  const match = value?.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

const getMonthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
  month: 'long',
  year: 'numeric',
});

const getPunches = (record: Attendance) => {
  const legacyIn = timeToMinutes(record.time_in);
  const legacyOut = timeToMinutes(record.time_out);
  const arrivalAm = record.arrival_am || (legacyIn !== null && legacyIn < 720 ? record.time_in : null);
  const departureAm = record.departure_am || (legacyOut !== null && legacyOut < 720 ? record.time_out : null);
  const arrivalPm = record.arrival_pm || (legacyIn !== null && legacyIn >= 720 ? record.time_in : null);
  const departurePm = record.departure_pm || (legacyOut !== null && legacyOut >= 720 ? record.time_out : null);
  return { arrivalAm, departureAm, arrivalPm, departurePm };
};

export interface DtrExportData {
  records: Attendance[];
  preparedBy: string;
  selectedDate?: string;
  schoolName?: string;
  division?: string;
  district?: string;
}

export const exportDtrToExcel = async ({
  records,
  preparedBy,
  selectedDate,
  schoolName = 'ARALERT SCHOOL',
  division = 'DEPARTMENT OF EDUCATION',
  district = 'ARAL PROGRAM',
}: DtrExportData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ARALert';
  workbook.created = new Date();

  const grouped = new Map<string, Attendance[]>();
  records
    .filter((record) => ['tutor', 'faculty'].includes(record.role))
    .forEach((record) => {
      const key = `${record.user}|${record.date.slice(0, 7)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF1F2937' } },
    left: { style: 'thin', color: { argb: 'FF1F2937' } },
    bottom: { style: 'thin', color: { argb: 'FF1F2937' } },
    right: { style: 'thin', color: { argb: 'FF1F2937' } },
  };

  Array.from(grouped.entries()).forEach(([key, staffRecords], index) => {
    const [, month] = key.split('|');
    const firstRecord = staffRecords[0];
    const baseSheetName = `${firstRecord.user_name || 'Staff'} ${month}`.replace(/[\\/*?:[\]]/g, '').slice(0, 28);
    const worksheet = workbook.addWorksheet(`${baseSheetName}${index ? ` ${index + 1}` : ''}`.slice(0, 31));
    worksheet.pageSetup = {
      orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1,
      margins: { left: 0.35, right: 0.35, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    };
    worksheet.columns = [
      { width: 7 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 15 },
    ];

    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = division.toUpperCase();
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = district.toUpperCase();
    worksheet.mergeCells('A3:H3');
    worksheet.getCell('A3').value = schoolName.toUpperCase();
    worksheet.mergeCells('A5:H5');
    worksheet.getCell('A5').value = 'DAILY TIME RECORD';
    worksheet.mergeCells('A6:H6');
    worksheet.getCell('A6').value = `For the month of ${getMonthLabel(month).toUpperCase()}`;
    worksheet.mergeCells('A8:D8');
    worksheet.getCell('A8').value = `NAME: ${(firstRecord.user_name || 'STAFF MEMBER').toUpperCase()}`;
    worksheet.mergeCells('E8:H8');
    worksheet.getCell('E8').value = `POSITION: ${(firstRecord.role || 'STAFF').toUpperCase()}`;

    ['A1', 'A2', 'A3', 'A5', 'A6'].forEach((cellRef) => {
      const cell = worksheet.getCell(cellRef);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: 'Calibri', size: cellRef === 'A5' ? 14 : 11, bold: cellRef === 'A3' || cellRef === 'A5' };
    });
    worksheet.getRow(5).height = 24;
    ['A8', 'E8'].forEach((cellRef) => {
      const cell = worksheet.getCell(cellRef);
      cell.font = { name: 'Calibri', size: 10, bold: true };
    });

    worksheet.mergeCells('A10:A11');
    worksheet.mergeCells('B10:C10');
    worksheet.mergeCells('D10:E10');
    worksheet.mergeCells('F10:F11');
    worksheet.mergeCells('G10:G11');
    worksheet.mergeCells('H10:H11');
    worksheet.getRow(10).values = ['DAY', 'A.M.', '', 'P.M.', '', 'TOTAL', 'UNDERTIME', 'REMARKS'];
    worksheet.getRow(11).values = ['', 'Arrival', 'Departure', 'Arrival', 'Departure', 'HOURS', '', ''];
    [worksheet.getRow(10), worksheet.getRow(11)].forEach((headerRow) => {
      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        cell.border = thinBorder;
      });
    });
    worksheet.getRow(10).height = 20;
    worksheet.getRow(11).height = 20;

    const byDate = new Map<string, Attendance>();
    staffRecords.forEach((record) => {
      const existing = byDate.get(record.date);
      if (!existing) {
        byDate.set(record.date, { ...record });
        return;
      }
      (['arrival_am', 'departure_am', 'arrival_pm', 'departure_pm'] as const).forEach((field) => {
        if (!existing[field] && record[field]) existing[field] = record[field];
      });
    });

    const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const rowNumber = 11 + day;
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const record = byDate.get(date);
      const punches = record ? getPunches(record) : { arrivalAm: null, departureAm: null, arrivalPm: null, departurePm: null };
      const amStart = timeToMinutes(punches.arrivalAm);
      const amEnd = timeToMinutes(punches.departureAm);
      const pmStart = timeToMinutes(punches.arrivalPm);
      const pmEnd = timeToMinutes(punches.departurePm);
      const totalMinutes = (amStart !== null && amEnd !== null ? Math.max(0, amEnd - amStart) : 0)
        + (pmStart !== null && pmEnd !== null ? Math.max(0, pmEnd - pmStart) : 0);
      const undertimeMinutes = pmEnd !== null && pmEnd < 1020 ? 1020 - pmEnd : 0;
      const row = worksheet.getRow(rowNumber);
      row.values = [day, formatTime(punches.arrivalAm), formatTime(punches.departureAm), formatTime(punches.arrivalPm), formatTime(punches.departurePm), totalMinutes ? formatDuration(totalMinutes) : '', undertimeMinutes ? formatDuration(undertimeMinutes) : '', record?.status_display || ''];
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });
    }

    const signatureRow = 14 + daysInMonth;
    worksheet.mergeCells(`E${signatureRow}:H${signatureRow}`);
    worksheet.getCell(`E${signatureRow}`).value = 'Certified Correct:';
    worksheet.getCell(`E${signatureRow}`).alignment = { horizontal: 'center' };
    worksheet.mergeCells(`E${signatureRow + 3}:H${signatureRow + 3}`);
    const preparedCell = worksheet.getCell(`E${signatureRow + 3}`);
    preparedCell.value = preparedBy.toUpperCase();
    preparedCell.font = { name: 'Calibri', size: 11, bold: true, underline: true };
    preparedCell.alignment = { horizontal: 'center' };
    worksheet.mergeCells(`E${signatureRow + 4}:H${signatureRow + 4}`);
    worksheet.getCell(`E${signatureRow + 4}`).value = 'School Principal';
    worksheet.getCell(`E${signatureRow + 4}`).alignment = { horizontal: 'center' };
    worksheet.views = [{ state: 'frozen', ySplit: 11, showGridLines: false }];
  });

  if (!grouped.size) throw new Error('No tutor or faculty attendance records are available for export.');

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Tutor_Faculty_DTR_${selectedDate || new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
