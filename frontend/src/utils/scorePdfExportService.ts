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

  // Optimized margins with comfortable top gap above header
  const marginX = isMonthly ? 32 : 40;
  const marginTop = isMonthly ? 36 : 42;
  const marginBottom = isMonthly ? 20 : 22;
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

  // Header row heights (2-row header for all modes: Row 1 Date, Row 2 Session #)
  const totalHeaderHeight = 24;
  const headRow1Height = 12;
  const headRow2Height = 12;

  // Signatures vertical budget (expanded with generous 28pt signing clearance & comfortable gap above signatures)
  const signatureBlockGap = totalStudents > 22 ? 22 : 28;
  const signaturesRequiredHeight = 96 + signatureBlockGap;

  // Document header height with 1 space gap before week/date
  const documentHeaderHeight = data.taskTitle ? 116 : 106;

  // Calculate available vertical space for student rows
  const availTableHeight = pageHeight - marginTop - marginBottom - documentHeaderHeight - totalHeaderHeight - signaturesRequiredHeight;
  // Adaptive row height capped at 20.5pt for small lists, down to ~15pt for 30 students
  const rowHeight = Math.min(20.5, Math.max(14.5, Math.floor(availTableHeight / totalStudents)));

  // Typography scaled proportionately to guarantee crisp legibility
  const headerFontSize = isMonthly ? 7.5 : 8.5;
  const dateHeaderFontSize = dayColW >= 38 ? 7.5 : dayColW >= 28 ? 6.5 : 5.5;
  const sessionLabelBaseFontSize = dayColW >= 38 ? 7.5 : dayColW >= 28 ? 6.5 : 5.5;
  const studentFontSize = totalStudents > 22 ? 8.25 : totalStudents > 16 ? 8.75 : 9.5;
  const scoreFontSize = totalStudents > 22 ? 8.5 : 9.5;

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
      size -= 0.5;
      pdf.setFontSize(size);
    }
    pdf.text(text, x, y, { align: 'center' });
  };

  // Helper: Render Document Header (DepEd & School Logos, Letterhead, Titles, Period Row)
  const renderDocumentHeader = (startY: number): number => {
    let curY = startY;

    // 1. Logos & Letterhead
    const logoSize = 40;
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
    pdf.text(schoolNameText, pageWidth / 2, curY + 30, { align: 'center' });

    pdf.setFont('times', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139); // #64748B
    pdf.text(data.schoolAddress || 'Sta. Cruz, Palanas, Masbate', pageWidth / 2, curY + 40, { align: 'center' });

    // Logos flanking school letterhead with clean spacing
    const logoGap = 20;
    const leftLogoX = pageWidth / 2 - schoolNameWidth / 2 - logoGap - logoSize;
    const rightLogoX = pageWidth / 2 + schoolNameWidth / 2 + logoGap;
    const logoY = textBlockTop + (42 - logoSize) / 2;

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

    curY += 46;

    // 2. Document Title & Grade Section & Task Title
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text((data.subjectTitle || 'ARAL PROGRAM SCORE SHEET').toUpperCase(), pageWidth / 2, curY + 10, { align: 'center' });

    pdf.setFontSize(9.5);
    pdf.setTextColor(51, 65, 85); // #334155
    pdf.text((data.gradeSection || 'GRADE 8-MANGO').toUpperCase(), pageWidth / 2, curY + 21, { align: 'center' });

    if (data.taskTitle) {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text(data.taskTitle.toUpperCase(), pageWidth / 2, curY + 31, { align: 'center' });
      curY += 38;
    } else {
      curY += 28;
    }

    // 1 clear space gap between header and the week & date section
    curY += 16;

    // 3. Period Meta Line (WEEK: on left, DATE: on right with balanced underlines)
    const metaY = curY;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9);
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

    curY += 14;
    return curY;
  };

  // Helper: Render Table Header (Row 1: Session Date, Row 2: Session #)
  const renderTableHeaders = (tableTopY: number): void => {
    pdf.setDrawColor(30, 41, 59); // #1E293B border
    pdf.setLineWidth(0.5);

    // 1. # Column (Full height)
    pdf.setFillColor(248, 250, 252);
    pdf.rect(marginX, tableTopY, indexColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    renderCenteredFitText('#', marginX + indexColW / 2, tableTopY + totalHeaderHeight / 2 + 2.5, indexColW - 2, headerFontSize, 7);

    // 2. NAME OF THE STUDENTS (Full height)
    const nameX = marginX + indexColW;
    pdf.setFillColor(248, 250, 252);
    pdf.rect(nameX, tableTopY, nameColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    renderCenteredFitText('NAME OF THE STUDENTS', nameX + nameColW / 2, tableTopY + totalHeaderHeight / 2 + 2.5, nameColW - 6, headerFontSize, 7);

    // 3. Session Dates (Top Row 1)
    let curEntryX = nameX + nameColW;
    allEntryCols.forEach((col) => {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(curEntryX, tableTopY, dayColW, headRow1Height, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setTextColor(15, 23, 42);
      let dateText = formatSessionDateHeader(col.dateKey);
      if (dayColW < 24 && col.dateKey) {
        const parts = col.dateKey.split('-');
        if (parts.length === 3) {
          dateText = `${parts[1]}/${parts[2]}`;
        }
      }
      renderCenteredFitText(dateText, curEntryX + dayColW / 2, tableTopY + headRow1Height / 2 + 2.5, dayColW - 2, dateHeaderFontSize, 4.5);
      curEntryX += dayColW;
    });

    // 4. TOTAL SCORE (Full height)
    pdf.setFillColor(248, 250, 252);
    pdf.rect(curEntryX, tableTopY, totalColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setTextColor(15, 23, 42);
    renderCenteredFitText('TOTAL SCORE', curEntryX + totalColW / 2, tableTopY + totalHeaderHeight / 2 + 2.5, totalColW - 4, headerFontSize, 6.5);

    // 5. Session Labels (Bottom Row 2)
    const row2Y = tableTopY + headRow1Height;
    curEntryX = nameX + nameColW;
    allEntryCols.forEach((col, idx) => {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(curEntryX, row2Y, dayColW, headRow2Height, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setTextColor(15, 23, 42);
      let labelText = col.entryLabel;
      if (dayColW < 22) {
        labelText = `S${idx + 1}`;
      } else if (dayColW < 32) {
        labelText = `S#${idx + 1}`;
      }
      renderCenteredFitText(labelText, curEntryX + dayColW / 2, row2Y + headRow2Height / 2 + 2.5, dayColW - 2, sessionLabelBaseFontSize, 4.5);
      curEntryX += dayColW;
    });
  };

  // Helper: Render Signatures Block
  const renderSignatures = (sigStartY: number): void => {
    let curY = sigStartY;
    const colW = 145;

    // Prepared by (Right Aligned)
    const prepX = pageWidth - marginX - colW;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Prepared by:', prepX, curY);

    // Generous 28pt physical pen signing room above tutor name
    curY += 28;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    const tutorName = (data.tutorName || 'TUTOR FULL NAME').toUpperCase();
    pdf.text(tutorName, prepX + colW / 2, curY, { align: 'center' });

    pdf.setLineWidth(0.75);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(prepX, curY + 2, prepX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.tutorTitle || 'Learning Camp Volunteer', prepX + colW / 2, curY + 9, { align: 'center' });

    // Checked by & Noted by Row (generous gap above Checked/Noted fields)
    curY += totalStudents > 22 ? 22 : 26;
    const checkedX = marginX;
    const notedX = pageWidth - marginX - colW;

    // Checked
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Checked:', checkedX, curY);

    // Noted
    pdf.text('Noted:', notedX, curY);

    // Generous 28pt physical pen signing room above checked/noted names
    curY += 28;

    // Checked Name
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    const chkName = (data.checkedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase();
    pdf.text(chkName, checkedX + colW / 2, curY, { align: 'center' });
    pdf.line(checkedX, curY + 2, checkedX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.checkedTitle || 'HT/Asst. to the Principal', checkedX + colW / 2, curY + 9, { align: 'center' });

    // Noted Name
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    const ntdName = (data.notedName || 'FIRSTNAME M.I. LASTNAME').toUpperCase();
    pdf.text(ntdName, notedX + colW / 2, curY, { align: 'center' });
    pdf.line(notedX, curY + 2, notedX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.notedTitle || 'Principal I', notedX + colW / 2, curY + 9, { align: 'center' });
  };

  // Build Document
  let currentY = renderDocumentHeader(marginTop);
  renderTableHeaders(currentY);
  currentY += totalHeaderHeight;

  data.students.forEach((student, sIdx) => {
    // Only break if genuinely exceeding page boundary
    if (currentY + rowHeight > pageHeight - marginBottom - (sIdx === totalStudents - 1 ? signaturesRequiredHeight : 15)) {
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
    pdf.text(String(sIdx + 1), marginX + indexColW / 2, rowY + rowHeight / 2 + 2.5, { align: 'center' });

    // Student Name (left-aligned)
    const nameX = marginX + indexColW;
    pdf.rect(nameX, rowY, nameColW, rowHeight, 'S');
    pdf.setFont('times', 'bold');
    let sNameSize = studentFontSize;
    pdf.setFontSize(sNameSize);
    pdf.setTextColor(15, 23, 42);
    const cleanName = (student.name || '').toUpperCase();
    while (pdf.getTextWidth(cleanName) > nameColW - 10 && sNameSize > 6.5) {
      sNameSize -= 0.5;
      pdf.setFontSize(sNameSize);
    }
    pdf.text(cleanName, nameX + 5, rowY + rowHeight / 2 + 2.5, { maxWidth: nameColW - 10 });

    // Day Scores
    let currentScoreX = nameX + nameColW;
    allEntryCols.forEach((_, dIdx) => {
      pdf.rect(currentScoreX, rowY, dayColW, rowHeight, 'S');
      const scoreVal = student.scores?.[dIdx] !== undefined && student.scores?.[dIdx] !== '' ? String(student.scores[dIdx]) : '';
      if (scoreVal) {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(scoreFontSize);
        pdf.setTextColor(15, 23, 42);
        pdf.text(scoreVal, currentScoreX + dayColW / 2, rowY + rowHeight / 2 + 2.5, { align: 'center' });
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
      pdf.text(totalVal, currentScoreX + totalColW / 2, rowY + rowHeight / 2 + 2.5, { align: 'center' });
    }

    currentY += rowHeight;
  });

  // Render Signatures below table
  currentY += signatureBlockGap;
  if (currentY + 96 > pageHeight - marginBottom) {
    pdf.addPage(pageFormat, 'portrait');
    currentY = marginTop + 10;
  }
  renderSignatures(currentY);

  // Generate Filename & Save
  const finalFilename = customFilename || buildScoreFilename(data, 'pdf');

  pdf.save(finalFilename);
};
