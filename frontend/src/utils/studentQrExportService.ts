import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
} from 'docx';

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
 * Safely resolves the display name for a student record.
 */
export const getStudentDisplayName = (student: StudentQrData): string => {
  if (student.name && student.name.includes(',')) {
    return student.name;
  }
  if (student.last_name && student.first_name) {
    const mi = student.middle_name?.trim() ? ` ${student.middle_name.trim()[0].toUpperCase()}.` : '';
    return `${student.last_name.toUpperCase()}, ${student.first_name.toUpperCase()}${mi}`;
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
 * Exports a branded, high-resolution JPEG ID Badge card for the student.
 */
export const exportStudentQrToJpeg = async (student: StudentQrData): Promise<void> => {
  const studentName = getStudentDisplayName(student);
  const qrDataUrl = await generateStudentQrDataUrl(student.id, 400);

  // Create an offscreen canvas for rendering a beautiful ID badge card
  const canvas = document.createElement('canvas');
  const cardWidth = 800;
  const cardHeight = 1100;
  canvas.width = cardWidth;
  canvas.height = cardHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gradient / clean card
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // Top header banner
  const headerGrad = ctx.createLinearGradient(0, 0, cardWidth, 0);
  headerGrad.addColorStop(0, '#1E40AF'); // Deep Brand Blue
  headerGrad.addColorStop(1, '#2563EB');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, cardWidth, 140);

  // Header Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ARALert ATTENDANCE PASS', cardWidth / 2, 60);

  ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#E0E7FF';
  ctx.fillText('Palanas National Agricultural High School', cardWidth / 2, 95);

  ctx.font = '16px Arial, Helvetica, sans-serif';
  ctx.fillText('Department of Education • ARAL Program', cardWidth / 2, 122);

  // QR Code Image
  const qrImage = new Image();
  qrImage.src = qrDataUrl;
  await new Promise((resolve) => {
    qrImage.onload = resolve;
  });

  // White rounded container with border for QR code
  const qrBoxSize = 460;
  const qrBoxX = (cardWidth - qrBoxSize) / 2;
  const qrBoxY = 175;

  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16);
  ctx.fill();
  ctx.stroke();

  // Draw QR in center of box
  const qrDrawSize = 420;
  const qrDrawX = (cardWidth - qrDrawSize) / 2;
  const qrDrawY = qrBoxY + (qrBoxSize - qrDrawSize) / 2;
  ctx.drawImage(qrImage, qrDrawX, qrDrawY, qrDrawSize, qrDrawSize);

  // Manual 6-Digit Code Badge Underneath QR
  const manualCode = getStudentManualCode(student.id);
  ctx.fillStyle = '#1E40AF';
  ctx.font = 'bold 24px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`MANUAL ATTENDANCE CODE: ${manualCode}`, cardWidth / 2, qrBoxY + qrBoxSize + 36);

  // Student Info Box
  const infoBoxY = 695;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 34px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(studentName.toUpperCase(), cardWidth / 2, infoBoxY);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
  ctx.fillText(`LRN: ${student.lrn || 'N/A'}`, cardWidth / 2, infoBoxY + 40);

  if (student.gradeLevel || student.section) {
    const classText = `${student.gradeLevel || ''}${student.gradeLevel && student.section ? ' - ' : ''}${student.section || ''}`;
    ctx.font = '20px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(classText, cardWidth / 2, infoBoxY + 75);
  }

  if (student.assignedTutorName) {
    ctx.font = 'italic 18px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#2563EB';
    ctx.fillText(`Assigned Tutor: ${student.assignedTutorName}`, cardWidth / 2, infoBoxY + 110);
  }

  // Footer instructions box
  const footerY = 840;
  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.roundRect(50, footerY, cardWidth - 100, 190, 12);
  ctx.fill();

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('INSTRUCTIONS FOR STUDENT & TUTOR', cardWidth / 2, footerY + 35);

  ctx.font = '15px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('• Present this permanent QR code during ARAL learning sessions.', cardWidth / 2, footerY + 70);
  ctx.fillText('• Your tutor will scan this code to record your official attendance.', cardWidth / 2, footerY + 100);
  ctx.fillText('• You can show this pass on a screen or print it for offline attendance.', cardWidth / 2, footerY + 130);
  ctx.fillText('• Keep this pass safe and avoid crumpling or staining the QR code.', cardWidth / 2, footerY + 160);

  // Bottom Security / Timestamp
  ctx.font = '12px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(`Generated by ARALert • System Token: ${student.id}`, cardWidth / 2, cardHeight - 25);

  // Trigger download as JPEG
  const safeFilename = `Student_QR_Pass_${studentName.replace(/\s+/g, '_')}.jpeg`;
  const link = document.createElement('a');
  link.download = safeFilename;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
};

/**
 * Exports an official printable PDF Student Attendance QR Pass.
 */
export const exportStudentQrToPdf = async (student: StudentQrData): Promise<void> => {
  const qrDataUrl = await generateStudentQrDataUrl(student.id, 500);

  // Portrait Letter or A4 document
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();

  // Top Header Banner
  pdf.setFillColor(30, 64, 175);
  pdf.rect(0, 0, pageWidth, 35, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('ARALert ATTENDANCE PASS', pageWidth / 2, 14, { align: 'center' });

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Palanas National Agricultural High School • Department of Education', pageWidth / 2, 22, { align: 'center' });
  pdf.text('Official ARAL Program Permanent Student QR Code', pageWidth / 2, 29, { align: 'center' });

  // Center QR Box
  const qrSizeMm = 80;
  const qrX = (pageWidth - qrSizeMm) / 2;
  const qrY = 48;

  pdf.setDrawColor(226, 232, 240);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(qrX - 5, qrY - 5, qrSizeMm + 10, qrSizeMm + 10, 3, 3, 'FD');

  pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSizeMm, qrSizeMm);

  // Student Identity Details
  const studentName = getStudentDisplayName(student);
  const manualCode = getStudentManualCode(student.id);

  // Manual 6-Digit Code Underneath QR
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(30, 64, 175);
  pdf.text(`MANUAL ATTENDANCE CODE: ${manualCode}`, pageWidth / 2, qrY + qrSizeMm + 10, { align: 'center' });

  let currentY = qrY + qrSizeMm + 20;
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(studentName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

  currentY += 8;
  pdf.setTextColor(71, 85, 105);
  pdf.setFontSize(13);
  pdf.text(`LRN: ${student.lrn || 'N/A'}`, pageWidth / 2, currentY, { align: 'center' });

  if (student.gradeLevel || student.section) {
    currentY += 7;
    const classText = `${student.gradeLevel || ''}${student.gradeLevel && student.section ? ' - ' : ''}${student.section || ''}`;
    pdf.setFontSize(11);
    pdf.text(`Grade Level & Section: ${classText}`, pageWidth / 2, currentY, { align: 'center' });
  }

  if (student.assignedTutorName) {
    currentY += 7;
    pdf.setTextColor(37, 99, 235);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(`Assigned Tutor: ${student.assignedTutorName}`, pageWidth / 2, currentY, { align: 'center' });
  }

  // Guidelines Card
  currentY += 14;
  const guideWidth = pageWidth - 40;
  pdf.setFillColor(241, 245, 249);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(20, currentY, guideWidth, 54, 3, 3, 'FD');

  pdf.setTextColor(30, 41, 59);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('ATTENDANCE INSTRUCTIONS & GUIDELINES', pageWidth / 2, currentY + 8, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(51, 65, 85);
  const instructions = [
    '1. This QR code is permanently assigned to the student account and will not change.',
    '2. Students can present this pass on their mobile screen or bring a printed copy to class.',
    '3. The teacher / tutor scans this code using the ARALert Tutor Scanner during active session hours.',
    '4. Internet connection is NOT required for the student — only the scanning tutor requires connection.',
    '5. In case of lost paper copy, teachers can re-print this pass anytime from the student directory.',
  ];

  let lineY = currentY + 16;
  instructions.forEach((line) => {
    pdf.text(line, 26, lineY);
    lineY += 7;
  });

  // Footer metadata
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(8);
  pdf.text(`ARALert Automated System • Student ID: ${student.id}`, pageWidth / 2, 280, { align: 'center' });

  const safeFilename = `Student_QR_Pass_${studentName.replace(/\s+/g, '_')}.pdf`;
  pdf.save(safeFilename);
};

/**
 * Exports a printable Microsoft Word DOCX Student Attendance QR Pass.
 */
export const exportStudentQrToDocx = async (student: StudentQrData): Promise<void> => {
  const studentName = getStudentDisplayName(student);
  const qrDataUrl = await generateStudentQrDataUrl(student.id, 500);

  // Convert base64 data url to Uint8Array for docx ImageRun
  const base64Data = qrDataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.CENTER,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: '1E40AF' },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 180, after: 60 },
                        children: [
                          new TextRun({
                            text: 'ARALert ATTENDANCE PASS',
                            bold: true,
                            size: 32,
                            color: 'FFFFFF',
                            font: 'Arial',
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 60 },
                        children: [
                          new TextRun({
                            text: 'Palanas National Agricultural High School • Department of Education',
                            size: 20,
                            color: 'E0E7FF',
                            font: 'Arial',
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 180 },
                        children: [
                          new TextRun({
                            text: 'Official ARAL Program Permanent Student QR Code',
                            size: 18,
                            color: 'C7D2FE',
                            font: 'Arial',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 200 },
            children: [
              new ImageRun({
                data: bytes,
                transformation: {
                  width: 250,
                  height: 250,
                },
                type: 'png',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 120 },
            children: [
              new TextRun({
                text: `MANUAL ATTENDANCE CODE: ${getStudentManualCode(student.id)}`,
                bold: true,
                size: 24,
                color: '1E40AF',
                font: 'Arial',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: studentName.toUpperCase(),
                bold: true,
                size: 32,
                color: '0F172A',
                font: 'Arial',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `LRN: ${student.lrn || 'N/A'}`,
                bold: true,
                size: 22,
                color: '475569',
                font: 'Arial',
              }),
            ],
          }),

          ...(student.gradeLevel || student.section
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 60 },
                  children: [
                    new TextRun({
                      text: `Grade & Section: ${student.gradeLevel || ''}${
                        student.gradeLevel && student.section ? ' - ' : ''
                      }${student.section || ''}`,
                      size: 20,
                      color: '64748B',
                      font: 'Arial',
                    }),
                  ],
                }),
              ]
            : []),

          ...(student.assignedTutorName
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 },
                  children: [
                    new TextRun({
                      text: `Assigned Tutor: ${student.assignedTutorName}`,
                      bold: true,
                      size: 20,
                      color: '2563EB',
                      font: 'Arial',
                    }),
                  ],
                }),
              ]
            : []),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.CENTER,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'F1F5F9' },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                      left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                      right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 120, after: 100 },
                        children: [
                          new TextRun({
                            text: 'ATTENDANCE INSTRUCTIONS & USAGE GUIDELINES',
                            bold: true,
                            size: 18,
                            color: '1E293B',
                            font: 'Arial',
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({
                            text: '1. This permanent QR code belongs exclusively to this student and does not change between sessions.',
                            size: 16,
                            color: '334155',
                            font: 'Arial',
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({
                            text: '2. Students can present this pass on their phone screen or bring a printed copy to class.',
                            size: 16,
                            color: '334155',
                            font: 'Arial',
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({
                            text: '3. The tutor uses the ARALert Camera Scanner on their device to log the student present.',
                            size: 16,
                            color: '334155',
                            font: 'Arial',
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 40, after: 120 },
                        children: [
                          new TextRun({
                            text: '4. Students do not require active internet connection; only the teacher scanner needs connectivity.',
                            size: 16,
                            color: '334155',
                            font: 'Arial',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: `ARALert System Pass • Token: ${student.id}`,
                size: 14,
                color: '94A3B8',
                font: 'Arial',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeFilename = `Student_QR_Pass_${studentName.replace(/\s+/g, '_')}.docx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  link.click();
  URL.revokeObjectURL(url);
};
