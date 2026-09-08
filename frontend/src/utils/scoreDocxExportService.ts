import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
  PageOrientation,
} from 'docx';
import type { ScoreExportData } from './scoreExportService';
import { DEPED_LOGO_BASE64, PNAHS_LOGO_BASE64 } from '../assets/template_logos/logosBase64';

function base64ToUint8Array(base64Str: string): Uint8Array {
  const clean = base64Str.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const tableBorderThin = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '1E293B',
};

const cellBordersAll = {
  top: tableBorderThin,
  bottom: tableBorderThin,
  left: tableBorderThin,
  right: tableBorderThin,
};

const invisibleBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
};

const cellBordersNone = {
  top: invisibleBorder,
  bottom: invisibleBorder,
  left: invisibleBorder,
  right: invisibleBorder,
};

export const exportScoresToDocx = async (data: ScoreExportData): Promise<void> => {
  let depedBytes: Uint8Array | null = null;
  let pnahsBytes: Uint8Array | null = null;
  try {
    depedBytes = base64ToUint8Array(DEPED_LOGO_BASE64);
  } catch (e) {
    console.warn('Could not decode DepEd logo for Score DOCX:', e);
  }
  try {
    pnahsBytes = base64ToUint8Array(PNAHS_LOGO_BASE64);
  } catch (e) {
    console.warn('Could not decode PNAHS logo for Score DOCX:', e);
  }

  // 1. Header Table (3 columns: Left Logo, Center Letterhead, Right Logo)
  const headerCells: TableCell[] = [
    new TableCell({
      width: { size: 1400, type: WidthType.DXA },
      borders: cellBordersNone,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        depedBytes
          ? new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: depedBytes,
                  transformation: { width: 55, height: 55 },
                }),
              ],
            })
          : new Paragraph({ children: [] }),
      ],
    }),
    new TableCell({
      width: { size: 6600, type: WidthType.DXA },
      borders: cellBordersNone,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: data.division.toUpperCase(),
              font: 'Times New Roman',
              size: 19,
              color: '475569',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: data.district.toUpperCase(),
              font: 'Times New Roman',
              size: 19,
              color: '475569',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: data.schoolName.toUpperCase(),
              font: 'Times New Roman',
              size: 23,
              bold: true,
              color: '0F172A',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: data.schoolAddress,
              font: 'Times New Roman',
              size: 18,
              color: '64748B',
            }),
          ],
        }),
      ],
    }),
    new TableCell({
      width: { size: 1400, type: WidthType.DXA },
      borders: cellBordersNone,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        pnahsBytes
          ? new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: pnahsBytes,
                  transformation: { width: 55, height: 55 },
                }),
              ],
            })
          : new Paragraph({ children: [] }),
      ],
    }),
  ];

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBordersNone,
    rows: [new TableRow({ children: headerCells })],
  });

  // 2. Titles
  const subjectTitlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 40 },
    children: [
      new TextRun({
        text: data.subjectTitle.toUpperCase(),
        font: 'Times New Roman',
        size: 23,
        bold: true,
        color: '0F172A',
      }),
    ],
  });

  const gradeSectionPara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text: data.gradeSection.toUpperCase(),
        font: 'Times New Roman',
        size: 20,
        bold: true,
        color: '334155',
      }),
    ],
  });

  const taskTitlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 180 },
    children: [
      new TextRun({
        text: data.taskTitle.toUpperCase(),
        font: 'Times New Roman',
        size: 19,
        color: '475569',
      }),
    ],
  });

  // 3. Meta Row (Week # and Date)
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: 'WEEK #:  ',
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    color: '0F172A',
                  }),
                  new TextRun({
                    text: `  ${data.weekNumber || '_____'}  `,
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    underline: {},
                    color: '0F172A',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Date:  ',
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    color: '0F172A',
                  }),
                  new TextRun({
                    text: `  ${data.dateStr || '_______'}  `,
                    font: 'Times New Roman',
                    size: 19,
                    bold: true,
                    underline: {},
                    color: '0F172A',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 4. Score Data Table
  const tableRows: TableRow[] = [];
  const idxW = 600;
  const nameW = 3800;
  const scoreW = 900;
  const totalW = 1400;

  // Header
  const headCells: TableCell[] = [
    new TableCell({
      width: { size: idxW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '#', font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
        }),
      ],
    }),
    new TableCell({
      width: { size: nameW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: 'NAME OF STUDENTS', font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
        }),
      ],
    }),
    new TableCell({
      width: { size: scoreW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '1', font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
        }),
      ],
    }),
    new TableCell({
      width: { size: scoreW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '2', font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
        }),
      ],
    }),
    new TableCell({
      width: { size: scoreW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '3', font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
        }),
      ],
    }),
    new TableCell({
      width: { size: scoreW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '4', font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
        }),
      ],
    }),
    new TableCell({
      width: { size: totalW, type: WidthType.DXA },
      borders: cellBordersAll,
      shading: { fill: 'F8FAFC' },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Total Score', font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
        }),
      ],
    }),
  ];
  tableRows.push(new TableRow({ children: headCells }));

  // Student rows
  data.students.forEach((student, idx) => {
    const s1 = student.scores[0] !== undefined ? String(student.scores[0]) : '';
    const s2 = student.scores[1] !== undefined ? String(student.scores[1]) : '';
    const s3 = student.scores[2] !== undefined ? String(student.scores[2]) : '';
    const s4 = student.scores[3] !== undefined ? String(student.scores[3]) : '';
    let total = student.totalScore;
    if (total === undefined || total === '') {
      const nums = [student.scores[0], student.scores[1], student.scores[2], student.scores[3]].filter(
        (s) => typeof s === 'number'
      ) as number[];
      total = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : '';
    }

    const rowCells: TableCell[] = [
      new TableCell({
        width: { size: idxW, type: WidthType.DXA },
        borders: cellBordersAll,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: String(idx + 1), font: 'Times New Roman', size: 19, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: nameW, type: WidthType.DXA },
        borders: cellBordersAll,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: student.name.toUpperCase(), font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: scoreW, type: WidthType.DXA },
        borders: cellBordersAll,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: s1, font: 'Times New Roman', size: 19, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: scoreW, type: WidthType.DXA },
        borders: cellBordersAll,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: s2, font: 'Times New Roman', size: 19, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: scoreW, type: WidthType.DXA },
        borders: cellBordersAll,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: s3, font: 'Times New Roman', size: 19, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: scoreW, type: WidthType.DXA },
        borders: cellBordersAll,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: s4, font: 'Times New Roman', size: 19, color: '0F172A' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: totalW, type: WidthType.DXA },
        borders: cellBordersAll,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: String(total), font: 'Times New Roman', size: 19, bold: true, color: '0F172A' })],
          }),
        ],
      }),
    ];
    tableRows.push(new TableRow({ children: rowCells }));
  });

  const scoresTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBordersAll,
    rows: tableRows,
  });

  // 5. Signatures
  const signatureBorderBottom = {
    style: BorderStyle.SINGLE,
    size: 12,
    color: '0F172A',
  };

  const sigBlockTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: cellBordersNone,
            children: [new Paragraph({ spacing: { before: 200 } })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: cellBordersNone,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'Prepared by:', font: 'Times New Roman', size: 19, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: 240 } }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: data.tutorName.toUpperCase(),
                    font: 'Times New Roman',
                    size: 21,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: data.tutorTitle,
                    font: 'Times New Roman',
                    size: 18,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: cellBordersNone,
            children: [new Paragraph({ spacing: { before: 240 } })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'Checked:', font: 'Times New Roman', size: 19, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: 240 } }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: data.checkedName.toUpperCase(),
                    font: 'Times New Roman',
                    size: 21,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: data.checkedTitle,
                    font: 'Times New Roman',
                    size: 18,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            borders: cellBordersNone,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: cellBordersNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'Noted:', font: 'Times New Roman', size: 19, italics: true, color: '0F172A' })],
              }),
              new Paragraph({ spacing: { before: 240 } }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: signatureBorderBottom },
                children: [
                  new TextRun({
                    text: data.notedName.toUpperCase(),
                    font: 'Times New Roman',
                    size: 21,
                    bold: true,
                    color: '0F172A',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: data.notedTitle,
                    font: 'Times New Roman',
                    size: 18,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 1080,
              bottom: 1080,
              left: 1080,
              right: 1080,
            },
          },
        },
        children: [
          headerTable,
          subjectTitlePara,
          gradeSectionPara,
          taskTitlePara,
          metaTable,
          new Paragraph({ spacing: { after: 120 } }),
          scoresTable,
          sigBlockTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${data.subjectTitle.replace(/\s+/g, '_')}_Weekly_Task_${data.gradeSection.replace(/\s+/g, '_')}.docx`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
