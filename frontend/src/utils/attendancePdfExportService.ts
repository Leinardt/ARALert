import { jsPDF } from 'jspdf';
import type { AttendanceExportData } from './attendanceExportService';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';

export const exportAttendanceToPdf = async (
  data: AttendanceExportData,
  customFilename?: string
): Promise<void> => {
  const paper = data.paperSize || 'letter';
  let pageWidth = 612; // 8.5 in (Letter & Folio width)
  let pageHeight = 792; // 11 in (Letter height)
  let pageFormat: string | [number, number] = 'letter';

  if (paper === 'a4') {
    pageWidth = 595.28;
    pageHeight = 841.89;
    pageFormat = 'a4';
  } else if (paper === 'folio') {
    pageWidth = 612;
    pageHeight = 936;
    pageFormat = [612, 936];
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: pageFormat,
  });

  const allDays = data.weeks.flatMap((w) => w.days);
  const totalDayCols = allDays.length;
  const isMonthly = totalDayCols > 5;

  // Margins matching DOCX & Excel - lowered top margin so header is not too high up
  const marginX = isMonthly ? 36 : 48; // 0.5 in vs 0.67 in
  const marginTop = isMonthly ? 48 : 60; // 0.67 in vs 0.83 in (formal top margin)
  const marginBottom = isMonthly ? 36 : 46;
  const availWidth = pageWidth - marginX * 2;

  // Table Column Widths matching DOCX exact proportions
  let indexColW: number;
  let nameColW: number;
  let sigColW: number;
  let dayColW: number;

  if (totalDayCols <= 1) {
    indexColW = 28;
    nameColW = Math.floor(availWidth * 0.44);
    dayColW = Math.floor(availWidth * 0.22);
    sigColW = availWidth - indexColW - nameColW - dayColW;
  } else if (totalDayCols <= 5) {
    indexColW = 24;
    nameColW = Math.floor(availWidth * 0.36);
    sigColW = Math.floor(availWidth * 0.20);
    const remDays = availWidth - indexColW - nameColW - sigColW;
    dayColW = Math.floor(remDays / totalDayCols);
    sigColW = availWidth - indexColW - nameColW - dayColW * totalDayCols;
  } else {
    // Monthly (20-22 days)
    indexColW = 18;
    nameColW = Math.floor(availWidth * 0.26);
    sigColW = Math.floor(availWidth * 0.12);
    const remDays = availWidth - indexColW - nameColW - sigColW;
    dayColW = remDays / totalDayCols;
  }

  // Generous row heights & font sizes matching formal academic tables (not compact)
  const headerFontSize = isMonthly ? 8 : 9;
  const studentFontSize = isMonthly ? 8 : 9.5;
  const markFontSize = isMonthly ? 8.5 : 10.5;
  const rowHeight = isMonthly ? 19 : 24; // 24pt gives generous ~7.25pt padding above & below each row
  const headRow1Height = totalDayCols <= 1 ? 32 : 24;
  const headRow2Height = 19;
  const totalHeaderHeight = totalDayCols <= 1 ? headRow1Height : headRow1Height + headRow2Height;

  // Helper: Render Header (Logos, Letterhead, Titles, Meta Row)
  const renderDocumentHeader = (startY: number): number => {
    let curY = startY;

    // 1. Logos & Letterhead
    const logoSize = 54; // 54×54 pt crisp vector presentation
    const textBlockTop = curY;

    // Measure exact school name width using the exact font and size (Times bold 11pt)
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    const schoolNameText = data.schoolName.toUpperCase();
    const schoolNameWidth = pdf.getTextWidth(schoolNameText);

    // School Letterhead Text Lines
    pdf.setFont('times', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105); // #475569
    pdf.text(data.division.toUpperCase(), pageWidth / 2, curY + 10, { align: 'center' });

    pdf.text(data.district.toUpperCase(), pageWidth / 2, curY + 22, { align: 'center' });

    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42); // #0F172A
    pdf.text(schoolNameText, pageWidth / 2, curY + 36, { align: 'center' });

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139); // #64748B
    pdf.text(data.schoolAddress, pageWidth / 2, curY + 48, { align: 'center' });

    // Logos flanking the school letterhead with a clean 26pt gap (ZERO overlap with PALANAS or SCHOOL)
    const logoGap = 26;
    const leftLogoX = pageWidth / 2 - schoolNameWidth / 2 - logoGap - logoSize;
    const rightLogoX = pageWidth / 2 + schoolNameWidth / 2 + logoGap;
    const logoY = textBlockTop + (50 - logoSize) / 2;

    try {
      if (DEPED_LOGO_BASE64) {
        pdf.addImage(DEPED_LOGO_BASE64, 'PNG', leftLogoX, logoY, logoSize, logoSize);
      }
    } catch (e) {
      console.warn('Could not add DepEd logo to PDF:', e);
    }

    try {
      if (PNAHS_LOGO_BASE64) {
        pdf.addImage(PNAHS_LOGO_BASE64, 'PNG', rightLogoX, logoY, logoSize, logoSize);
      }
    } catch (e) {
      console.warn('Could not add PNAHS logo to PDF:', e);
    }

    curY += 58;

    // 2. Document Title & Grade Section
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(data.subjectTitle.toUpperCase(), pageWidth / 2, curY + 12, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85); // #334155
    pdf.text(data.gradeSection.toUpperCase(), pageWidth / 2, curY + 26, { align: 'center' });

    // Generous space between Header titles and the WEEK & DATE row (increased to 54)
    curY += 54;

    // 3. Period Meta Line (WEEK on left, DATE on right with balanced underline)
    const metaY = curY + 8;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);

    // Left: WEEK:  _2_
    pdf.text('WEEK:  ', marginX, metaY);
    const weekLabelW = pdf.getTextWidth('WEEK:  ');
    const weekVal = data.weekNumber || '1';
    const weekValW = pdf.getTextWidth(weekVal);
    const weekLineStart = marginX + weekLabelW;
    const weekPad = 12;
    const weekValX = weekLineStart + weekPad;
    const weekLineEnd = weekValX + weekValW + weekPad;

    pdf.text(weekVal, weekValX, metaY);
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.8);
    pdf.line(weekLineStart, metaY + 2, weekLineEnd, metaY + 2);

    // Right: DATE:  _09/07/2026 - 09/11/2026_
    const dateVal = data.dateStr || '_______';
    const dateLabelW = pdf.getTextWidth('DATE:  ');
    const dateValW = pdf.getTextWidth(dateVal);
    const datePad = 12;
    const totalDateBlockW = dateLabelW + dateValW + datePad * 2;
    const dateStartBlockX = pageWidth - marginX - totalDateBlockW;

    pdf.text('DATE:  ', dateStartBlockX, metaY);
    const dateValX = dateStartBlockX + dateLabelW + datePad;
    pdf.text(dateVal, dateValX, metaY);
    pdf.line(dateStartBlockX + dateLabelW, metaY + 2, dateValX + dateValW + datePad, metaY + 2);

    // Comfortable space between WEEK & DATE and the attendance table (increased to 30)
    curY += 30;
    return curY;
  };

  // Helper: Render Table Headers
  const renderTableHeaders = (tableTopY: number): void => {
    pdf.setDrawColor(30, 41, 59); // #1E293B border
    pdf.setLineWidth(0.5);

    if (totalDayCols <= 1) {
      // Single-day header
      let colX = marginX;
      const cols = [
        { label: '#', w: indexColW, align: 'center' },
        { label: 'NAME OF THE STUDENTS', w: nameColW, align: 'center' },
        { label: data.weeks[0]?.label || 'DATE', w: dayColW, align: 'center' },
        { label: 'SIGNATURE', w: sigColW, align: 'center' },
      ];

      cols.forEach((col) => {
        pdf.setFillColor(248, 250, 252); // #F8FAFC
        pdf.rect(colX, tableTopY, col.w, headRow1Height, 'FD');
        pdf.setFont('times', 'bold');
        pdf.setFontSize(headerFontSize);
        pdf.setTextColor(15, 23, 42);
        const textX = colX + col.w / 2;
        pdf.text(col.label, textX, tableTopY + headRow1Height / 2 + 3, { align: 'center' });
        colX += col.w;
      });
    } else {
      // Multi-day Header Row 1: Explicit fill before EVERY rect
      // # (Spans 2 rows) - Centered
      pdf.setFillColor(248, 250, 252);
      pdf.rect(marginX, tableTopY, indexColW, totalHeaderHeight, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setFontSize(headerFontSize);
      pdf.setTextColor(15, 23, 42);
      pdf.text('#', marginX + indexColW / 2, tableTopY + totalHeaderHeight / 2 + 3, { align: 'center' });

      // NAME OF THE STUDENTS (Spans 2 rows) - Centered
      const nameX = marginX + indexColW;
      pdf.setFillColor(248, 250, 252);
      pdf.rect(nameX, tableTopY, nameColW, totalHeaderHeight, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setFontSize(headerFontSize);
      pdf.setTextColor(15, 23, 42);
      pdf.text('NAME OF THE STUDENTS', nameX + nameColW / 2, tableTopY + totalHeaderHeight / 2 + 3, { align: 'center' });

      // Week Ranges
      let weekX = nameX + nameColW;
      data.weeks.forEach((week) => {
        const spanW = dayColW * week.days.length;
        pdf.setFillColor(248, 250, 252);
        pdf.rect(weekX, tableTopY, spanW, headRow1Height, 'FD');
        pdf.setFont('times', 'bold');
        pdf.setFontSize(isMonthly ? 7.5 : 8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(week.label, weekX + spanW / 2, tableTopY + headRow1Height / 2 + 3, { align: 'center' });
        weekX += spanW;
      });

      // SIGNATURE (Spans 2 rows) - Centered
      const sigX = marginX + availWidth - sigColW;
      pdf.setFillColor(248, 250, 252);
      pdf.rect(sigX, tableTopY, sigColW, totalHeaderHeight, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setFontSize(headerFontSize);
      pdf.setTextColor(15, 23, 42);
      pdf.text('SIGNATURE', sigX + sigColW / 2, tableTopY + totalHeaderHeight / 2 + 3, { align: 'center' });

      // Multi-day Header Row 2: Day Numbers
      const row2Y = tableTopY + headRow1Height;
      let dayX = nameX + nameColW;
      allDays.forEach((day) => {
        pdf.setFillColor(255, 255, 255); // White background
        pdf.rect(dayX, row2Y, dayColW, headRow2Height, 'FD');
        pdf.setFont('times', 'bold');
        pdf.setFontSize(headerFontSize);
        pdf.setTextColor(15, 23, 42);
        pdf.text(String(day.dayNum), dayX + dayColW / 2, row2Y + headRow2Height / 2 + 3, { align: 'center' });
        dayX += dayColW;
      });
    }
  };

  // Helper: Render Signatures Block
  const renderSignatures = (sigStartY: number): void => {
    let curY = sigStartY;
    const colW = 155;

    // Prepared by (Right Aligned)
    const prepX = pageWidth - marginX - colW;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Prepared by:', prepX, curY);

    curY += 26;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    const tutorName = (data.tutorName || 'NYAN JEAN Q. ALCOVINDAS').toUpperCase();
    pdf.text(tutorName, prepX + colW / 2, curY, { align: 'center' });

    pdf.setLineWidth(0.8);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(prepX, curY + 2, prepX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.tutorTitle || 'ARAL TUTOR', prepX + colW / 2, curY + 12, { align: 'center' });

    // Checked by & Noted by Row
    curY += 28;
    const checkedX = marginX;
    const notedX = pageWidth - marginX - colW;

    // Checked
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Checked:', checkedX, curY);

    // Noted
    pdf.text('Noted:', notedX, curY);

    curY += 26;

    // Checked Name
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    const chkName = (data.checkedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase();
    pdf.text(chkName, checkedX + colW / 2, curY, { align: 'center' });
    pdf.line(checkedX, curY + 2, checkedX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.checkedTitle || 'HT/Asst. to the Principal', checkedX + colW / 2, curY + 12, { align: 'center' });

    // Noted Name
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    const ntdName = (data.notedName || 'ANDY TONAMANAKO').toUpperCase();
    pdf.text(ntdName, notedX + colW / 2, curY, { align: 'center' });
    pdf.line(ntdName ? notedX : notedX, curY + 2, notedX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.notedTitle || 'Principal I', notedX + colW / 2, curY + 12, { align: 'center' });
  };

  // Build Document
  let currentY = renderDocumentHeader(marginTop);
  renderTableHeaders(currentY);
  currentY += totalHeaderHeight;

  // Render Student Rows
  const totalStudents = data.students.length;
  const signatureBlockGap = 42; // Generous space above PREPARED BY
  const signaturesRequiredHeight = 110 + signatureBlockGap;

  data.students.forEach((student, sIdx) => {
    // Check if new page is needed
    if (currentY + rowHeight > pageHeight - marginBottom - (sIdx === totalStudents - 1 ? signaturesRequiredHeight : 20)) {
      pdf.addPage(pageFormat, 'portrait');
      currentY = marginTop;
      renderTableHeaders(currentY);
      currentY += totalHeaderHeight;
    }

    const rowY = currentY;

    // 1. Fill entire row background with pure WHITE (prevents any dark cell fill)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(marginX, rowY, availWidth, rowHeight, 'F');

    // 2. Draw cell borders with clean single stroke
    pdf.setDrawColor(30, 41, 59);
    pdf.setLineWidth(0.5);

    // Index #
    pdf.rect(marginX, rowY, indexColW, rowHeight, 'S');
    pdf.setFont('times', 'normal');
    pdf.setFontSize(studentFontSize);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(sIdx + 1), marginX + indexColW / 2, rowY + rowHeight / 2 + 3.5, { align: 'center' });

    // Student Name (left-aligned with 5pt margin)
    const nameX = marginX + indexColW;
    pdf.rect(nameX, rowY, nameColW, rowHeight, 'S');
    pdf.setFont('times', 'bold');
    pdf.setFontSize(studentFontSize);
    pdf.setTextColor(15, 23, 42);
    const cleanName = (student.name || '').toUpperCase();
    pdf.text(cleanName, nameX + 5, rowY + rowHeight / 2 + 3.5, { maxWidth: nameColW - 10 });

    // Days / Marks
    let dayX = nameX + nameColW;
    allDays.forEach((day) => {
      pdf.rect(dayX, rowY, dayColW, rowHeight, 'S');
      const status = student.statusByDate?.[day.dateKey];

      if (status === 'P') {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(markFontSize);
        pdf.setTextColor(4, 120, 87); // #047857 Emerald Green
        pdf.text('/', dayX + dayColW / 2, rowY + rowHeight / 2 + 3.5, { align: 'center' });
      } else if (status === 'L') {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(markFontSize);
        pdf.setTextColor(180, 83, 9); // #B45309 Amber
        pdf.text('/', dayX + dayColW / 2, rowY + rowHeight / 2 + 3.5, { align: 'center' });
      } else if (status === 'A') {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(markFontSize);
        pdf.setTextColor(190, 18, 60); // #BE123C Rose Red
        pdf.text('X', dayX + dayColW / 2, rowY + rowHeight / 2 + 3.5, { align: 'center' });
      }
      dayX += dayColW;
    });

    // Signature
    const sigX = marginX + availWidth - sigColW;
    pdf.rect(sigX, rowY, sigColW, rowHeight, 'S');

    currentY += rowHeight;
  });

  // Render Signatures below table with generous space above PREPARED BY
  currentY += signatureBlockGap;
  if (currentY + 110 > pageHeight - marginBottom) {
    pdf.addPage(pageFormat, 'portrait');
    currentY = marginTop + 20;
  }
  renderSignatures(currentY);

  // Generate Filename & Save
  const cleanSection = (data.gradeSection || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanWeek = totalDayCols <= 1
    ? `Day_${allDays[0]?.dateKey || 'today'}`
    : isMonthly
      ? `Month_${allDays[0]?.dateKey?.slice(0, 7) || 'current'}`
      : `Week_${data.weekNumber || '1'}`;
  const defaultFilename = `ARALert_Attendance_${cleanSection}_${cleanWeek}_${paper.toUpperCase()}.pdf`;
  const finalFilename = customFilename || defaultFilename;

  pdf.save(finalFilename);
};
