import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  ImageRun,
} from 'docx';
import { extractLastNameAndFirstName } from './studentFormatters';

export interface StudentQrData {
  id: string;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  lrn?: string | null;
  gradeLevel?: string | null;
  section?: string | null;
  assignedTutorName?: string | null;
}

/**
 * Safely resolves the display name for a student record in LASTNAME, FIRSTNAME M.I. format.
 */
export const getStudentDisplayName = (student: StudentQrData): string => {
  if (student.name && student.name.includes(',')) {
    return student.name;
  }
  if (student.last_name && student.first_name) {
    const mi = student.middle_name?.trim() ? ` ${student.middle_name.trim()[0].toUpperCase()}.` : '';
    return `${student.last_name.toUpperCase()}, ${student.first_name.toUpperCase()}${mi}`;
  }
  const candidate = student.name || student.full_name;
  if (candidate) {
    const { lastName, firstName } = extractLastNameAndFirstName(candidate);
    if (lastName && firstName) {
      return `${lastName.toUpperCase()}, ${firstName.toUpperCase()}`;
    }
  }
  return (
    student.name ||
    student.full_name ||
    `${student.first_name || ''} ${student.last_name || ''}`.trim() ||
    'Student'
  );
};

/**
 * Returns a clean 6-character alphanumeric manual code derived from the student's ID.
 */
export const getStudentManualCode = (studentId: string): string => {
  return studentId.replace(/-/g, '').slice(0, 6).toUpperCase();
};

/**
 * Returns the permanent QR code payload for a student.
 * Format: ARALERT:STUDENT:<UUID>
 */
export const getStudentPermanentQrToken = (studentId: string): string => {
  return `ARALERT:STUDENT:${studentId}`;
};

/**
 * Generates a high-resolution base64 PNG data URL of the student's QR code.
 */
export const generateStudentQrDataUrl = async (
  studentId: string,
  width: number = 300
): Promise<string> => {
  const token = getStudentPermanentQrToken(studentId);
  return await QRCode.toDataURL(token, {
    width,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
};

/**
 * Helper to wrap text cleanly onto an HTML5 canvas.
 */
const wrapCanvasText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number => {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, curY);
      line = words[n] + ' ';
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, curY);
  return curY + lineHeight;
};

export interface InstructionGuideItem {
  en: string;
  mb: string;
}

export const INSTRUCTION_GUIDES: InstructionGuideItem[] = [
  {
    en: '• This QR code and manual code is unique to each student.',
    mb: 'Ini po na QR code kag Manual Code kay unique para sa kada estudyante.',
  },
  {
    en: '• Students can present this QR code on their phone or bring a printed copy to class.',
    mb: 'Pwede ini na QR code ipresent san kada estudyante gamit an inda phone o pwede man magdara san printed na copy.',
  },
  {
    en: '• The tutor scans this QR code using their ARALert tutor scanner during active session hours.',
    mb: 'An tutor an magascan sani na QR code gamit an ina scanner sa ARALert kada session.',
  },
  {
    en: '• In case of lost paper copy, reach out to your assigned ARAL tutor to help you reprint a copy of your QR code. The student can also reprint their own QR code in their personal ARALert account by logging in using their LRN.',
    mb: 'Kun mangyari man na mawara an printed copy, magtugon sa iyo ARAL tutor para mabuligan kamo magprint utro san iyo QR code. Pwede man pod an estudyante magprint san inda sadiri na QR code na makikita sa inda ARALert account matapos mag-log in gamit an inda LRN.',
  },
];

/**
 * Exports a high-resolution, ink-saving black & white JPEG Attendance Pass for the student.
 */
export const exportStudentQrToJpeg = async (
  student: StudentQrData,
  paperSize: 'letter' | 'a4' | 'folio' = 'a4'
): Promise<void> => {
  const studentName = getStudentDisplayName(student);
  const qrDataUrl = await generateStudentQrDataUrl(student.id, 400);

  // Ensure fonts like Poppins are ready before drawing to canvas
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch (e) {
      // ignore
    }
  }

  const dimensions = {
    letter: { width: 850, height: 1100 },
    a4: { width: 800, height: 1130 },
    folio: { width: 850, height: 1300 },
  }[paperSize];

  const canvas = document.createElement('canvas');
  const cardWidth = dimensions.width;
  const cardHeight = dimensions.height;
  canvas.width = cardWidth;
  canvas.height = cardHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Pure white card background (ink-saving)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // Top Header (no color container)
  ctx.fillStyle = '#000000';
  ctx.font = "bold 34px 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('ARALert', cardWidth / 2, 58);

  ctx.font = "600 17px 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = '#111111';
  ctx.fillText('Palanas National Agricultural High School • ARAL Program', cardWidth / 2, 92);

  // Thin clean divider
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50, 115);
  ctx.lineTo(cardWidth - 50, 115);
  ctx.stroke();

  // QR Code Image
  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await new Promise((resolve) => {
    qrImage.onload = resolve;
  });

  const qrBoxSize = 360;
  const qrBoxX = (cardWidth - qrBoxSize) / 2;
  const qrBoxY = 135;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

  const qrDrawSize = 330;
  const qrDrawX = (cardWidth - qrDrawSize) / 2;
  const qrDrawY = qrBoxY + (qrBoxSize - qrDrawSize) / 2;
  ctx.drawImage(qrImage, qrDrawX, qrDrawY, qrDrawSize, qrDrawSize);

  // LASTNAME, FIRSTNAME M.I.
  ctx.fillStyle = '#000000';
  ctx.font = "bold 28px 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText(studentName.toUpperCase(), cardWidth / 2, qrBoxY + qrBoxSize + 46);

  // [small gap] + MANUAL ATTENDANCE CODE:
  const manualLabelY = qrBoxY + qrBoxSize + 84;
  ctx.font = "bold 17px 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = '#000000';
  ctx.fillText('MANUAL ATTENDANCE CODE:', cardWidth / 2, manualLabelY);

  // [MANUAL ATTENDANCE CODE]
  const manualCode = getStudentManualCode(student.id);
  const badgeWidth = 180;
  const badgeHeight = 42;
  const badgeX = (cardWidth - badgeWidth) / 2;
  const badgeY = manualLabelY + 10;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);

  ctx.font = 'bold 24px "Poppins", "Courier New", monospace';
  ctx.fillStyle = '#000000';
  ctx.fillText(manualCode, cardWidth / 2, badgeY + 29);

  // Helper instruction text
  ctx.font = "500 13.5px 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = '#374151';
  ctx.fillText('Use this 6-digit code if there are problems scanning the QR code.', cardWidth / 2, badgeY + badgeHeight + 25);

  // Bottom Section: INSTRUCTIONS & GUIDELINES (no colored container)
  const bottomY = badgeY + badgeHeight + 48;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50, bottomY);
  ctx.lineTo(cardWidth - 50, bottomY);
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = "bold 17px 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText('INSTRUCTIONS & GUIDELINES', 50, bottomY + 30);

  let curY = bottomY + 60;
  for (const guide of INSTRUCTION_GUIDES) {
    ctx.font = "600 13.5px 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = '#000000';
    curY = wrapCanvasText(ctx, guide.en, 50, curY, cardWidth - 100, 21) + 2;

    ctx.font = "italic 13px 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = '#374151';
    curY = wrapCanvasText(ctx, guide.mb, 66, curY, cardWidth - 116, 20) + 10;
  }

  // Trigger download as JPEG
  const safeFilename = `Student_QR_Code_${studentName.replace(/[^a-zA-Z0-9]+/g, '_')}.jpeg`;
  const link = document.createElement('a');
  link.download = safeFilename;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
};

/**
 * Exports an official printable PDF Student Attendance QR Code in black & white.
 */
export const exportStudentQrToPdf = async (
  student: StudentQrData,
  paperSize: 'letter' | 'a4' | 'folio' = 'a4'
): Promise<void> => {
  const studentName = getStudentDisplayName(student);
  const manualCode = getStudentManualCode(student.id);
  const qrDataUrl = await generateStudentQrDataUrl(student.id, 500);

  const formatConfig = {
    letter: [215.9, 279.4],
    a4: 'a4',
    folio: [215.9, 330.2],
  }[paperSize];

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: formatConfig as any,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();

  // Top Header (no colored container)
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('ARALert', pageWidth / 2, 20, { align: 'center' });

  pdf.setFontSize(10.5);
  pdf.text('Palanas National Agricultural High School • ARAL Program', pageWidth / 2, 27, { align: 'center' });

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(20, 32, pageWidth - 20, 32);

  // Center QR Box
  const qrSizeMm = 75;
  const qrX = (pageWidth - qrSizeMm) / 2;
  const qrY = 40;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.4);
  pdf.rect(qrX - 2, qrY - 2, qrSizeMm + 4, qrSizeMm + 4, 'S');

  pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSizeMm, qrSizeMm);

  // LASTNAME, FIRSTNAME M.I.
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(studentName.toUpperCase(), pageWidth / 2, qrY + qrSizeMm + 14, { align: 'center' });

  // [small gap] + MANUAL ATTENDANCE CODE:
  const manualLabelY = qrY + qrSizeMm + 24;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text('MANUAL ATTENDANCE CODE:', pageWidth / 2, manualLabelY, { align: 'center' });

  // [MANUAL ATTENDANCE CODE] box
  const badgeW = 44;
  const badgeH = 9;
  const badgeX = (pageWidth - badgeW) / 2;
  const badgeY = manualLabelY + 3;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.rect(badgeX, badgeY, badgeW, badgeH, 'S');

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(13);
  pdf.text(manualCode, pageWidth / 2, badgeY + 6.5, { align: 'center' });

  // Helper text
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(60, 60, 60);
  pdf.text('Use this 6-digit code if there are problems scanning the QR code.', pageWidth / 2, badgeY + badgeH + 6, { align: 'center' });

  // Bottom Section: INSTRUCTIONS & GUIDELINES (no colored container)
  const bottomY = badgeY + badgeH + 11.5;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(20, bottomY, pageWidth - 20, bottomY);

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('INSTRUCTIONS & GUIDELINES', 20, bottomY + 7);

  const maxWidth = pageWidth - 40;
  let bY = bottomY + 13.5;
  for (const guide of INSTRUCTION_GUIDES) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    const enLines = pdf.splitTextToSize(guide.en, maxWidth);
    pdf.text(enLines, 20, bY);
    bY += enLines.length * 4.0 + 1.2;

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    pdf.setTextColor(55, 65, 81);
    const mbLines = pdf.splitTextToSize(guide.mb, maxWidth - 4);
    pdf.text(mbLines, 24, bY);
    bY += mbLines.length * 3.8 + 2.8;
  }

  const safeFilename = `Student_QR_Code_${studentName.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
  pdf.save(safeFilename);
};

/**
 * Exports a printable Microsoft Word DOCX Student Attendance QR Code in black & white.
 */
export const exportStudentQrToDocx = async (
  student: StudentQrData,
  paperSize: 'letter' | 'a4' | 'folio' = 'a4'
): Promise<void> => {
  const studentName = getStudentDisplayName(student);
  const qrDataUrl = await generateStudentQrDataUrl(student.id, 500);

  // Convert base64 data url to Uint8Array for docx ImageRun
  const base64Data = qrDataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const pageDimensions = {
    letter: { width: 12240, height: 15840 },
    a4: { width: 11906, height: 16838 },
    folio: { width: 12240, height: 18720 },
  }[paperSize];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: pageDimensions,
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          // Top Header (no colored container table)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({
                text: 'ARALert',
                bold: true,
                size: 34,
                color: '000000',
                font: 'Poppins',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: 'Palanas National Agricultural High School • ARAL Program',
                bold: true,
                size: 20,
                color: '111111',
                font: 'Poppins',
              }),
            ],
          }),

          // QR Code Image
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 120 },
            children: [
              new ImageRun({
                data: bytes,
                transformation: {
                  width: 220,
                  height: 220,
                },
                type: 'png',
              }),
            ],
          }),

          // LASTNAME, FIRSTNAME M.I.
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: studentName.toUpperCase(),
                bold: true,
                size: 26,
                color: '000000',
                font: 'Poppins',
              }),
            ],
          }),

          // [small gap] + MANUAL ATTENDANCE CODE:
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 40 },
            children: [
              new TextRun({
                text: 'MANUAL ATTENDANCE CODE:',
                bold: true,
                size: 19,
                color: '000000',
                font: 'Poppins',
              }),
            ],
          }),

          // [MANUAL ATTENDANCE CODE]
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 50 },
            children: [
              new TextRun({
                text: getStudentManualCode(student.id),
                bold: true,
                size: 26,
                color: '000000',
                font: 'Poppins',
              }),
            ],
          }),

          // Use this 6-digit code if there are problems scanning the QR code.
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: 'Use this 6-digit code if there are problems scanning the QR code.',
                size: 17,
                color: '444444',
                font: 'Poppins',
              }),
            ],
          }),

          // Bottom Section: INSTRUCTIONS & GUIDELINES (no colored container)
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: 'INSTRUCTIONS & GUIDELINES',
                bold: true,
                size: 20,
                color: '000000',
                font: 'Poppins',
              }),
            ],
          }),

          ...INSTRUCTION_GUIDES.flatMap((guide) => [
            new Paragraph({
              spacing: { before: 35, after: 8 },
              children: [
                new TextRun({
                  text: guide.en,
                  bold: true,
                  size: 17,
                  color: '000000',
                  font: 'Poppins',
                }),
              ],
            }),
            new Paragraph({
              spacing: { before: 0, after: 50 },
              indent: { left: 240 },
              children: [
                new TextRun({
                  text: guide.mb,
                  italics: true,
                  size: 16,
                  color: '374151',
                  font: 'Poppins',
                }),
              ],
            }),
          ]),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeFilename = `Student_QR_Code_${studentName.replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  link.click();
  URL.revokeObjectURL(url);
};
