import { jsPDF } from 'jspdf';
import type { ScoreExportData } from './scoreExportService';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';

export const exportScoresToPdf = async (
  data: ScoreExportData,
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
  const isMonthly = totalDayCols > 5;

  const marginX = isMonthly ? 36 : 48; // 0.5 in vs 0.67 in
  const marginTop = isMonthly ? 48 : 56; // 0.67 in vs 0.78 in
  const marginBottom = isMonthly ? 36 : 46;
  const availWidth = pageWidth - marginX * 2;

  // Table Column Widths proportioned for DepEd academic scores
  let indexColW: number;
  let nameColW: number;
  let totalColW: number;
  let dayColW: number;

  if (totalDayCols <= 1) {
    indexColW = 28;
    nameColW = Math.floor(availWidth * 0.44);
    dayColW = Math.floor(availWidth * 0.22);
    totalColW = availWidth - indexColW - nameColW - dayColW;
  } else if (totalDayCols <= 5) {
    indexColW = 24;
    nameColW = Math.floor(availWidth * 0.36);
    totalColW = Math.floor(availWidth * 0.20);
    const remDays = availWidth - indexColW - nameColW - totalColW;
    dayColW = Math.floor(remDays / totalDayCols);
    totalColW = availWidth - indexColW - nameColW - dayColW * totalDayCols;
  } else {
    // Monthly (20-22 days)
    indexColW = 18;
    nameColW = Math.floor(availWidth * 0.26);
    totalColW = Math.floor(availWidth * 0.12);
    const remDays = availWidth - indexColW - nameColW - totalColW;
    dayColW = remDays / totalDayCols;
  }

  const headerFontSize = isMonthly ? 8 : 9;
  const studentFontSize = isMonthly ? 8 : 9.5;
  const scoreFontSize = isMonthly ? 8.5 : 10;
  const rowHeight = isMonthly ? 19 : 24;
  const headRow1Height = 20;
  const headRow2Height = 18;
  const headRow3Height = 16;
  const totalHeaderHeight = isDaily ? headRow1Height + headRow2Height : headRow1Height + headRow2Height + headRow3Height;

  // Helper: Render Document Header (DepEd & School Logos, Letterhead, Titles, Period Row)
  const renderDocumentHeader = (startY: number): number => {
    let curY = startY;

    // 1. Logos & Letterhead
    const logoSize = 54;
    const textBlockTop = curY;

    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    const schoolNameText = (data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL').toUpperCase();
    const schoolNameWidth = pdf.getTextWidth(schoolNameText);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105); // #475569
    pdf.text((data.division || 'DIVISION OF MASBATE').toUpperCase(), pageWidth / 2, curY + 10, { align: 'center' });
    pdf.text((data.district || 'PALANAS NORTH DISTRICT').toUpperCase(), pageWidth / 2, curY + 22, { align: 'center' });

    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42); // #0F172A
    pdf.text(schoolNameText, pageWidth / 2, curY + 36, { align: 'center' });

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139); // #64748B
    pdf.text(data.schoolAddress || 'Sta. Cruz, Palanas, Masbate', pageWidth / 2, curY + 48, { align: 'center' });

    // Logos flanking school letterhead with clean spacing
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

    curY += 56;

    // 2. Document Title & Grade Section & Task Title
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text((data.subjectTitle || 'ARAL PROGRAM SCORE SHEET').toUpperCase(), pageWidth / 2, curY + 12, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85); // #334155
    pdf.text((data.gradeSection || 'GRADE 8-MANGO').toUpperCase(), pageWidth / 2, curY + 25, { align: 'center' });

    if (data.taskTitle) {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text(data.taskTitle.toUpperCase(), pageWidth / 2, curY + 37, { align: 'center' });
      curY += 46;
    } else {
      curY += 38;
    }

    // 3. Period Meta Line (WEEK: on left, DATE: on right with balanced underlines)
    const metaY = curY + 8;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);

    // Left: WEEK:  _1_
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

    // Right: DATE:  _MM/DD/YYYY_
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

    curY += 28;
    return curY;
  };

  // Helper: Render Table Header
  const renderTableHeaders = (tableTopY: number): void => {
    pdf.setDrawColor(30, 41, 59); // #1E293B border
    pdf.setLineWidth(0.5);

    if (isDaily) {
      // Daily mode: 2 Header Rows (Date -> Entry numbers 1, 2, ...)
      // 1. # Column (Full height)
      pdf.setFillColor(248, 250, 252);
      pdf.rect(marginX, tableTopY, indexColW, totalHeaderHeight, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setFontSize(headerFontSize);
      pdf.setTextColor(15, 23, 42);
      pdf.text('#', marginX + indexColW / 2, tableTopY + totalHeaderHeight / 2 + 3.5, { align: 'center' });

      // 2. NAME OF THE STUDENTS (Full height)
      const nameX = marginX + indexColW;
      pdf.rect(nameX, tableTopY, nameColW, totalHeaderHeight, 'FD');
      pdf.text('NAME OF THE STUDENTS', nameX + nameColW / 2, tableTopY + totalHeaderHeight / 2 + 3.5, { align: 'center' });

      // 3. Date Header (Row 1, spanning all entry cols)
      const dayTotalW = dayColW * totalDayCols;
      const dayStartX = nameX + nameColW;
      pdf.rect(dayStartX, tableTopY, dayTotalW, headRow1Height, 'FD');
      pdf.text(data.weeks?.[0]?.label || 'DATE', dayStartX + dayTotalW / 2, tableTopY + headRow1Height / 2 + 3, { align: 'center' });

      // 4. TOTAL SCORE (Full height)
      const totalColX = dayStartX + dayTotalW;
      pdf.rect(totalColX, tableTopY, totalColW, totalHeaderHeight, 'FD');
      pdf.text('TOTAL SCORE', totalColX + totalColW / 2, tableTopY + totalHeaderHeight / 2 + 3.5, { align: 'center' });

      // 5. Entry numbers on Row 2
      const row2Y = tableTopY + headRow1Height;
      let curEntryX = dayStartX;
      allEntryCols.forEach((col) => {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(curEntryX, row2Y, dayColW, headRow2Height, 'FD');
        pdf.setFont('times', 'bold');
        pdf.setFontSize(headerFontSize);
        pdf.setTextColor(15, 23, 42);
        pdf.text(col.entryLabel, curEntryX + dayColW / 2, row2Y + headRow2Height / 2 + 3, { align: 'center' });
        curEntryX += dayColW;
      });
    } else {
      // Multi-day / Multi-week mode: 3 Header Rows
      // 1. # Column (Full height)
      pdf.setFillColor(248, 250, 252);
      pdf.rect(marginX, tableTopY, indexColW, totalHeaderHeight, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setFontSize(headerFontSize);
      pdf.setTextColor(15, 23, 42);
      pdf.text('#', marginX + indexColW / 2, tableTopY + totalHeaderHeight / 2 + 3.5, { align: 'center' });

      // 2. NAME OF THE STUDENTS (Full height)
      const nameX = marginX + indexColW;
      pdf.rect(nameX, tableTopY, nameColW, totalHeaderHeight, 'FD');
      pdf.text('NAME OF THE STUDENTS', nameX + nameColW / 2, tableTopY + totalHeaderHeight / 2 + 3.5, { align: 'center' });

      // 3. Week Date Ranges (Top Row)
      let curWeekX = nameX + nameColW;
      (data.weeks || []).forEach((week) => {
        const weekColsCount = week.days.reduce((sum, d) => sum + (d.entries?.length || 1), 0);
        const weekColW = dayColW * weekColsCount;
        pdf.rect(curWeekX, tableTopY, weekColW, headRow1Height, 'FD');
        pdf.setFont('times', 'bold');
        pdf.setFontSize(isMonthly ? 7.5 : 8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(week.label, curWeekX + weekColW / 2, tableTopY + headRow1Height / 2 + 3, { align: 'center' });
        curWeekX += weekColW;
      });

      // 4. TOTAL SCORE (Full height)
      pdf.rect(curWeekX, tableTopY, totalColW, totalHeaderHeight, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setFontSize(headerFontSize);
      pdf.setTextColor(15, 23, 42);
      pdf.text('TOTAL SCORE', curWeekX + totalColW / 2, tableTopY + totalHeaderHeight / 2 + 3.5, { align: 'center' });

      // 5. Day Numbers (Row 2)
      const row2Y = tableTopY + headRow1Height;
      let curDayX = nameX + nameColW;
      (data.weeks || []).forEach((week) => {
        week.days.forEach((day) => {
          const dayEntriesCount = day.entries?.length || 1;
          const dayColSpanW = dayColW * dayEntriesCount;
          pdf.setFillColor(255, 255, 255);
          pdf.rect(curDayX, row2Y, dayColSpanW, headRow2Height, 'FD');
          pdf.setFont('times', 'bold');
          pdf.setFontSize(isMonthly ? 7.5 : 9);
          pdf.setTextColor(15, 23, 42);
          pdf.text(String(day.dayNum), curDayX + dayColSpanW / 2, row2Y + headRow2Height / 2 + 3, { align: 'center' });
          curDayX += dayColSpanW;
        });
      });

      // 6. Entry Numbers (Row 3)
      const row3Y = row2Y + headRow2Height;
      let curEntryX = nameX + nameColW;
      allEntryCols.forEach((col) => {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(curEntryX, row3Y, dayColW, headRow3Height, 'FD');
        pdf.setFont('times', 'bold');
        pdf.setFontSize(isMonthly ? 7 : 8);
        pdf.setTextColor(15, 23, 42);
        pdf.text(col.entryLabel, curEntryX + dayColW / 2, row3Y + headRow3Height / 2 + 2.5, { align: 'center' });
        curEntryX += dayColW;
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
    const tutorName = (data.tutorName || 'TUTOR FULL NAME').toUpperCase();
    pdf.text(tutorName, prepX + colW / 2, curY, { align: 'center' });

    pdf.setLineWidth(0.8);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(prepX, curY + 2, prepX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.tutorTitle || 'Learning Camp Volunteer', prepX + colW / 2, curY + 12, { align: 'center' });

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
    const ntdName = (data.notedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase();
    pdf.text(ntdName, notedX + colW / 2, curY, { align: 'center' });
    pdf.line(notedX, curY + 2, notedX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.notedTitle || 'Principal I', notedX + colW / 2, curY + 12, { align: 'center' });
  };

  // Build Document
  let currentY = renderDocumentHeader(marginTop);
  renderTableHeaders(currentY);
  currentY += totalHeaderHeight;

  const totalStudents = data.students.length;
  const signatureBlockGap = 36;
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

    // 1. White background
    pdf.setFillColor(255, 255, 255);
    pdf.rect(marginX, rowY, availWidth, rowHeight, 'F');

    // 2. Borders
    pdf.setDrawColor(30, 41, 59);
    pdf.setLineWidth(0.5);

    // Index #
    pdf.rect(marginX, rowY, indexColW, rowHeight, 'S');
    pdf.setFont('times', 'normal');
    pdf.setFontSize(studentFontSize);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(sIdx + 1), marginX + indexColW / 2, rowY + rowHeight / 2 + 3, { align: 'center' });

    // Student Name (left-aligned)
    const nameX = marginX + indexColW;
    pdf.rect(nameX, rowY, nameColW, rowHeight, 'S');
    pdf.setFont('times', 'bold');
    pdf.setFontSize(studentFontSize);
    pdf.setTextColor(15, 23, 42);
    const cleanName = (student.name || '').toUpperCase();
    pdf.text(cleanName, nameX + 6, rowY + rowHeight / 2 + 3, { maxWidth: nameColW - 12 });

    // Day Scores
    let currentScoreX = nameX + nameColW;
    allEntryCols.forEach((_, dIdx) => {
      pdf.rect(currentScoreX, rowY, dayColW, rowHeight, 'S');
      const scoreVal = student.scores?.[dIdx] !== undefined && student.scores?.[dIdx] !== '' ? String(student.scores[dIdx]) : '';
      if (scoreVal) {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(scoreFontSize);
        pdf.setTextColor(15, 23, 42);
        pdf.text(scoreVal, currentScoreX + dayColW / 2, rowY + rowHeight / 2 + 3, { align: 'center' });
      }
      currentScoreX += dayColW;
    });

    // Total Score
    pdf.rect(currentScoreX, rowY, totalColW, rowHeight, 'S');
    const totalVal = student.totalScore !== undefined && student.totalScore !== '' ? String(student.totalScore) : '';
    if (totalVal) {
      pdf.setFont('times', 'bold');
      pdf.setFontSize(scoreFontSize);
      pdf.setTextColor(15, 23, 42);
      pdf.text(totalVal, currentScoreX + totalColW / 2, rowY + rowHeight / 2 + 3, { align: 'center' });
    }

    currentY += rowHeight;
  });

  // Render Signatures below table
  currentY += signatureBlockGap;
  if (currentY + 110 > pageHeight - marginBottom) {
    pdf.addPage(pageFormat, 'portrait');
    currentY = marginTop + 20;
  }
  renderSignatures(currentY);

  // Generate Filename & Save
  const cleanSection = (data.gradeSection || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanWeek = `Week_${data.weekNumber || '1'}`;
  const defaultFilename = `ARALert_ScoreSheet_${cleanSection}_${cleanWeek}_${paper.toUpperCase()}.pdf`;
  const finalFilename = customFilename || defaultFilename;

  pdf.save(finalFilename);
};
