import ExcelJS from 'exceljs';
import type { Attendance } from '../types';

export interface DtrExportData {
  records: Attendance[];
  preparedBy: string;
  inChargeTitle?: string;
  selectedDate?: string;
  selectedMonth?: string; // YYYY-MM
  schoolName?: string;
  division?: string;
  district?: string;
  officeHoursRegular?: string;
  officeHoursArrivalDeparture?: string;
  officeHoursSaturdays?: string;
  staffName?: string;
  staffNameRight?: string;
  copyMode?: 'duplicate' | 'dual';
  paperSize?: 'letter' | 'a4' | 'folio';
}

const formatTime12h = (value: string | null | undefined): string => {
  if (!value) return '';
  const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]}`;
};

const timeToMinutes = (value: string | null | undefined): number | null => {
  const match = value?.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const getMonthLabel = (month: string): string => {
  try {
    return new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return month;
  }
};

const getPunches = (record: Attendance) => {
  const legacyIn = timeToMinutes(record.time_in);
  const legacyOut = timeToMinutes(record.time_out);
  const arrivalAm = record.arrival_am || (legacyIn !== null && legacyIn < 720 ? record.time_in : null);
  const departureAm = record.departure_am || (legacyOut !== null && legacyOut < 720 ? record.time_out : null);
  const arrivalPm = record.arrival_pm || (legacyIn !== null && legacyIn >= 720 ? record.time_in : null);
  const departurePm = record.departure_pm || (legacyOut !== null && legacyOut >= 720 ? record.time_out : null);
  return { arrivalAm, departureAm, arrivalPm, departurePm };
};

export const exportDtrToExcel = async ({
  records,
  preparedBy,
  inChargeTitle = 'School Principal',
  selectedDate,
  selectedMonth,
  officeHoursRegular = '8:00 AM - 12:00 PM / 1:00 PM - 5:00 PM',
  officeHoursArrivalDeparture = '8:00 AM & 5:00 PM',
  officeHoursSaturdays = 'As required',
  staffName,
  staffNameRight,
  paperSize = 'letter',
}: DtrExportData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ARALert - Civil Service Form 48';
  workbook.created = new Date();

  // Determine active month
  const targetMonth = selectedMonth || (selectedDate ? selectedDate.slice(0, 7) : new Date().toISOString().slice(0, 7));
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const monthLabel = getMonthLabel(targetMonth);

  // Filter records strictly to tutor, faculty, principal, and admin only
  const validRecords = records.filter((r) =>
    ['tutor', 'faculty', 'principal', 'admin'].includes((r.role || '').toLowerCase())
  );

  // Group records by staff
  const staffGrouped = new Map<string, Attendance[]>();
  validRecords.forEach((r) => {
    const sId = String(r.user || r.tutor || r.user_name || 'Staff');
    const existing = staffGrouped.get(sId) || [];
    existing.push(r);
    staffGrouped.set(sId, existing);
  });

  const staffEntries = staffName
    ? ([[staffName, validRecords]] as Array<[string, Attendance[]]>)
    : staffGrouped.size > 0
    ? Array.from(staffGrouped.entries())
    : ([['STAFF MEMBER', validRecords]] as Array<[string, Attendance[]]>);

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  staffEntries.forEach(([entryKey, staffRecords], sIdx) => {
    const activeStaffName = staffName || staffRecords[0]?.user_name || entryKey || 'STAFF MEMBER';
    const activeRightName = staffNameRight || activeStaffName;

    const safeSheetName = `${activeStaffName.split(' ')[0]}_${targetMonth}`
      .replace(/[\\/*?:[\]]/g, '')
      .slice(0, 25);
    const sheetName = sIdx > 0 ? `${safeSheetName}_${sIdx + 1}` : safeSheetName;
    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

    worksheet.views = [{ state: 'normal', showGridLines: false }];

    // Excel paper codes: 1 = Letter, 9 = A4, 14 = Folio (8.5 x 13 in)
    const PAPER = {
      letter: { code: 1, w: 612, h: 792 },
      a4: { code: 9, w: 595, h: 842 },
      folio: { code: 14, w: 612, h: 936 },
    } as const;
    const paper = PAPER[paperSize] || PAPER.letter;

    worksheet.pageSetup = {
      orientation: 'portrait',
      paperSize: paper.code as any,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0, footer: 0 },
    };

    // Filler row height so the sheet's aspect ratio matches the chosen paper (like the preview's mt-auto)
    const COL_UNITS = [4.2, 8.8, 8.8, 8.8, 8.8, 6.2, 6.2, 3.2, 4.2, 8.8, 8.8, 8.8, 8.8, 6.2, 6.2];
    const sheetWidthPt = COL_UNITS.reduce((s, w) => s + (w * 7 + 5) * 0.75, 0);
    const printableW = paper.w - 0.5 * 72;
    const printableH = paper.h - 0.7 * 72;
    const scale = Math.min(1, printableW / sheetWidthPt);
    const FIXED_ROWS_PT = 700;
    const fillerRowHeight = Math.max(12, printableH / scale - FIXED_ROWS_PT - 10);

    // Columns: A-G (Left copy), H (Cut separator), I-O (Right copy)
    worksheet.columns = [
      { width: 4.2 }, // A: Day
      { width: 8.8 }, // B: AM Arr
      { width: 8.8 }, // C: AM Dep
      { width: 8.8 }, // D: PM Arr
      { width: 8.8 }, // E: PM Dep
      { width: 6.2 }, // F: Hrs
      { width: 6.2 }, // G: Min
      { width: 3.2 }, // H: Cut separator
      { width: 4.2 }, // I: Day
      { width: 8.8 }, // J: AM Arr
      { width: 8.8 }, // K: AM Dep
      { width: 8.8 }, // L: PM Arr
      { width: 8.8 }, // M: PM Dep
      { width: 6.2 }, // N: Hrs
      { width: 6.2 }, // O: Min
    ];

    // Helper to format each CS Form 48 side
    const populateFormSide = (colOffset: number, personName: string) => {
      const c = (colIndex: number) => String.fromCharCode(65 + colOffset + colIndex);

      // Row 1: CS Form 48
      const csCell = worksheet.getCell(`${c(0)}1`);
      csCell.value = 'CS Form 48';
      csCell.font = { name: 'Times New Roman', size: 8.5, italic: true };
      worksheet.getRow(1).height = 14;

      // Row 2: DAILY TIME RECORD
      worksheet.mergeCells(`${c(0)}2:${c(6)}2`);
      const titleCell = worksheet.getCell(`${c(0)}2`);
      titleCell.value = 'DAILY TIME RECORD';
      titleCell.font = { name: 'Times New Roman', size: 11.5, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 18;

      // Row 3: Spacer
      worksheet.getRow(3).height = 4;

      const lineBottom: Partial<ExcelJS.Borders> = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
      const underlineRange = (row: number, from: number, to: number) => {
        for (let i = from; i <= to; i++) worksheet.getCell(`${c(i)}${row}`).border = lineBottom;
      };

      // Row 4: Name (line drawn as a cell border below the text, 80% width like the preview)
      worksheet.mergeCells(`${c(1)}4:${c(5)}4`);
      const nameCell = worksheet.getCell(`${c(1)}4`);
      nameCell.value = personName.toUpperCase();
      nameCell.font = { name: 'Times New Roman', size: 9, bold: true };
      nameCell.alignment = { horizontal: 'center', vertical: 'bottom' };
      underlineRange(4, 1, 5);
      worksheet.getRow(4).height = 16;

      // Row 5: "(Name)"
      worksheet.mergeCells(`${c(0)}5:${c(6)}5`);
      const nameSubCell = worksheet.getCell(`${c(0)}5`);
      nameSubCell.value = '(Name)';
      nameSubCell.font = { name: 'Times New Roman', size: 6.5, italic: true };
      nameSubCell.alignment = { horizontal: 'center', vertical: 'top' };
      worksheet.getRow(5).height = 14;

      // Rows 6-9: label on the left, value centered on a full-width line on the right
      const metaRow = (row: number, label: string, value: string, bold = false) => {
        worksheet.mergeCells(`${c(0)}${row}:${c(2)}${row}`);
        const l = worksheet.getCell(`${c(0)}${row}`);
        l.value = label;
        l.font = { name: 'Times New Roman', size: 7 };
        l.alignment = { horizontal: 'left', vertical: 'bottom' };

        worksheet.mergeCells(`${c(3)}${row}:${c(6)}${row}`);
        const v = worksheet.getCell(`${c(3)}${row}`);
        v.value = value;
        v.font = { name: 'Times New Roman', size: bold ? 7 : 6.5, bold };
        v.alignment = { horizontal: 'center', vertical: 'bottom', shrinkToFit: true };
        underlineRange(row, 3, 6);
        worksheet.getRow(row).height = 13;
      };
      metaRow(6, 'For the month of', monthLabel, true);
      metaRow(7, 'Office Hours (regular days)', officeHoursRegular);
      metaRow(8, 'Arrival & Departure', officeHoursArrivalDeparture);
      metaRow(9, 'Saturdays', officeHoursSaturdays);

      // Row 10: Table Header 1
      worksheet.mergeCells(`${c(0)}10:${c(0)}11`);
      const dayHeader = worksheet.getCell(`${c(0)}10`);
      dayHeader.value = 'Day';
      dayHeader.font = { name: 'Times New Roman', size: 8.5, bold: true };
      dayHeader.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`${c(1)}10:${c(2)}10`);
      const amHeader = worksheet.getCell(`${c(1)}10`);
      amHeader.value = 'A M';
      amHeader.font = { name: 'Times New Roman', size: 9, bold: true };
      amHeader.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`${c(3)}10:${c(4)}10`);
      const pmHeader = worksheet.getCell(`${c(3)}10`);
      pmHeader.value = 'P M';
      pmHeader.font = { name: 'Times New Roman', size: 9, bold: true };
      pmHeader.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells(`${c(5)}10:${c(6)}10`);
      const utHeader = worksheet.getCell(`${c(5)}10`);
      utHeader.value = 'Undertime';
      utHeader.font = { name: 'Times New Roman', size: 8, bold: true };
      utHeader.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(10).height = 15;

      // Row 11: Table Header 2
      const subHeaders = ['Arrival', 'Departure', 'Arrival', 'Departure', 'Hours', 'Min.'];
      subHeaders.forEach((sub, idx) => {
        const cell = worksheet.getCell(`${c(idx + 1)}11`);
        cell.value = sub;
        cell.font = { name: 'Times New Roman', size: 7.5, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      worksheet.getRow(11).height = 15;

      // Borders for header
      for (let r = 10; r <= 11; r++) {
        for (let col = 0; col <= 6; col++) {
          worksheet.getCell(`${c(col)}${r}`).border = thinBorder;
        }
      }

      // Map punches
      const staffDateMap = new Map<string, Attendance>();
      staffRecords.forEach((rec) => {
        if (!staffDateMap.has(rec.date)) {
          staffDateMap.set(rec.date, rec);
        }
      });

      let totalWorkMinutes = 0;

      // Rows 12..42: Days 1 to 31
      for (let d = 1; d <= 31; d++) {
        const rowNum = 11 + d;
        worksheet.getRow(rowNum).height = 13.5;

        const dayCell = worksheet.getCell(`${c(0)}${rowNum}`);
        dayCell.value = d;
        dayCell.font = { name: 'Times New Roman', size: 8, bold: true };
        dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dayCell.border = thinBorder;

        const dateKey = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const record = d <= daysInMonth ? staffDateMap.get(dateKey) : null;
        const punches = record
          ? getPunches(record)
          : { arrivalAm: null, departureAm: null, arrivalPm: null, departurePm: null };

        const arrAmStr = formatTime12h(punches.arrivalAm);
        const depAmStr = formatTime12h(punches.departureAm);
        const arrPmStr = formatTime12h(punches.arrivalPm);
        const depPmStr = formatTime12h(punches.departurePm);

        const mArrAm = timeToMinutes(punches.arrivalAm);
        const mDepAm = timeToMinutes(punches.departureAm);
        const mArrPm = timeToMinutes(punches.arrivalPm);
        const mDepPm = timeToMinutes(punches.departurePm);

        let dMinutes = 0;
        if (mArrAm !== null && mDepAm !== null && mDepAm > mArrAm) dMinutes += mDepAm - mArrAm;
        if (mArrPm !== null && mDepPm !== null && mDepPm > mArrPm) dMinutes += mDepPm - mArrPm;

        if (dMinutes > 0) totalWorkMinutes += dMinutes;

        const vals = [
          arrAmStr,
          depAmStr,
          arrPmStr,
          depPmStr,
          dMinutes > 0 ? Math.floor(dMinutes / 60) : '',
          dMinutes > 0 ? dMinutes % 60 : '',
        ];

        vals.forEach((val, vIdx) => {
          const valCell = worksheet.getCell(`${c(vIdx + 1)}${rowNum}`);
          valCell.value = val;
          valCell.font = { name: 'Times New Roman', size: 8 };
          valCell.alignment = { horizontal: 'center', vertical: 'middle' };
          valCell.border = thinBorder;
        });
      }

      // Row 43: Total
      const totalRowNum = 43;
      worksheet.getRow(totalRowNum).height = 15;
      worksheet.mergeCells(`${c(0)}${totalRowNum}:${c(4)}${totalRowNum}`);
      const totLabel = worksheet.getCell(`${c(0)}${totalRowNum}`);
      totLabel.value = 'Total';
      totLabel.font = { name: 'Times New Roman', size: 8.5, bold: true };
      totLabel.alignment = { horizontal: 'right', vertical: 'middle' };

      const totHrsCell = worksheet.getCell(`${c(5)}${totalRowNum}`);
      totHrsCell.value = totalWorkMinutes > 0 ? Math.floor(totalWorkMinutes / 60) : '';
      totHrsCell.font = { name: 'Times New Roman', size: 8.5, bold: true };
      totHrsCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const totMinCell = worksheet.getCell(`${c(6)}${totalRowNum}`);
      totMinCell.value = totalWorkMinutes > 0 ? totalWorkMinutes % 60 : '';
      totMinCell.font = { name: 'Times New Roman', size: 8.5, bold: true };
      totMinCell.alignment = { horizontal: 'center', vertical: 'middle' };

      for (let col = 0; col <= 6; col++) {
        worksheet.getCell(`${c(col)}${totalRowNum}`).border = thinBorder;
      }

      // Row 44: flexible filler (preview: mt-auto pushes the certification to the bottom)
      worksheet.getRow(44).height = fillerRowHeight;

      // Rows 45-47: Certification statement
      worksheet.mergeCells(`${c(0)}45:${c(6)}47`);
      const certCell = worksheet.getCell(`${c(0)}45`);
      certCell.value =
        'I certify on my honor that the above is true and correct record of the hours of work performed, record of which was made daily at the time of arrival and departure from the office.';
      certCell.font = { name: 'Times New Roman', size: 6.5 };
      certCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'justify' };
      worksheet.getRow(45).height = 12;
      worksheet.getRow(46).height = 12;
      worksheet.getRow(47).height = 12;
      worksheet.getRow(48).height = 8;

      // Row 49: Signature line (border only)
      underlineRange(49, 1, 5);
      worksheet.getRow(49).height = 14;

      // Row 50: (Signature)
      worksheet.mergeCells(`${c(1)}50:${c(5)}50`);
      const sigSub = worksheet.getCell(`${c(1)}50`);
      sigSub.value = '(Signature)';
      sigSub.font = { name: 'Times New Roman', size: 6.5, italic: true };
      sigSub.alignment = { horizontal: 'center', vertical: 'top' };
      worksheet.getRow(50).height = 12;

      // Row 51: Verified as to prescribed office hours
      worksheet.mergeCells(`${c(0)}51:${c(6)}51`);
      const verText = worksheet.getCell(`${c(0)}51`);
      verText.value = 'Verified as to the prescribed office hours:';
      verText.font = { name: 'Times New Roman', size: 6.5 };
      worksheet.getRow(51).height = 14;
      worksheet.getRow(52).height = 8;

      // Row 53: In-charge Name (line drawn as a border below the text)
      worksheet.mergeCells(`${c(1)}53:${c(5)}53`);
      const inChName = worksheet.getCell(`${c(1)}53`);
      inChName.value = preparedBy.toUpperCase();
      inChName.font = { name: 'Times New Roman', size: 8, bold: true };
      inChName.alignment = { horizontal: 'center', vertical: 'bottom' };
      underlineRange(53, 1, 5);
      worksheet.getRow(53).height = 15;

      // Row 54: (In-charge)
      worksheet.mergeCells(`${c(1)}54:${c(5)}54`);
      const inChSub = worksheet.getCell(`${c(1)}54`);
      inChSub.value = `(${inChargeTitle || 'School Principal'})`;
      inChSub.font = { name: 'Times New Roman', size: 6.5, italic: true };
      inChSub.alignment = { horizontal: 'center', vertical: 'top' };
      worksheet.getRow(54).height = 12;
    };

    // Populate Left side (Cols A-G, offset 0)
    populateFormSide(0, activeStaffName);

    // Divider cut-line in Column H (offset 7)
    for (let r = 1; r <= 54; r++) {
      worksheet.getCell(`H${r}`).border = { right: { style: 'dashed', color: { argb: 'FF94A3B8' } } };
    }

    // Populate Right side (Cols I-O, offset 8)
    populateFormSide(8, activeRightName);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileNamePrefix = staffName ? staffName.replace(/\s+/g, '_') : 'CS_Form_48';
  link.download = `CS_Form_48_DTR_${fileNamePrefix}_${targetMonth}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
