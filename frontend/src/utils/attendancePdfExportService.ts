import { jsPDF } from 'jspdf';
import { formatAttendanceDateHeader, buildAttendanceFilename, type AttendanceExportData } from './attendanceExportService';
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
  const totalStudents = Math.max(data.students.length, 1);

  // Optimized margins with comfortable top gap above header
  const marginX = isMonthly ? 32 : 40;
  const marginTop = isMonthly ? 36 : 42;
  const marginBottom = isMonthly ? 20 : 22;
  const availWidth = pageWidth - marginX * 2;

  // Table Column Widths matching exact proportions
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

  // Header row height (single clean header row)
  const totalHeaderHeight = 20;

  // Signatures vertical budget (expanded with generous 28pt signing clearance & comfortable gap above signatures)
  const signatureBlockGap = totalStudents > 22 ? 22 : 28;
  const signaturesRequiredHeight = 96 + signatureBlockGap;

  // Document header height with 1 space gap before week/date is ~100pt
  const documentHeaderHeight = 100;

  // Calculate available vertical space for student rows
  const availTableHeight = pageHeight - marginTop - marginBottom - documentHeaderHeight - totalHeaderHeight - signaturesRequiredHeight;
  // Adaptive row height capped at 20.5pt for small lists, down to ~15pt for 30 students
  const rowHeight = Math.min(20.5, Math.max(14.5, Math.floor(availTableHeight / totalStudents)));

  // Typography scaled proportionately to guarantee crisp legibility
  const headerFontSize = isMonthly ? 7.5 : 8.5;
  const studentFontSize = totalStudents > 22 ? 8.25 : totalStudents > 16 ? 8.75 : 9.5;
  const markFontSize = totalStudents > 22 ? 9 : 10;

  // Helper: Render Header (Logos, Letterhead, Titles, Meta Row)
  const renderDocumentHeader = (startY: number): number => {
    let curY = startY;

    // 1. Logos & Letterhead
    const logoSize = 40; // 40×40 pt crisp presentation
    const textBlockTop = curY;

    // Measure exact school name width using the exact font and size (Times bold 10.5pt)
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10.5);
    const schoolNameText = data.schoolName.toUpperCase();
    const schoolNameWidth = pdf.getTextWidth(schoolNameText);

    // School Letterhead Text Lines
    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105); // #475569
    pdf.text(data.division.toUpperCase(), pageWidth / 2, curY + 8, { align: 'center' });

    pdf.text(data.district.toUpperCase(), pageWidth / 2, curY + 18, { align: 'center' });

    pdf.setFont('times', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42); // #0F172A
    pdf.text(schoolNameText, pageWidth / 2, curY + 30, { align: 'center' });

    pdf.setFont('times', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139); // #64748B
    pdf.text(data.schoolAddress, pageWidth / 2, curY + 40, { align: 'center' });

    // Logos flanking the school letterhead
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

    // 2. Document Title & Grade Section
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(data.subjectTitle.toUpperCase(), pageWidth / 2, curY + 10, { align: 'center' });

    pdf.setFontSize(9.5);
    pdf.setTextColor(51, 65, 85); // #334155
    pdf.text(data.gradeSection.toUpperCase(), pageWidth / 2, curY + 22, { align: 'center' });

    curY += 24;

    // 1 clear space gap between header and the week & date section
    curY += 16;

    // 3. Period Meta Line (WEEK on left, DATE on right with balanced underline)
    const metaY = curY;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);

    // Left: WEEK:  _2_
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

    // Right: DATE:  _09/07/2026 - 09/11/2026_
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

  // Helper: Render Table Headers
  const renderTableHeaders = (tableTopY: number): void => {
    pdf.setDrawColor(30, 41, 59); // #1E293B border
    pdf.setLineWidth(0.5);

    // Single clean header row (no redundant date range row)
    // #
    pdf.setFillColor(248, 250, 252);
    pdf.rect(marginX, tableTopY, indexColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setFontSize(headerFontSize);
    pdf.setTextColor(15, 23, 42);
    pdf.text('#', marginX + indexColW / 2, tableTopY + totalHeaderHeight / 2 + 2.5, { align: 'center' });

    // NAME OF THE STUDENTS
    const nameX = marginX + indexColW;
    pdf.setFillColor(248, 250, 252);
    pdf.rect(nameX, tableTopY, nameColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setFontSize(headerFontSize);
    pdf.setTextColor(15, 23, 42);
    pdf.text('NAME OF THE STUDENTS', nameX + nameColW / 2, tableTopY + totalHeaderHeight / 2 + 2.5, { align: 'center' });

    // Day Columns
    const renderCenteredFitText = (
      text: string,
      x: number,
      y: number,
      maxW: number,
      startSize: number,
      minSize = 4.5
    ): void => {
      let sz = startSize;
      pdf.setFontSize(sz);
      while (pdf.getTextWidth(text) > maxW && sz > minSize) {
        sz -= 0.25;
        pdf.setFontSize(sz);
      }
      pdf.text(text, x, y, { align: 'center' });
    };

    let dayX = nameX + nameColW;
    allDays.forEach((day) => {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(dayX, tableTopY, dayColW, totalHeaderHeight, 'FD');
      pdf.setFont('times', 'bold');
      pdf.setTextColor(15, 23, 42);

      if (totalDayCols <= 1) {
        const dateText = formatAttendanceDateHeader(day.dateKey, day.dayNum);
        renderCenteredFitText(
          dateText,
          dayX + dayColW / 2,
          tableTopY + totalHeaderHeight / 2 + 2.5,
          dayColW - 2,
          8,
          4.5
        );
      } else {
        pdf.setFontSize(headerFontSize);
        pdf.text(String(day.dayNum), dayX + dayColW / 2, tableTopY + totalHeaderHeight / 2 + 2.5, { align: 'center' });
      }
      dayX += dayColW;
    });

    // SIGNATURE
    const sigX = marginX + availWidth - sigColW;
    pdf.setFillColor(248, 250, 252);
    pdf.rect(sigX, tableTopY, sigColW, totalHeaderHeight, 'FD');
    pdf.setFont('times', 'bold');
    pdf.setFontSize(headerFontSize);
    pdf.setTextColor(15, 23, 42);
    pdf.text('SIGNATURE', sigX + sigColW / 2, tableTopY + totalHeaderHeight / 2 + 2.5, { align: 'center' });
  };

  // Helper: Render Signatures Block
  const renderSignatures = (sigStartY: number): void => {
    let curY = sigStartY;
    const colW = 145;

    // Prepared by (Right Aligned)
    const prepX = pageWidth - marginX - colW;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Prepared by:', prepX, curY);

    // Generous 28pt physical pen signing room above the name line
    curY += 28;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    const tutorName = (data.tutorName || 'NYAN JEAN Q. ALCOVINDAS').toUpperCase();
    pdf.text(tutorName, prepX + colW / 2, curY, { align: 'center' });

    pdf.setLineWidth(0.75);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(prepX, curY + 2, prepX + colW, curY + 2);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(data.tutorTitle || 'ARAL TUTOR', prepX + colW / 2, curY + 9, { align: 'center' });

    // Checked by & Noted by Row (generous gap above Checked/Noted fields)
    curY += totalStudents > 22 ? 22 : 26;
    const checkedX = marginX;
    const notedX = pageWidth - marginX - colW;

    // Checked
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Checked:', checkedX, curY);

    // Noted
    pdf.text('Noted:', notedX, curY);

    // Generous 28pt physical pen signing room above the name lines
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
    const ntdName = (data.notedName || 'ANDY TONAMANAKO').toUpperCase();
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

  // Render Student Rows
  data.students.forEach((student, sIdx) => {
    // Only break if genuinely exceeding page boundary
    if (currentY + rowHeight > pageHeight - marginBottom - (sIdx === totalStudents - 1 ? signaturesRequiredHeight : 15)) {
      pdf.addPage(pageFormat, 'portrait');
      currentY = marginTop;
      renderTableHeaders(currentY);
      currentY += totalHeaderHeight;
    }

    const rowY = currentY;

    // 1. Fill row background with pure WHITE
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
    pdf.text(String(sIdx + 1), marginX + indexColW / 2, rowY + rowHeight / 2 + 2.5, { align: 'center' });

    // Student Name (left-aligned with 5pt margin)
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

    // Days / Marks
    let dayX = nameX + nameColW;
    allDays.forEach((day) => {
      pdf.rect(dayX, rowY, dayColW, rowHeight, 'S');
      const status = student.statusByDate?.[day.dateKey];

      if (status === 'P' || status === 'present') {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(markFontSize);
        pdf.setTextColor(15, 23, 42); // #0F172A Slate 900
        pdf.text('/', dayX + dayColW / 2, rowY + rowHeight / 2 + 2.5, { align: 'center' });
      }
      dayX += dayColW;
    });

    // Signature
    const sigX = marginX + availWidth - sigColW;
    pdf.rect(sigX, rowY, sigColW, rowHeight, 'S');

    currentY += rowHeight;
  });

  // Render Signatures below table
  currentY += signatureBlockGap;
  if (currentY + 92 > pageHeight - marginBottom) {
    pdf.addPage(pageFormat, 'portrait');
    currentY = marginTop + 10;
  }
  renderSignatures(currentY);

  // Generate Filename & Save
  const finalFilename = customFilename || buildAttendanceFilename(data, 'pdf');

  pdf.save(finalFilename);
};
