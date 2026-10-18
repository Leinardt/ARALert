import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
  PageOrientation,
  HeightRule,
  LineRuleType,
  TabStopType,
  TableLayoutType,
} from 'docx';
import type { Attendance } from '../types';

export interface DtrDocxExportData {
  records: Attendance[];
  staffName: string;
  staffNameRight?: string;
  monthKey: string; // YYYY-MM
  officeHoursRegular: string;
  officeHoursArrivalDeparture: string;
  officeHoursSaturdays: string;
  inChargeName: string;
  inChargeTitle: string;
  paperSize?: 'letter' | 'a4' | 'folio';
}

const timeStringToMinutes = (val?: string | null): number | null => {
  if (!val) return null;
  const match = val.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const formatTime12h = (val?: string | null): string => {
  if (!val) return '';
  const match = val.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return val;
  const h = Number(match[1]);
  const m = match[2];
  const h12 = h % 12 || 12;
  return `${h12}:${m}`;
};

/* ------------------------------------------------------------------ */
/* Geometry — mirrors the on-screen preview (1 CSS px = 15 twips)       */
/* ------------------------------------------------------------------ */

// Page sizes in twips (1 in = 1440)
const PAGE_SIZES: Record<'letter' | 'a4' | 'folio', { w: number; h: number }> = {
  letter: { w: 12240, h: 15840 }, // 8.5 x 11 in
  a4: { w: 11906, h: 16838 }, // 210 x 297 mm
  folio: { w: 12240, h: 18720 }, // 8.5 x 13 in
};

const PAGE_MARGIN = 300; // preview sheet padding: 20px
const GAP_HALF = 300; // preview gap between slips: 40px total (split in two cells around the cut line)
const SLIP_PAD = 180; // preview slip padding: 12px
const TRAILING_RESERVE = 240; // Word always appends a paragraph after a table; keep room so it never spills to page 2

// Fixed row heights (twips) — preview rows are ~17px
const ROW_HEADER = 255;
const ROW_DAY = 255;
const ROW_TOTAL = 270;
const ROW_META = 255;

// Preview column proportions: Day 28 | Arr 42 | Dep 42 | Arr 42 | Dep 42 | Hours 30 | Min 26
const COL_RATIO = [28, 42, 42, 42, 42, 30, 26];

const FONT = 'Times New Roman';
const LINE = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const ALL_LINES = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const NO_LINES = { top: NONE, bottom: NONE, left: NONE, right: NONE };

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

/**
 * Paragraph with an EXACT line height so every block has a deterministic height,
 * just like the fixed pixel heights used in the preview.
 */
const para = (opts: {
  runs?: TextRun[];
  text?: string;
  size?: number; // half-points
  bold?: boolean;
  italics?: boolean;
  align?: Align;
  line: number; // exact line height in twips
  before?: number;
  after?: number;
  indentLeft?: number;
  indentRight?: number;
  bottomBorder?: boolean;
  tabCenter?: number;
}) =>
  new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? 0,
      line: Math.max(20, Math.round(opts.line)),
      lineRule: LineRuleType.EXACT,
    },
    indent:
      opts.indentLeft || opts.indentRight
        ? { left: Math.round(opts.indentLeft || 0), right: Math.round(opts.indentRight || 0) }
        : undefined,
    border: opts.bottomBorder ? { bottom: { ...LINE, space: 1 } } : undefined,
    tabStops: opts.tabCenter ? [{ type: TabStopType.CENTER, position: Math.round(opts.tabCenter) }] : undefined,
    children:
      opts.runs ??
      [
        new TextRun({
          text: opts.text ?? '',
          font: FONT,
          size: opts.size ?? 14,
          bold: opts.bold,
          italics: opts.italics,
        }),
      ],
  });

export const exportDtrToDocx = async (data: DtrDocxExportData): Promise<void> => {
  const [yearStr, monthStr] = data.monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthLabel = new Date(`${data.monthKey}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const staffRight = data.staffNameRight || data.staffName;

  // Filter records strictly to tutor, faculty, principal, and admin only
  const validRecords = data.records.filter((r) =>
    ['tutor', 'faculty', 'principal', 'admin'].includes((r.role || '').toLowerCase())
  );

  // Build 31 daily punch records for a given staff member
  const getDaysForStaff = (name: string) => {
    const days = [];
    let totalMins = 0;

    for (let d = 1; d <= 31; d++) {
      if (d > daysInMonth) {
        days.push({ dayNum: d, arrAm: '', depAm: '', arrPm: '', depPm: '', hours: '', min: '' });
        continue;
      }
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = validRecords.find(
        (r) =>
          r.date === dateKey &&
          (r.user_name?.toLowerCase().includes(name.toLowerCase()) ||
            r.tutor_name?.toLowerCase().includes(name.toLowerCase()) ||
            !validRecords.some((other) => other.date === dateKey && other.user_name !== r.user_name))
      );

      let arrAm = '';
      let depAm = '';
      let arrPm = '';
      let depPm = '';
      let hrs = '';
      let mins = '';

      if (rec) {
        const legacyInMin = timeStringToMinutes(rec.time_in);
        const legacyOutMin = timeStringToMinutes(rec.time_out);
        const rawArrAm = rec.arrival_am || (legacyInMin !== null && legacyInMin < 720 ? rec.time_in : null);
        const rawDepAm = rec.departure_am || (legacyOutMin !== null && legacyOutMin < 720 ? rec.time_out : null);
        const rawArrPm = rec.arrival_pm || (legacyInMin !== null && legacyInMin >= 720 ? rec.time_in : null);
        const rawDepPm = rec.departure_pm || (legacyOutMin !== null && legacyOutMin >= 720 ? rec.time_out : null);

        arrAm = formatTime12h(rawArrAm);
        depAm = formatTime12h(rawDepAm);
        arrPm = formatTime12h(rawArrPm);
        depPm = formatTime12h(rawDepPm);

        const mArrAm = timeStringToMinutes(rawArrAm);
        const mDepAm = timeStringToMinutes(rawDepAm);
        const mArrPm = timeStringToMinutes(rawArrPm);
        const mDepPm = timeStringToMinutes(rawDepPm);

        let dMins = 0;
        if (mArrAm !== null && mDepAm !== null && mDepAm > mArrAm) dMins += mDepAm - mArrAm;
        if (mArrPm !== null && mDepPm !== null && mDepPm > mArrPm) dMins += mDepPm - mArrPm;

        if (dMins > 0) {
          totalMins += dMins;
          hrs = String(Math.floor(dMins / 60));
          mins = String(dMins % 60);
        }
      }

      days.push({ dayNum: d, arrAm, depAm, arrPm, depPm, hours: hrs, min: mins });
    }
    return { days, totalHours: Math.floor(totalMins / 60), totalMins: totalMins % 60 };
  };

  const leftData = getDaysForStaff(data.staffName);
  const rightData = getDaysForStaff(staffRight);

  /* ---------------- Page geometry for the selected paper size ---------------- */
  const page = PAGE_SIZES[data.paperSize || 'letter'] || PAGE_SIZES.letter;
  const contentW = page.w - PAGE_MARGIN * 2;
  const slipW = Math.floor((contentW - GAP_HALF * 2) / 2);
  const innerW = slipW - SLIP_PAD * 2 - 24; // minus padding & slip border
  const slipH = page.h - PAGE_MARGIN * 2 - TRAILING_RESERVE;
  const innerH = slipH - SLIP_PAD * 2 - 24;

  const ratioSum = COL_RATIO.reduce((a, b) => a + b, 0);
  const colW = COL_RATIO.map((r) => Math.floor((r / ratioSum) * innerW));
  colW[colW.length - 1] += innerW - colW.reduce((a, b) => a + b, 0); // absorb rounding

  /* ---------------- Block heights (twips) — used to push signatures to the bottom ---------------- */
  const H = {
    title: 300,
    titleAfter: 60,
    name: 280,
    nameAfter: 30,
    nameLabel: 180,
    nameLabelAfter: 120,
    meta: ROW_META * 4,
    metaAfter: 120,
    table: ROW_HEADER * 2 + ROW_DAY * 31 + ROW_TOTAL,
    certLine: 210,
    certLines: 3,
    sigBefore: 360,
    sigLine: 200,
    sigLabel: 180,
    sigLabelAfter: 140,
    verified: 200,
    verifiedAfter: 160,
    inCharge: 220,
    inChargeLabel: 180,
  };
  const topBlock =
    H.title + H.titleAfter + H.name + H.nameAfter + H.nameLabel + H.nameLabelAfter + H.meta + H.metaAfter + H.table;
  const bottomBlock =
    H.certLine * H.certLines +
    H.sigBefore +
    H.sigLine +
    H.sigLabel +
    H.sigLabelAfter +
    H.verified +
    H.verifiedAfter +
    H.inCharge +
    H.inChargeLabel;
  // Same as preview's `mt-auto`: free space sits between the table and the certification
  const flexSpacer = Math.max(40, innerH - topBlock - bottomBlock - 120);

  /* ---------------- Builders ---------------- */
  const cell = (
    text: string,
    width: number,
    o: { size?: number; bold?: boolean; align?: Align; colSpan?: number; rowSpan?: number; lineH?: number } = {}
  ) =>
    new TableCell({
      borders: ALL_LINES,
      width: { size: width, type: WidthType.DXA },
      columnSpan: o.colSpan,
      rowSpan: o.rowSpan,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 0, bottom: 0, left: 30, right: 30 },
      children: [
        para({
          text,
          size: o.size ?? 13,
          bold: o.bold,
          align: o.align ?? AlignmentType.CENTER,
          line: o.lineH ?? 200,
        }),
      ],
    });

  const buildMetaTable = () => {
    const labelW = Math.min(2100, Math.floor(innerW * 0.42));
    const valueW = innerW - labelW;
    const row = (label: string, value: string, boldValue = false, valueSize = 13) =>
      new TableRow({
        height: { value: ROW_META, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            borders: NO_LINES,
            width: { size: labelW, type: WidthType.DXA },
            verticalAlign: VerticalAlign.BOTTOM,
            margins: { top: 0, bottom: 20, left: 0, right: 90 },
            children: [para({ text: label, size: 14, line: 200 })],
          }),
          new TableCell({
            borders: { ...NO_LINES, bottom: LINE },
            width: { size: valueW, type: WidthType.DXA },
            verticalAlign: VerticalAlign.BOTTOM,
            margins: { top: 0, bottom: 20, left: 0, right: 0 },
            children: [
              para({ text: value, size: valueSize, bold: boldValue, align: AlignmentType.CENTER, line: 200 }),
            ],
          }),
        ],
      });

    return new Table({
      width: { size: innerW, type: WidthType.DXA },
      columnWidths: [labelW, valueW],
      layout: TableLayoutType.FIXED,
      borders: { ...NO_LINES, insideHorizontal: NONE, insideVertical: NONE },
      rows: [
        row('For the month of', monthLabel, true, 14),
        row('Office Hours (regular days)', data.officeHoursRegular),
        row('Arrival & Departure', data.officeHoursArrivalDeparture),
        row('Saturdays', data.officeHoursSaturdays),
      ],
    });
  };

  const buildDtrTable = (staffRecord: typeof leftData) => {
    const rows: TableRow[] = [
      new TableRow({
        height: { value: ROW_HEADER, rule: HeightRule.EXACT },
        children: [
          cell('Day', colW[0], { bold: true, rowSpan: 2, size: 13 }),
          cell('A M', colW[1] + colW[2], { bold: true, colSpan: 2, size: 13 }),
          cell('P M', colW[3] + colW[4], { bold: true, colSpan: 2, size: 13 }),
          cell('Undertime', colW[5] + colW[6], { bold: true, colSpan: 2, size: 13 }),
        ],
      }),
      new TableRow({
        height: { value: ROW_HEADER, rule: HeightRule.EXACT },
        children: ['Arrival', 'Departure', 'Arrival', 'Departure', 'Hours', 'Min.'].map((t, i) =>
          cell(t, colW[i + 1], { bold: true, size: 12 })
        ),
      }),
    ];

    staffRecord.days.forEach((d) => {
      rows.push(
        new TableRow({
          height: { value: ROW_DAY, rule: HeightRule.EXACT },
          children: [
            cell(String(d.dayNum), colW[0], { bold: true }),
            cell(d.arrAm, colW[1]),
            cell(d.depAm, colW[2]),
            cell(d.arrPm, colW[3]),
            cell(d.depPm, colW[4]),
            cell(d.hours, colW[5]),
            cell(d.min, colW[6]),
          ],
        })
      );
    });

    rows.push(
      new TableRow({
        height: { value: ROW_TOTAL, rule: HeightRule.EXACT },
        children: [
          cell('Total', colW[0] + colW[1] + colW[2] + colW[3] + colW[4], {
            bold: true,
            colSpan: 5,
            align: AlignmentType.RIGHT,
            size: 13,
          }),
          cell(staffRecord.totalHours ? String(staffRecord.totalHours) : '', colW[5], { bold: true }),
          cell(staffRecord.totalMins ? String(staffRecord.totalMins) : '', colW[6], { bold: true }),
        ],
      })
    );

    return new Table({
      width: { size: innerW, type: WidthType.DXA },
      columnWidths: colW,
      layout: TableLayoutType.FIXED,
      rows,
    });
  };

  const buildSlip = (staff: string, staffRecord: typeof leftData) => {
    const nameIndent = innerW * 0.1; // preview: name line = 80% width
    const sigIndent = Math.max(0, (innerW - 3120) / 2); // preview: w-52 = 208px

    return [
      // "CS Form 48" (left) + "DAILY TIME RECORD" (centered) on the same line
      para({
        runs: [
          new TextRun({ text: 'CS Form 48', font: FONT, size: 14, italics: true }),
          new TextRun({ text: '\t', font: FONT, size: 18 }),
          new TextRun({ text: 'DAILY TIME RECORD', font: FONT, size: 18, bold: true, characterSpacing: 10 }),
        ],
        line: H.title,
        after: H.titleAfter,
        tabCenter: innerW / 2,
      }),
      // Name, line below it, "(Name)" below the line
      para({
        text: (staff || 'STAFF MEMBER').toUpperCase(),
        size: 18,
        bold: true,
        align: AlignmentType.CENTER,
        line: H.name,
        after: H.nameAfter,
        indentLeft: nameIndent,
        indentRight: nameIndent,
        bottomBorder: true,
      }),
      para({
        text: '(Name)',
        size: 13,
        italics: true,
        align: AlignmentType.CENTER,
        line: H.nameLabel,
        after: H.nameLabelAfter,
      }),
      buildMetaTable(),
      para({ text: '', size: 2, line: H.metaAfter }),
      buildDtrTable(staffRecord),
      // Flexible gap (preview: mt-auto)
      para({ text: '', size: 2, line: flexSpacer }),
      para({
        text: 'I certify on my honor that the above is true and correct record of the hours of work performed, record of which was made daily at the time of arrival and departure from the office.',
        size: 13,
        align: AlignmentType.JUSTIFIED,
        line: H.certLine,
      }),
      // Employee signature line + "(Signature)"
      para({
        text: '',
        size: 13,
        line: H.sigLine,
        before: H.sigBefore,
        indentLeft: sigIndent,
        indentRight: sigIndent,
        bottomBorder: true,
      }),
      para({
        text: '(Signature)',
        size: 13,
        italics: true,
        align: AlignmentType.CENTER,
        line: H.sigLabel,
        after: H.sigLabelAfter,
      }),
      para({
        text: 'Verified as to the prescribed office hours:',
        size: 13,
        line: H.verified,
        after: H.verifiedAfter,
      }),
      // In-charge name, line below it, title below the line
      para({
        text: (data.inChargeName || '').toUpperCase(),
        size: 16,
        bold: true,
        align: AlignmentType.CENTER,
        line: H.inCharge,
        indentLeft: sigIndent,
        indentRight: sigIndent,
        bottomBorder: true,
      }),
      para({
        text: `(${data.inChargeTitle || 'School Principal'})`,
        size: 13,
        italics: true,
        align: AlignmentType.CENTER,
        line: H.inChargeLabel,
      }),
    ];
  };

  const slipCell = (children: (Paragraph | Table)[]) =>
    new TableCell({
      borders: ALL_LINES,
      width: { size: slipW, type: WidthType.DXA },
      margins: { top: SLIP_PAD, bottom: SLIP_PAD, left: SLIP_PAD, right: SLIP_PAD },
      children,
    });

  const gapCell = (dashedRight: boolean) =>
    new TableCell({
      borders: {
        ...NO_LINES,
        right: dashedRight ? { style: BorderStyle.DASHED, size: 4, color: '94A3B8' } : NONE,
      },
      width: { size: GAP_HALF, type: WidthType.DXA },
      children: [para({ text: '', size: 2, line: 20 })],
    });

  // Two CS Form 48 copies side-by-side with a dashed cut line between them
  const mainLayoutTable = new Table({
    width: { size: contentW, type: WidthType.DXA },
    columnWidths: [slipW, GAP_HALF, GAP_HALF, slipW],
    layout: TableLayoutType.FIXED,
    borders: { ...NO_LINES, insideHorizontal: NONE, insideVertical: NONE },
    rows: [
      new TableRow({
        height: { value: slipH, rule: HeightRule.EXACT },
        cantSplit: true,
        children: [
          slipCell(buildSlip(data.staffName, leftData)),
          gapCell(true),
          gapCell(false),
          slipCell(buildSlip(staffRight, rightData)),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN, header: 0, footer: 0 },
            size: {
              width: page.w,
              height: page.h,
              orientation: PageOrientation.PORTRAIT,
            },
          },
        },
        // Tiny trailing paragraph (Word requires one after a table) so it never creates a 2nd page
        children: [mainLayoutTable, para({ text: '', size: 2, line: 20 })],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CS_Form_48_DTR_${data.staffName.replace(/\s+/g, '_')}_${data.monthKey}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
