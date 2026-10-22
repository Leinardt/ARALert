import { jsPDF } from 'jspdf';
import { formatSessionDateHeader, buildScoreFilename, type ScoreExportData } from './scoreExportService';
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
  const isMonthly = totalDayCols > 5;
  const totalStudents = Math.max(data.students.length, 1);

  // Adaptive density scaling based on both student count and selected paper height
  const rawBudgetPerStudent = (pageHeight - (data.taskTitle ? 260 : 250)) / totalStudents;
  const isDense = rawBudgetPerStudent < 13.5;
  const isCompact = rawBudgetPerStudent >= 13.5 && rawBudgetPerStudent < 17;
  const isMedium = rawBudgetPerStudent >= 17 && rawBudgetPerStudent < 22;

  // Optimized margins with comfortable top gap above header, scaled for 1-page fit
  const marginX = isMonthly ? 32 : 40;
  const marginTop = isDense ? 18 : isCompact ? 22 : isMedium ? 28 : isMonthly ? 36 : 42;
  const marginBottom = isDense ? 12 : isCompact ? 14 : isMedium ? 16 : isMonthly ? 20 : 22;
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

  // Header row height (Single row: Session Dates)
  const totalHeaderHeight = isDense ? 14 : isCompact ? 16 : 18;

  // Signatures vertical budget (scaled to keep 1-page fit while preserving physical signing room)
  const signatureBlockGap = isDense ? 8 : isCompact ? 12 : isMedium ? 16 : 22;
  const sigSignSpace = isDense ? 12 : isCompact ? 15 : isMedium ? 19 : 24;
  const sigNameOffset = isDense ? 8.5 : 10;
  const sigRoleOffset = isDense ? 16 : 18.5;
  const sigMidGap = isDense ? 24 : isCompact ? 28 : isMedium ? 32 : 36;
  const signaturesBodyHeight = sigSignSpace + sigMidGap + sigSignSpace + sigRoleOffset + 2;
  const signaturesRequiredHeight = signatureBlockGap + signaturesBodyHeight;

  // Helper to dynamically auto-fit centered text within available cell width
  const renderCenteredFitText = (
    text: string,
    x: number,
    y: number,
    maxW: number,
    initialSize: number,
    minSize = 4.5
  ): void => {
    let size = initialSize;
    pdf.setFontSize(size);
    while (pdf.getTextWidth(text) > maxW && size > minSize) {
      size -= 0.25;
      pdf.setFontSize(size);
    }
    pdf.text(text, x, y, { align: 'center' });
  };

  // Helper: Render Document Header (DepEd & School Logos, Letterhead, Titles, Period Row)
  const renderDocumentHeader = (startY: number): number => {
    let curY = startY;

    // 1. Logos & Letterhead
    const logoSize = isDense || isCompact ? 36 : 40;
    const textBlockTop = curY;

    pdf.setFont('times', 'bold');
    pdf.setFontSize(10.5);
    const schoolNameText = (data.schoolName || 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL').toUpperCase();
    const schoolNameWidth = pdf.getTextWidth(schoolNameText);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105); // #475569
    pdf.text((data.division || 'DIVISION OF MASBATE').toUpperCase(), pageWidth / 2, curY + 8, { align: 'center' });
    pdf.text((data.district || 'PALANAS NORTH DISTRICT').toUpperCase(), pageWidth / 2, curY + 18, { align: 'center' });

    pdf.setFont('times', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42); // #0F172A
    pdf.text(schoolNameText, pageWidth / 2, curY + 29, { align: 'center' });

    pdf.setFont('times', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139); // #64748B
    pdf.text(data.schoolAddress || 'Sta. Cruz, Palanas, Masbate', pageWidth / 2, curY + 38, { align: 'center' });

    // Logos flanking school letterhead with clean spacing
    const logoGap = 20;
    const leftLogoX = pageWidth / 2 - schoolNameWidth / 2 - logoGap - logoSize;
    const rightLogoX = pageWidth / 2 + schoolNameWidth / 2 + logoGap;
    const logoY = textBlockTop + (40 - logoSize) / 2;

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

    curY += isDense || isCompact ? 42 : 46;

    // 2. Document Title & Grade Section & Task Title
    pdf.setFont('times', 'bold');
    pdf.setFontSize(isDense ? 10 : 11);
    pdf.setTextColor(15, 23, 42);
    pdf.text((data.subjectTitle || 'ARAL PROGRAM SCORE SHEET').toUpperCase(), pageWidth / 2, curY + 9, { align: 'center' });

    pdf.setFontSize(isDense ? 8.5 : 9.5);
    pdf.setTextColor(51, 65, 85); // #334155
    pdf.text((data.gradeSection || 'MIXED (GRADES 7-10)').toUpperCase(), pageWidth / 2, curY + 19, { align: 'center' });

    if (data.taskTitle) {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(isDense ? 8 : 8.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text(data.taskTitle.toUpperCase(), pageWidth / 2, curY + 28, { align: 'center' });
      curY += isDense || isCompact ? 31 : 35;
    } else {
      curY += isDense || isCompact ? 22 : 26;
    }

    // Space gap between header and the week & date section
    curY += isDense ? 8 : isCompact ? 10 : isMedium ? 12 : 16;

    // 3. Period Meta Line (WEEK: on left, DATE: on right with balanced underlines)
    const metaY = curY;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(isDense ? 8.5 : 9);
    pdf.setTextColor(15, 23, 42);

    // Left: WEEK:  _1_
    pdf.text('WEEK:  ', marginX, metaY);
    const weekLabelW = pdf.getTextWidth('WEEK:  ');
    const weekVal = data.weekNumber || '1';
    const weekValW = pdf.getTextWidth(weekVal);
    const weekLineStart = marginX + weekLabelW;
    const weekPad = 10;
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
    const datePad = 10;
    const totalDateBlockW = dateLabelW + dateValW + datePad * 2;
    const dateStartBlockX = pageWidth - marginX - totalDateBlockW;

    pdf.text('DATE:  ', dateStartBlockX, metaY);
    const dateValX = dateStartBlockX + dateLabelW + datePad;
    pdf.text(dateVal, dateValX, metaY);
    pdf.line(dateStartBlockX + dateLabelW, metaY + 2, dateValX + dateValW + datePad, metaY + 2);

    curY += isDense ? 8 : isCompact ? 10 : 14;
    return curY;
  };

  // Render document header first so we know exact remaining vertical budget on page 1
  let currentY = renderDocumentHeader(marginTop);

  // Calculate available vertical space for student rows
  const availTableHeight = pageHeight - currentY - marginBottom - totalHeaderHeight - signaturesRequiredHeight;
  // Adaptive row height capped at 20.5pt for small lists, scaling down smoothly so long lists fit on 1 page
  const rowHeight = Math.min(20.5, Math.max(9.0, availTableHeight / totalStudents));

  // Typography scaled proportionately to rowHeight and paper size to guarantee crisp legibility
  const headerFontSize = isMonthly ? (isDense ? 6.75 : 7.5) : (isDense ? 7.5 : isCompact ? 8 : 8.5);
  const dateHeaderFontSize = dayColW >= 38 ? 7.5 : dayColW >= 28 ? 6.5 : 5.5;
  const studentFontSize =
    rowHeight >= 18 ? 9.5 :
    rowHeight >= 16 ? 9.0 :
    rowHeight >= 14.5 ? 8.5 :
    rowHeight >= 13 ? 8.0 :
    rowHeight >= 11.5 ? 7.5 :
    rowHeight >= 10 ? 7.0 : 6.5;
  const scoreFontSize = studentFontSize;
  const headerBaselineOffset = headerFontSize * 0.32;
  const rowBaselineOffset = studentFontSize * 0.32;

  // Helper: Render Table Header (Single Row: Session Date)
  const renderTableHeaders = (tableTopY: number): void => {
    pdf.setDrawColor(30, 41, 59); // #1E293B border
    pdf.setLineWidth(0.5);

    // 1. # Column (Full height)
    pdf.setFillColor(248, 250, 252);
    pdf.rect(marginX, tableTopY, indexColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    renderCenteredFitText('#', marginX + indexColW / 2, tableTopY + totalHeaderHeight / 2 + headerBaselineOffset, indexColW - 2, headerFontSize, 6.5);

    // 2. NAME OF THE STUDENTS (Full height)
    const nameX = marginX + indexColW;
    pdf.setFillColor(248, 250, 252);
    pdf.rect(nameX, tableTopY, nameColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    renderCenteredFitText('NAME OF THE STUDENTS', nameX + nameColW / 2, tableTopY + totalHeaderHeight / 2 + headerBaselineOffset, nameColW - 6, headerFontSize, 6.5);

    // 3. Session Dates
    let curEntryX = nameX + nameColW;
    allEntryCols.forEach((col) => {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(curEntryX, tableTopY, dayColW, totalHeaderHeight, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setTextColor(15, 23, 42);
      let dateText = formatSessionDateHeader(col.dateKey);
      if (dayColW < 24 && col.dateKey) {
        const parts = col.dateKey.split('-');
        if (parts.length === 3) {
          dateText = `${parts[1]}/${parts[2]}`;
        }
      }
      renderCenteredFitText(dateText, curEntryX + dayColW / 2, tableTopY + totalHeaderHeight / 2 + headerBaselineOffset, dayColW - 2, dateHeaderFontSize, 4.5);
      curEntryX += dayColW;
    });

    // 4. TOTAL SCORE (Full height)
    pdf.setFillColor(248, 250, 252);
    pdf.rect(curEntryX, tableTopY, totalColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    renderCenteredFitText('TOTAL SCORE', curEntryX + totalColW / 2, tableTopY + totalHeaderHeight / 2 + headerBaselineOffset, totalColW - 4, headerFontSize, 6.0);
  };

  // Helper: Render Signatures Block (Order: 1. Signature Line, 2. Fullname below line, 3. Role below fullname)
  const renderSignatures = (sigStartY: number): void => {
    let curY = sigStartY;
    const colW = 165;
    const sigLabelSize = isDense ? 8 : 8.5;
    const sigNameSize = isDense ? 8.5 : 9.25;
    const sigRoleSize = isDense ? 7.5 : 8;

    // Prepared by (Right Aligned)
    const prepX = pageWidth - marginX - colW;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(sigLabelSize);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Prepared by:', prepX, curY);

    // Physical pen signing room down to the signature line
    curY += sigSignSpace;
    pdf.setLineWidth(0.75);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(prepX, curY, prepX + colW, curY);

    // Fullname below the signature line
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    const tutorName = (data.tutorName || 'TUTOR FULL NAME').toUpperCase();
    renderCenteredFitText(tutorName, prepX + colW / 2, curY + sigNameOffset, colW - 4, sigNameSize, 6.5);

    // Role below the fullname
    pdf.setFont('times', 'normal');
    pdf.setFontSize(sigRoleSize);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.tutorTitle || 'ARAL Tutor', prepX + colW / 2, curY + sigRoleOffset, { align: 'center' });

    // Checked by & Noted by Row
    curY += sigMidGap;
    const checkedX = marginX;
    const notedX = pageWidth - marginX - colW;

    // Checked & Noted labels
    pdf.setFont('times', 'italic');
    pdf.setFontSize(sigLabelSize);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Checked:', checkedX, curY);
    pdf.text('Noted:', notedX, curY);

    // Physical pen signing room down to the signature lines
    curY += sigSignSpace;
    pdf.setLineWidth(0.75);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(checkedX, curY, checkedX + colW, curY);
    pdf.line(notedX, curY, notedX + colW, curY);

    // Checked Name below signature line, then Role below name
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    const chkName = (data.checkedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase();
    renderCenteredFitText(chkName, checkedX + colW / 2, curY + sigNameOffset, colW - 4, sigNameSize, 6.5);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(sigRoleSize);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.checkedTitle || 'HT/Asst. to the Principal', checkedX + colW / 2, curY + sigRoleOffset, { align: 'center' });

    // Noted Name below signature line, then Role below name
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    const ntdName = (data.notedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase();
    renderCenteredFitText(ntdName, notedX + colW / 2, curY + sigNameOffset, colW - 4, sigNameSize, 6.5);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(sigRoleSize);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.notedTitle || 'Principal I', notedX + colW / 2, curY + sigRoleOffset, { align: 'center' });
  };

  // Build Document Table
  renderTableHeaders(currentY);
  currentY += totalHeaderHeight;

  data.students.forEach((student, sIdx) => {
    // Only break if genuinely exceeding page boundary (with 1.5pt float tolerance)
    if (currentY + rowHeight > pageHeight - marginBottom - (sIdx === totalStudents - 1 ? signaturesRequiredHeight : 12) + 1.5) {
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
    pdf.text(String(sIdx + 1), marginX + indexColW / 2, rowY + rowHeight / 2 + rowBaselineOffset, { align: 'center' });

    // Student Name (left-aligned)
    const nameX = marginX + indexColW;
    pdf.rect(nameX, rowY, nameColW, rowHeight, 'S');
    pdf.setFont('times', 'bold');
    let sNameSize = studentFontSize;
    pdf.setFontSize(sNameSize);
    pdf.setTextColor(15, 23, 42);
    const cleanName = (student.name || '').toUpperCase();
    while (pdf.getTextWidth(cleanName) > nameColW - 10 && sNameSize > 6.0) {
      sNameSize -= 0.25;
      pdf.setFontSize(sNameSize);
    }
    pdf.text(cleanName, nameX + 5, rowY + rowHeight / 2 + sNameSize * 0.32, { maxWidth: nameColW - 10 });

    // Day Scores
    let currentScoreX = nameX + nameColW;
    allEntryCols.forEach((_, dIdx) => {
      pdf.rect(currentScoreX, rowY, dayColW, rowHeight, 'S');
      const scoreVal = student.scores?.[dIdx] !== undefined && student.scores?.[dIdx] !== '' ? String(student.scores[dIdx]) : '';
      if (scoreVal) {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(scoreFontSize);
        pdf.setTextColor(15, 23, 42);
        pdf.text(scoreVal, currentScoreX + dayColW / 2, rowY + rowHeight / 2 + rowBaselineOffset, { align: 'center' });
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
      pdf.text(totalVal, currentScoreX + totalColW / 2, rowY + rowHeight / 2 + rowBaselineOffset, { align: 'center' });
    }

    currentY += rowHeight;
  });

  // Render Signatures below table
  currentY += signatureBlockGap;
  if (currentY + signaturesBodyHeight > pageHeight - marginBottom + 1.5) {
    pdf.addPage(pageFormat, 'portrait');
    currentY = marginTop + 10;
  }
  renderSignatures(currentY);

  // Generate Filename & Save
  const finalFilename = customFilename || buildScoreFilename(data, 'pdf');

  pdf.save(finalFilename);
};
