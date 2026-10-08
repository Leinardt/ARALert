import QRCode from 'qrcode';
import { Document, Paragraph, ImageRun, AlignmentType, Packer } from 'docx';

type StaffQrAction = 'arrival_am' | 'departure_am' | 'arrival_pm' | 'departure_pm' | 'staff_day';
export type ExportFormat = 'png' | 'jpeg' | 'jpg' | 'pdf' | 'docx';

const LONG_BOND_WIDTH = 1275; // 8.5 inches at 150 DPI
const LONG_BOND_HEIGHT = 1950; // 13 inches at 150 DPI

const actionLabels: Record<StaffQrAction, string> = {
  arrival_am: 'ARRIVAL - AM',
  departure_am: 'DEPARTURE - AM',
  arrival_pm: 'ARRIVAL - PM',
  departure_pm: 'DEPARTURE - PM',
  staff_day: 'ALL-DAY STAFF DTR',
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

// A single-image PDF keeps the exported page exactly aligned with the long-bond poster canvas.
const createPdfFromJpeg = (jpeg: Uint8Array) => {
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
  object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 936] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4] = length;
  appendText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${LONG_BOND_WIDTH} /Height ${LONG_BOND_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  appendBytes(jpeg);
  appendText('\nendstream\nendobj\n');
  const content = 'q\n612 0 0 936 0 0 cm\n/Im0 Do\nQ\n';
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);

  const xrefOffset = length;
  appendText('xref\n0 6\n0000000000 65535 f \n');
  for (let number = 1; number <= 5; number += 1) appendText(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
  appendText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
};

export const exportStaffQrPrintFile = async ({
  sessionId,
  action,
  expiresAt,
  format,
}: {
  sessionId: string;
  action: StaffQrAction;
  expiresAt?: string;
  format: ExportFormat;
}) => {
  const poster = document.createElement('canvas');
  poster.width = LONG_BOND_WIDTH;
  poster.height = LONG_BOND_HEIGHT;
  const context = poster.getContext('2d');
  if (!context) throw new Error('Your browser does not support print export.');

  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, LONG_BOND_WIDTH, LONG_BOND_HEIGHT);
  context.strokeStyle = '#21793D';
  context.lineWidth = 18;
  context.strokeRect(50, 50, LONG_BOND_WIDTH - 100, LONG_BOND_HEIGHT - 100);
  context.fillStyle = '#21793D';
  context.fillRect(68, 68, LONG_BOND_WIDTH - 136, 140);
  context.fillStyle = '#FFFFFF';
  context.font = 'bold 62px Arial';
  context.textAlign = 'center';
  context.fillText('ARALert', LONG_BOND_WIDTH / 2, 158);

  context.fillStyle = '#172033';
  context.font = 'bold 56px Arial';
  context.fillText('STAFF DTR QR CODE', LONG_BOND_WIDTH / 2, 310);
  context.fillStyle = '#21793D';
  context.font = 'bold 48px Arial';
  context.fillText(actionLabels[action], LONG_BOND_WIDTH / 2, 380);

  const qrDataUrl = await QRCode.toDataURL(sessionId, {
    width: 760,
    margin: 3,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const qrImage = await loadImage(qrDataUrl);
  const qrSize = 760;
  const qrX = (LONG_BOND_WIDTH - qrSize) / 2;
  const qrY = 465;
  context.fillStyle = '#FFFFFF';
  context.fillRect(qrX - 26, qrY - 26, qrSize + 52, qrSize + 52);
  context.strokeStyle = '#D1D5DB';
  context.lineWidth = 4;
  context.strokeRect(qrX - 26, qrY - 26, qrSize + 52, qrSize + 52);
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  context.fillStyle = '#172033';
  context.font = 'bold 38px Arial';
  context.fillText('SCAN TO RECORD YOUR TIME', LONG_BOND_WIDTH / 2, 1345);
  context.font = '32px Arial';
  context.fillStyle = '#4B5563';
  context.fillText('Open ARALert, go to DTR Log, then scan this code.', LONG_BOND_WIDTH / 2, 1415);
  context.fillText(action === 'staff_day'
    ? 'The system assigns your DTR punch automatically based on scan time.'
    : 'Use this code only for the indicated DTR punch above.', LONG_BOND_WIDTH / 2, 1465);

  context.fillStyle = '#EBF3FC';
  context.fillRect(145, 1545, LONG_BOND_WIDTH - 290, 170);
  context.fillStyle = '#0052B7';
  context.font = 'bold 30px Arial';
  const expiryLabel = expiresAt
    ? `Valid until: ${new Date(expiresAt).toLocaleString()}`
    : 'Valid for the current staff attendance session';
  context.fillText(expiryLabel, LONG_BOND_WIDTH / 2, 1645);
  context.fillStyle = '#6B7280';
  context.font = '24px Arial';
  context.fillText('Print on long bond paper (8.5 x 13 inches)', LONG_BOND_WIDTH / 2, 1815);

  const filename = `ARALert_Staff_DTR_${action}_${new Date().toISOString().slice(0, 10)}`;

  if (format === 'docx') {
    const pngDataUrl = poster.toDataURL('image/png');
    const pngBytes = base64ToBytes(pngDataUrl.split(',')[1]);
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: {
              width: 12240, // 8.5 in twips
              height: 18720, // 13 in twips
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
                  width: 540,
                  height: 825,
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
    downloadBlob(createPdfFromJpeg(base64ToBytes(jpegData)), `${filename}.pdf`);
    return;
  }

  const isJpg = format === 'jpeg' || format === 'jpg';
  const mimeType = isJpg ? 'image/jpeg' : 'image/png';
  const ext = isJpg ? 'jpg' : 'png';
  downloadBlob(await canvasToBlob(poster, mimeType, 0.95), `${filename}.${ext}`);
};
