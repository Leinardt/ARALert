import QRCode from 'qrcode';
import { Document, Paragraph, ImageRun, AlignmentType, Packer } from 'docx';

type StaffQrAction = 'arrival_am' | 'departure_am' | 'arrival_pm' | 'departure_pm' | 'staff_day';
export type ExportFormat = 'png' | 'jpeg' | 'jpg' | 'pdf' | 'docx';
export type PaperSize = 'letter' | 'a4' | 'folio';

export const PAPER_SIZE_CONFIG: Record<PaperSize, {
  label: string;
  shortLabel: string;
  widthPx: number;
  heightPx: number;
  pdfWidthPt: number;
  pdfHeightPt: number;
  docxWidthTwips: number;
  docxHeightTwips: number;
  docxImageWidth: number;
  docxImageHeight: number;
  qrSize: number;
  brandY: number;
  titleY: number;
  dateY: number;
  qrY: number;
  scanTextY: number;
  codeTextY: number;
}> = {
  letter: {
    label: 'Short / Letter (8.5 × 11 in)',
    shortLabel: 'Short',
    widthPx: 1275, // 8.5 in at 150 DPI
    heightPx: 1650, // 11 in at 150 DPI
    pdfWidthPt: 612,
    pdfHeightPt: 792,
    docxWidthTwips: 12240,
    docxHeightTwips: 15840,
    docxImageWidth: 540,
    docxImageHeight: 700,
    qrSize: 680,
    brandY: 170,
    titleY: 265,
    dateY: 330,
    qrY: 400,
    scanTextY: 1210,
    codeTextY: 1320,
  },
  a4: {
    label: 'A4 (8.27 × 11.69 in)',
    shortLabel: 'A4',
    widthPx: 1240, // 8.27 in at 150 DPI
    heightPx: 1754, // 11.69 in at 150 DPI
    pdfWidthPt: 595,
    pdfHeightPt: 842,
    docxWidthTwips: 11906,
    docxHeightTwips: 16838,
    docxImageWidth: 525,
    docxImageHeight: 742,
    qrSize: 700,
    brandY: 180,
    titleY: 280,
    dateY: 350,
    qrY: 430,
    scanTextY: 1270,
    codeTextY: 1390,
  },
  folio: {
    label: 'Long / Folio (8.5 × 13 in)',
    shortLabel: 'Long',
    widthPx: 1275, // 8.5 in at 150 DPI
    heightPx: 1950, // 13 in at 150 DPI
    pdfWidthPt: 612,
    pdfHeightPt: 936,
    docxWidthTwips: 12240,
    docxHeightTwips: 18720,
    docxImageWidth: 540,
    docxImageHeight: 825,
    qrSize: 760,
    brandY: 200,
    titleY: 310,
    dateY: 390,
    qrY: 480,
    scanTextY: 1410,
    codeTextY: 1550,
  },
};

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = source;
});

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to create the print file.')), type, quality);
});

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

// A single-image PDF keeps the exported page exactly aligned with the poster canvas.
const createPdfFromJpeg = (jpeg: Uint8Array, widthPx: number, heightPx: number, ptWidth: number, ptHeight: number) => {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  let length = 0;
  const offsets: number[] = [];
  const appendText = (value: string) => {
    const bytes = encoder.encode(value);
    parts.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    length += bytes.length;
  };
  const appendBytes = (bytes: Uint8Array) => {
    parts.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    length += bytes.length;
  };
  const object = (number: number, value: string) => {
    offsets[number] = length;
    appendText(`${number} 0 obj\n${value}\nendobj\n`);
  };

  appendText('%PDF-1.4\n%ARALert\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  appendText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  appendBytes(jpeg);
  appendText('\nendstream\nendobj\n');
  const content = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);

  const xrefOffset = length;
  appendText('xref\n0 6\n0000000000 65535 f \n');
  for (let number = 1; number <= 5; number += 1) appendText(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
  appendText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
};

/**
 * Generates the authoritative Staff DTR Poster Canvas used for both live UI preview and file export.
 */
export const generateStaffQrCanvas = async ({
  sessionId,
  paperSize = 'letter',
  dateOverride,
}: {
  sessionId: string;
  paperSize?: PaperSize;
  dateOverride?: string;
}): Promise<HTMLCanvasElement> => {
  const cfg = PAPER_SIZE_CONFIG[paperSize] || PAPER_SIZE_CONFIG.letter;
  const poster = document.createElement('canvas');
  poster.width = cfg.widthPx;
  poster.height = cfg.heightPx;
  const context = poster.getContext('2d');
  if (!context) throw new Error('Your browser does not support canvas export.');

  const w = cfg.widthPx;
  const h = cfg.heightPx;

  // Solid White Canvas Background (Zero borders)
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, w, h);

  // 1. ARALert Text in Pure Black (No background fill)
  context.fillStyle = '#000000';
  context.font = paperSize === 'folio'
    ? 'bold 88px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : 'bold 82px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  context.textAlign = 'center';
  context.fillText('ARALert', w / 2, cfg.brandY);

  // 2. STAFF DTR QR CODE
  context.fillStyle = '#000000';
  context.font = paperSize === 'folio'
    ? 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : 'bold 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  context.fillText('STAFF DTR QR CODE', w / 2, cfg.titleY);

  // 3. Date under STAFF DTR QR CODE
  const formattedDate = dateOverride || new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  context.fillStyle = '#4B5563';
  context.font = paperSize === 'folio'
    ? '500 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : '500 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  context.fillText(formattedDate, w / 2, cfg.dateY);

  // 4. Centered Crisp QR Code
  const qrDataUrl = await QRCode.toDataURL(sessionId, {
    width: cfg.qrSize,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const qrImage = await loadImage(qrDataUrl);
  const qrSize = cfg.qrSize;
  const qrX = (w - qrSize) / 2;
  const qrY = cfg.qrY;
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // 5. SCAN TO RECORD YOUR TIME
  context.fillStyle = '#000000';
  context.font = paperSize === 'folio'
    ? 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  context.fillText('SCAN TO RECORD YOUR TIME', w / 2, cfg.scanTextY);

  // 6. Manual Entry Code (Pure Black Text, No container, No fill, No border)
  const shortCode = sessionId.replace(/-/g, '').slice(0, 6).toUpperCase();
  context.fillStyle = '#000000';
  context.font = paperSize === 'folio'
    ? 'bold 44px monospace'
    : 'bold 40px monospace';
  context.fillText(`MANUAL ENTRY CODE: ${shortCode}`, w / 2, cfg.codeTextY);

  return poster;
};

export const exportStaffQrPrintFile = async ({
  sessionId,
  action,
  expiresAt,
  format,
  paperSize = 'letter',
}: {
  sessionId: string;
  action: StaffQrAction;
  expiresAt?: string;
  format: ExportFormat;
  paperSize?: PaperSize;
}) => {
  const cfg = PAPER_SIZE_CONFIG[paperSize] || PAPER_SIZE_CONFIG.letter;
  const poster = await generateStaffQrCanvas({
    sessionId,
    paperSize,
  });

  const filename = `ARALert_Staff_DTR_${cfg.shortLabel}_${new Date().toISOString().slice(0, 10)}`;

  if (format === 'docx') {
    const pngDataUrl = poster.toDataURL('image/png');
    const pngBytes = base64ToBytes(pngDataUrl.split(',')[1]);
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: {
              width: cfg.docxWidthTwips,
              height: cfg.docxHeightTwips,
            },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: 'png',
                data: pngBytes,
                transformation: {
                  width: cfg.docxImageWidth,
                  height: cfg.docxImageHeight,
                },
              }),
            ],
          }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${filename}.docx`);
    return;
  }

  if (format === 'pdf') {
    const jpegData = poster.toDataURL('image/jpeg', 0.95).split(',')[1];
    downloadBlob(createPdfFromJpeg(base64ToBytes(jpegData), cfg.widthPx, cfg.heightPx, cfg.pdfWidthPt, cfg.pdfHeightPt), `${filename}.pdf`);
    return;
  }

  const isJpg = format === 'jpeg' || format === 'jpg';
  const mimeType = isJpg ? 'image/jpeg' : 'image/png';
  const ext = isJpg ? 'jpg' : 'png';
  downloadBlob(await canvasToBlob(poster, mimeType, 0.95), `${filename}.${ext}`);
};
