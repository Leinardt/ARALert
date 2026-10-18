import React, { useState, useRef, useMemo } from 'react';
import ExcelJS from 'exceljs';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  Trash2,
  Sparkles,
  ClipboardList,
  Check,
  Search,
  Loader2,
  ChevronRight,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { userService } from '../services/userService';
import type { User } from '../types';
import { formatTutorAssignmentOption } from '../utils/tutorCohortHelpers';

export interface BatchParsedStudent {
  id: string; // client-side unique id for keying
  sheetName: string;
  grade_level_grade: string; // e.g. "GRADE 7"
  grade_level_section: string; // e.g. "HYACINTH"
  first_name: string;
  middle_name: string;
  last_name: string;
  lrn: string;
  aral_level: 'basic' | 'plus' | '';
  subject: string;
  assigned_tutor_id: string | null;
  assigned_tutor_name?: string;
  parent_guardian_name: string;
  contact_number: string;
  has_bosy: boolean;
  has_mosy: boolean;
  has_eosy: boolean;
  has_summer: boolean;
  status: 'pending' | 'ready' | 'enrolled' | 'error';
  errorMessage?: string;
}

interface BatchStudentEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutors: User[];
  onEnrollmentSuccess?: (count: number) => void;
}

const LRN_REGEX = /^\d{12}$/;
const PHONE_REGEX = /^09\d{9}$/;

// Known section abbreviations to clean names
const SECTION_MAP: Record<string, string> = {
  'HYA': 'HYACINTH',
  'DAFF': 'DAFFODIL',
  'AZ': 'AZALEA',
  'AV': 'AVOCADO',
  'JACK': 'JACKFRUIT',
  'MANG': 'MANGO',
  'ACA': 'ACACIA',
  'MOLAV': 'MOLAVE',
  'CARR': 'CARROT',
  'RAD': 'RADISH',
  'TURN': 'TURNIP',
};

export const BatchStudentEnrollmentModal: React.FC<BatchStudentEnrollmentModalProps> = ({
  isOpen,
  onClose,
  tutors,
  onEnrollmentSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [students, setStudents] = useState<BatchParsedStudent[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick paste LRNs modal state
  const [isPasteLrnOpen, setIsPasteLrnOpen] = useState<boolean>(false);
  const [pasteLrnText, setPasteLrnText] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [enrollProgress, setEnrollProgress] = useState<{ current: number; total: number } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [enrollSummary, setEnrollSummary] = useState<{ success: number; failed: number } | null>(null);

  // Reset state on open/close
  const handleClose = () => {
    if (isSubmitting) return;
    setStudents([]);
    setFileName('');
    setParseError(null);
    setGlobalError(null);
    setEnrollSummary(null);
    setSelectedSheet('all');
    setSearchQuery('');
    onClose();
  };

  // Helper to match tutor name from Excel string to active system tutors
  const findMatchingTutor = (rawTutorName: string): User | null => {
    if (!rawTutorName || !rawTutorName.trim()) return null;
    const cleanRaw = rawTutorName.toLowerCase().replace(/[^a-zñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const rawTokens = cleanRaw.split(' ').filter((t) => t.length > 1);

    if (rawTokens.length === 0) return null;

    let bestMatch: User | null = null;
    let highestScore = 0;

    for (const tutor of tutors) {
      const tutorFirst = (tutor.first_name || '').toLowerCase().replace(/[^a-zñ\s]/g, ' ');
      const tutorLast = (tutor.last_name || '').toLowerCase().replace(/[^a-zñ\s]/g, ' ');
      const tutorFull = `${tutorFirst} ${tutorLast}`.trim();

      let score = 0;
      for (const token of rawTokens) {
        if (tutorLast.includes(token)) score += 3;
        else if (tutorFirst.includes(token)) score += 2;
        else if (tutorFull.includes(token)) score += 1;
      }

      if (score > highestScore && score >= 3) {
        highestScore = score;
        bestMatch = tutor;
      }
    }

    return bestMatch;
  };

  // Parse Philippine Name format: "LASTNAME, FIRSTNAME MIDDLEINITIAL"
  const parseLearnerName = (rawName: string): { last_name: string; first_name: string; middle_name: string } => {
    const clean = (rawName || '').trim().replace(/\s+/g, ' ');
    if (!clean) return { last_name: '', first_name: '', middle_name: '' };

    const commaIdx = clean.indexOf(',');
    if (commaIdx !== -1) {
      const lastName = clean.substring(0, commaIdx).trim().toUpperCase();
      const rest = clean.substring(commaIdx + 1).trim();
      const tokens = rest.split(' ').filter(Boolean);

      if (tokens.length > 1) {
        const lastToken = tokens[tokens.length - 1];
        // If last token looks like a middle initial e.g. "A.", "A", "M.", "JR.", "III"
        if (lastToken.length <= 3 && /^[A-Za-z.]+$/.test(lastToken)) {
          return {
            last_name: lastName,
            first_name: tokens.slice(0, tokens.length - 1).join(' ').toUpperCase(),
            middle_name: lastToken.toUpperCase(),
          };
        }
      }
      return {
        last_name: lastName,
        first_name: rest.toUpperCase(),
        middle_name: '',
      };
    }

    // Fallback: If no comma was used (e.g. "FIRSTNAME LASTNAME")
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length === 1) {
      return { last_name: parts[0].toUpperCase(), first_name: parts[0].toUpperCase(), middle_name: '' };
    }
    const lastName = parts[parts.length - 1].toUpperCase();
    const firstParts = parts.slice(0, parts.length - 1);
    return {
      last_name: lastName,
      first_name: firstParts.join(' ').toUpperCase(),
      middle_name: '',
    };
  };

  // Normalize phone number to 11 digits starting with 09
  const normalizePhoneNumber = (raw: any): string => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('9')) {
      return `0${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('09')) {
      return digits;
    }
    return digits.slice(0, 11);
  };

  // Normalize subject focus
  const normalizeSubject = (raw: any): string => {
    if (!raw) return 'Filipino';
    const s = String(raw).trim().toLowerCase();
    if (s.includes('eng')) return 'English';
    if (s.includes('fil') || s.includes('tag') || s.includes('read')) return 'Filipino';
    if (s.includes('math')) return 'Math';
    if (s.includes('sci')) return 'Science';
    return String(raw).trim();
  };

  // Main Excel file processor (works with multi-tab workbooks)
  const processExcelFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setGlobalError(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const parsedList: BatchParsedStudent[] = [];

      // Loop through all worksheets in the Excel file
      workbook.eachSheet((worksheet, sheetId) => {
        const sheetName = worksheet.name.trim();

        // 1. Detect Grade and Section from sheet headers or tab name
        let detectedGrade = 'GRADE 7';
        let detectedSection = 'HYACINTH';

        // Try extracting from sheet tab name (e.g. "7-HYA", "7-DAFF", "8-MANG", "9-ACA")
        const tabMatch = sheetName.match(/^(\d{1,2})\s*[-_–]\s*([A-Za-z0-9\s]+)$/i);
        if (tabMatch) {
          detectedGrade = `GRADE ${tabMatch[1]}`;
          const rawSec = tabMatch[2].trim().toUpperCase();
          detectedSection = SECTION_MAP[rawSec] || rawSec;
        }

        // Try reading Grade & Section from top rows (cells 1 to 15)
        let detectedTutorName = '';
        let detectedTutor: User | null = null;
        let headerRowIdx = -1;

        for (let r = 1; r <= 15; r++) {
          const row = worksheet.getRow(r);
          for (let c = 1; c <= 15; c++) {
            const cellVal = row.getCell(c).text?.trim() || '';
            if (!cellVal) continue;

            // Search for "GRADE LEVEL: 7 - HYACINTH"
            const gradeCellMatch = cellVal.match(/GRADE(?:\s*LEVEL)?[:\s]+(?:GRADE\s*)?(\d{1,2})\s*[-–:]\s*([A-Za-z0-9\s\-]+)/i);
            if (gradeCellMatch) {
              detectedGrade = `GRADE ${gradeCellMatch[1]}`;
              detectedSection = gradeCellMatch[2].trim().toUpperCase();
            }

            // Search for "TUTOR: RIZA J. GADIA"
            const tutorCellMatch = cellVal.match(/TUTOR[:\s]+([A-Za-z\s.\-ñÑ']+)/i);
            if (tutorCellMatch && !detectedTutorName) {
              detectedTutorName = tutorCellMatch[1].trim();
              detectedTutor = findMatchingTutor(detectedTutorName);
            }

            // Check if this row is the column headers row
            if (/Name of Learner/i.test(cellVal) || (/Learner/i.test(cellVal) && /No/i.test(row.getCell(1).text || ''))) {
              headerRowIdx = r;
            }
          }
        }

        // Also check bottom rows for "Prepared by: ... (TUTOR)" if tutor wasn't in header
        if (!detectedTutorName) {
          for (let r = 50; r <= Math.min(worksheet.rowCount, 70); r++) {
            const row = worksheet.getRow(r);
            for (let c = 1; c <= 8; c++) {
              const text = row.getCell(c).text?.trim() || '';
              const match = text.match(/([A-Za-z\s.\-ñÑ']+)\s*\n?\(?TUTOR\)?/i);
              if (match) {
                detectedTutorName = match[1].trim();
                detectedTutor = findMatchingTutor(detectedTutorName);
                break;
              }
            }
            if (detectedTutorName) break;
          }
        }

        // Fallback header row index if not explicitly located
        if (headerRowIdx === -1) {
          for (let r = 1; r <= 20; r++) {
            const row = worksheet.getRow(r);
            const a = row.getCell(1).text?.trim();
            const b = row.getCell(2).text?.trim();
            if ((a === 'No.' || a === 'No' || a === '#') && /Name/i.test(b)) {
              headerRowIdx = r;
              break;
            }
          }
        }

        if (headerRowIdx === -1) {
          // If no recognized table header in this sheet, skip it
          return;
        }

        // Map column indices
        const headerRow = worksheet.getRow(headerRowIdx);
        let colNo = 1;
        let colName = 2;
        let colBosy = 3;
        let colMosy = 4;
        let colEosy = 5;
        let colSubject = 6;
        let colGuardian = 7;
        let colContact = 8;
        let colLrn = -1;

        for (let c = 1; c <= 15; c++) {
          const colTitle = headerRow.getCell(c).text?.trim() || '';
          if (/No\.?|#/i.test(colTitle) && !/Contact/i.test(colTitle)) colNo = c;
          else if (/Name of Learner|Learner|Student Name/i.test(colTitle)) colName = c;
          else if (/BOSY/i.test(colTitle)) colBosy = c;
          else if (/MOSY/i.test(colTitle)) colMosy = c;
          else if (/EOSY/i.test(colTitle)) colEosy = c;
          else if (/Subject/i.test(colTitle)) colSubject = c;
          else if (/Parent|Guardian/i.test(colTitle)) colGuardian = c;
          else if (/Contact|Phone|Mobile/i.test(colTitle)) colContact = c;
          else if (/LRN/i.test(colTitle)) colLrn = c;
        }

        // 2. Parse student rows
        for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
          const row = worksheet.getRow(r);
          const rawNo = row.getCell(colNo).text?.trim() || '';
          const rawName = row.getCell(colName).text?.trim() || '';

          // Stop parsing if we hit footer signatures or non-student rows
          if (
            /Prepared|Checked|Noted|Adviser|Principal|Total|Summary/i.test(rawNo) ||
            /Prepared|Checked|Noted|Adviser|Principal|Total|Summary/i.test(rawName)
          ) {
            break;
          }

          // If learner name is empty, continue
          if (!rawName) continue;

          const { last_name, first_name, middle_name } = parseLearnerName(rawName);
          if (!last_name && !first_name) continue;

          const rawSubject = row.getCell(colSubject).text?.trim();
          const cleanSubject = normalizeSubject(rawSubject);

          // Auto-suggest ARAL Level based on DepEd subject focus:
          // English -> plus, Filipino -> basic
          let suggestedAralLevel: 'basic' | 'plus' | '' = '';
          if (cleanSubject === 'English') suggestedAralLevel = 'plus';
          else if (cleanSubject === 'Filipino') suggestedAralLevel = 'basic';
          else suggestedAralLevel = 'basic';

          const rawGuardian = row.getCell(colGuardian).text?.trim() || '';
          const rawContact = row.getCell(colContact).value;
          const normalizedContact = normalizePhoneNumber(rawContact);

          const rawBosy = row.getCell(colBosy).text?.trim().toUpperCase();
          const rawMosy = row.getCell(colMosy).text?.trim().toUpperCase();
          const rawEosy = row.getCell(colEosy).text?.trim().toUpperCase();

          const hasBosy = rawBosy === 'TRUE' || rawBosy === '1' || rawBosy === 'YES' || rawBosy === 'Y' || true;
          const hasMosy = rawMosy === 'TRUE' || rawMosy === '1' || rawMosy === 'YES';
          const hasEosy = rawEosy === 'TRUE' || rawEosy === '1' || rawEosy === 'YES';

          const explicitLrn = colLrn !== -1 ? row.getCell(colLrn).text?.trim().replace(/\D/g, '') : '';

          parsedList.push({
            id: `student_${sheetId}_${r}_${Date.now()}_${Math.random()}`,
            sheetName,
            grade_level_grade: detectedGrade,
            grade_level_section: detectedSection,
            first_name,
            middle_name,
            last_name,
            lrn: explicitLrn || '',
            aral_level: suggestedAralLevel,
            subject: cleanSubject,
            assigned_tutor_id: detectedTutor ? detectedTutor.id : null,
            assigned_tutor_name: detectedTutor ? detectedTutor.full_name : detectedTutorName || 'To Be Assigned',
            parent_guardian_name: rawGuardian.toUpperCase(),
            contact_number: normalizedContact,
            has_bosy: hasBosy,
            has_mosy: hasMosy,
            has_eosy: hasEosy,
            has_summer: false,
            status: explicitLrn && LRN_REGEX.test(explicitLrn) && suggestedAralLevel ? 'ready' : 'pending',
          });
        }
      });

      if (parsedList.length === 0) {
        setParseError('No learner rows could be extracted from this Excel file. Please ensure the file follows the BOSY List format.');
      } else {
        setStudents(parsedList);
      }
    } catch (err: any) {
      console.error('Failed to parse Excel file:', err);
      setParseError(err.message || 'An error occurred while reading the Excel file.');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  // Distinct sheet names for tab navigation
  const uniqueSheets = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      map.set(s.sheetName, (map.get(s.sheetName) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [students]);

  // Filtered students by active tab & search query
  const filteredStudents = useMemo(() => {
    let list = students;
    if (selectedSheet !== 'all') {
      list = list.filter((s) => s.sheetName === selectedSheet);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.last_name.toLowerCase().includes(q) ||
          s.first_name.toLowerCase().includes(q) ||
          s.middle_name.toLowerCase().includes(q) ||
          s.lrn.includes(q) ||
          s.grade_level_section.toLowerCase().includes(q) ||
          s.parent_guardian_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, selectedSheet, searchQuery]);

  // Bulk actions for visible students
  const handleSetAllAralLevel = (level: 'basic' | 'plus') => {
    setStudents((prev) =>
      prev.map((s) => {
        if (selectedSheet !== 'all' && s.sheetName !== selectedSheet) return s;
        const newSubject = level === 'plus' && s.subject === 'Filipino' ? 'English' : level === 'basic' && s.subject === 'English' ? 'Filipino' : s.subject;
        const isReady = LRN_REGEX.test(s.lrn) && Boolean(level);
        return {
          ...s,
          aral_level: level,
          subject: newSubject,
          status: isReady ? 'ready' : 'pending',
        };
      })
    );
  };

  const handleAutoMapAralLevel = () => {
    setStudents((prev) =>
      prev.map((s) => {
        if (selectedSheet !== 'all' && s.sheetName !== selectedSheet) return s;
        const level: 'basic' | 'plus' = s.subject === 'English' ? 'plus' : 'basic';
        const isReady = LRN_REGEX.test(s.lrn) && Boolean(level);
        return {
          ...s,
          aral_level: level,
          status: isReady ? 'ready' : 'pending',
        };
      })
    );
  };

  // Quick Paste LRNs sequentially into active tab's students
  const handleApplyPastedLrns = () => {
    if (!pasteLrnText.trim()) return;
    const lrnCandidates = pasteLrnText
      .split(/[\r\n,;\t\s]+/)
      .map((item) => item.replace(/\D/g, '').trim())
      .filter((item) => item.length === 12);

    if (lrnCandidates.length === 0) {
      alert('No 12-digit LRNs found in pasted text. Please verify.');
      return;
    }

    let candidateIdx = 0;
    setStudents((prev) =>
      prev.map((s) => {
        if (selectedSheet !== 'all' && s.sheetName !== selectedSheet) return s;
        if (candidateIdx < lrnCandidates.length) {
          const newLrn = lrnCandidates[candidateIdx++];
          const isReady = LRN_REGEX.test(newLrn) && Boolean(s.aral_level);
          return {
            ...s,
            lrn: newLrn,
            status: isReady ? 'ready' : 'pending',
          };
        }
        return s;
      })
    );

    setIsPasteLrnOpen(false);
    setPasteLrnText('');
  };

  // Student field updater
  const updateStudentField = (id: string, field: keyof BatchParsedStudent, val: any) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: val };
        if (field === 'lrn') {
          updated.lrn = String(val).replace(/\D/g, '').slice(0, 12);
        } else if (field === 'aral_level') {
          if (val === 'plus' && updated.subject === 'Filipino') updated.subject = 'English';
          if (val === 'basic' && updated.subject === 'English') updated.subject = 'Filipino';
        }
        const isReady = LRN_REGEX.test(updated.lrn) && Boolean(updated.aral_level);
        updated.status = isReady ? 'ready' : 'pending';
        return updated;
      })
    );
  };

  // Delete student row
  const removeStudentRow = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  // Compute counts
  const totalCount = students.length;
  const readyCount = students.filter((s) => LRN_REGEX.test(s.lrn) && Boolean(s.aral_level)).length;
  const pendingCount = totalCount - readyCount;

  // Execute batch enrollment
  const handleEnrollAll = async () => {
    const readyStudents = students.filter((s) => LRN_REGEX.test(s.lrn) && Boolean(s.aral_level));
    if (readyStudents.length === 0) {
      setGlobalError('Please provide a 12-digit LRN and ARAL level for at least one student before enrolling.');
      return;
    }

    setIsSubmitting(true);
    setGlobalError(null);
    setEnrollProgress({ current: 0, total: readyStudents.length });

    let successCount = 0;
    let failCount = 0;
    const remainingStudents: BatchParsedStudent[] = [...students];

    for (let i = 0; i < readyStudents.length; i++) {
      const student = readyStudents[i];
      setEnrollProgress({ current: i + 1, total: readyStudents.length });

      const combinedGradeLevel = student.grade_level_section
        ? `${student.grade_level_grade} - ${student.grade_level_section}`
        : student.grade_level_grade;

      const payload = {
        role: 'student',
        first_name: student.first_name.trim().toUpperCase(),
        middle_name: student.middle_name.trim().toUpperCase(),
        last_name: student.last_name.trim().toUpperCase(),
        lrn: student.lrn.trim(),
        grade_level: combinedGradeLevel,
        assigned_tutor: student.assigned_tutor_id || null,
        aral_level: student.aral_level,
        tutor_type: student.aral_level,
        subject: student.subject,
        parent_guardian_name: student.parent_guardian_name.trim().toUpperCase(),
        contact_number: student.contact_number.trim(),
        has_bosy: student.has_bosy,
        has_mosy: student.has_mosy,
        has_eosy: student.has_eosy,
        has_summer: student.has_summer,
      };

      try {
        await userService.createUser(payload);
        successCount++;
        // Remove from list
        const idx = remainingStudents.findIndex((s) => s.id === student.id);
        if (idx !== -1) {
          remainingStudents.splice(idx, 1);
        }
      } catch (err: any) {
        failCount++;
        const errorData = err.response?.data;
        let msg = 'Failed to enroll student.';
        if (errorData) {
          const firstKey = Object.keys(errorData)[0];
          const val = errorData[firstKey];
          msg = Array.isArray(val) ? val[0] : typeof val === 'string' ? val : msg;
        }
        // Mark student as error
        const idx = remainingStudents.findIndex((s) => s.id === student.id);
        if (idx !== -1) {
          remainingStudents[idx] = {
            ...remainingStudents[idx],
            status: 'error',
            errorMessage: msg,
          };
        }
      }
    }

    setStudents(remainingStudents);
    setIsSubmitting(false);
    setEnrollProgress(null);
    setEnrollSummary({ success: successCount, failed: failCount });

    if (successCount > 0) {
      if (onEnrollmentSuccess) {
        onEnrollmentSuccess(successCount);
      }
      if (failCount === 0) {
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Batch Student Enrollment
                </h2>
                {fileName && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-medium">
                    {fileName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Import official DepEd BOSY List Excel file (.xlsx) with multi-tab class cohorts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* File Upload Banner (if no students parsed yet) */}
          {students.length === 0 && (
            <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-8 sm:p-12 text-center bg-slate-50/50 dark:bg-zinc-900/20 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInputChange}
                className="hidden"
                id="excel-file-input"
              />
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-4 shadow-xs">
                {isParsing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isParsing ? 'Reading and Parsing Excel Sheets...' : 'Upload DepEd Master List / BOSY Excel File'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto mt-1 mb-5">
                Upload a single workbook with multiple tabs per class (e.g. 7-HYA, 7-DAFF, 8-MANG). All sections, tutor assignments, names, subjects, and contacts will be automatically extracted!
              </p>
              <label
                htmlFor="excel-file-input"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Select Excel File (.xlsx)
              </label>

              {parseError && (
                <div className="mt-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 max-w-lg mx-auto flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* Parsed Students View */}
          {students.length > 0 && (
            <div className="space-y-4">
              {/* Top Banner: Status & Quick Re-upload */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>{totalCount} Total Students</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{readyCount} Ready to Enroll</span>
                  </div>
                  {pendingCount > 0 && (
                    <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{pendingCount} Need LRN / ARAL Level</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="excel-reupload-input"
                  />
                  <label
                    htmlFor="excel-reupload-input"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Change Excel File
                  </label>
                </div>
              </div>

              {/* Class Sheet Tabs (Multi-tab support) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedSheet('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                    selectedSheet === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All Classes ({totalCount})
                </button>
                {uniqueSheets.map(({ name, count }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedSheet(name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                      selectedSheet === name
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {name} ({count})
                  </button>
                ))}
              </div>

              {/* Bulk Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Bulk Actions:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSetAllAralLevel('basic')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 hover:bg-blue-100 transition cursor-pointer"
                  >
                    Set Visible to BASIC
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllAralLevel('plus')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/40 hover:bg-purple-100 transition cursor-pointer"
                  >
                    Set Visible to PLUS
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoMapAralLevel}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Auto-Map by Subject
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPasteLrnOpen(true)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1"
                  >
                    <ClipboardList className="w-3 h-3 text-emerald-600" />
                    Quick Paste LRNs
                  </button>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or section..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Paste LRNs Modal / Overlay */}
              {isPasteLrnOpen && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Sequential LRN Paste Helper
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPasteLrnOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Paste a list of 12-digit LRNs (copied from your master list column or text file). They will be assigned top-to-bottom to the students in the currently selected view.
                  </p>
                  <textarea
                    rows={3}
                    value={pasteLrnText}
                    onChange={(e) => setPasteLrnText(e.target.value)}
                    placeholder="e.g. 108501130001, 108501130002, 108501130003..."
                    className="w-full p-2.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPasteLrnOpen(false)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-200 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyPastedLrns}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Apply LRNs to Students
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications & Error messages */}
              {globalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{globalError}</span>
                </div>
              )}

              {enrollSummary && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      Successfully enrolled <strong>{enrollSummary.success}</strong> students!
                      {enrollSummary.failed > 0 && ` (${enrollSummary.failed} failed due to errors)`}
                    </span>
                  </div>
                </div>
              )}

              {/* Student Cards / Table */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-[#0c0d12]">
                <div className="overflow-x-auto max-h-[48vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Last Name</th>
                        <th className="py-2.5 px-3 min-w-[130px]">First Name</th>
                        <th className="py-2.5 px-3 min-w-[80px]">M.I.</th>
                        <th className="py-2.5 px-3 min-w-[140px]">
                          LRN <span className="text-red-500">*</span>
                        </th>
                        <th className="py-2.5 px-3 min-w-[110px]">
                          ARAL Level <span className="text-red-500">*</span>
                        </th>
                        <th className="py-2.5 px-3 min-w-[110px]">Subject</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Grade &amp; Section</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Assigned Tutor</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Parent / Guardian</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Contact No.</th>
                        <th className="py-2.5 px-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-8 text-center text-slate-400">
                            No students found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student, idx) => {
                          const hasValidLrn = LRN_REGEX.test(student.lrn);
                          const hasValidAral = Boolean(student.aral_level);
                          const isRowReady = hasValidLrn && hasValidAral;

                          return (
                            <tr
                              key={student.id}
                              className={`transition-colors ${
                                student.status === 'error'
                                  ? 'bg-rose-50/70 dark:bg-rose-950/20'
                                  : isRowReady
                                  ? 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                                  : 'bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/70'
                              }`}
                            >
                              <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Last Name */}
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white uppercase">
                                <input
                                  type="text"
                                  value={student.last_name}
                                  onChange={(e) => updateStudentField(student.id, 'last_name', e.target.value.toUpperCase())}
                                  className="w-full px-2 py-1 rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-emerald-500 bg-transparent uppercase text-xs"
                                />
                              </td>

                              {/* First Name */}
                              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 uppercase">
                                <input
                                  type="text"
                                  value={student.first_name}
                                  onChange={(e) => updateStudentField(student.id, 'first_name', e.target.value.toUpperCase())}
                                  className="w-full px-2 py-1 rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-emerald-500 bg-transparent uppercase text-xs"
                                />
                              </td>

                              {/* Middle Initial */}
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400 uppercase">
                                <input
                                  type="text"
                                  maxLength={5}
                                  value={student.middle_name}
                                  onChange={(e) => updateStudentField(student.id, 'middle_name', e.target.value.toUpperCase())}
                                  className="w-full px-1.5 py-1 rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-emerald-500 bg-transparent uppercase text-xs text-center"
                                />
                              </td>

                              {/* LRN (Required 12 digits) */}
                              <td className="py-2 px-3">
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={12}
                                    value={student.lrn}
                                    placeholder="12-digit LRN"
                                    onChange={(e) => updateStudentField(student.id, 'lrn', e.target.value)}
                                    className={`w-full pl-2 pr-7 py-1 text-xs font-mono font-bold rounded border uppercase shadow-2xs focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-zinc-800 dark:text-white ${
                                      hasValidLrn
                                        ? 'border-emerald-400 bg-emerald-50/40 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                                        : 'border-amber-300 bg-white dark:border-amber-700/80'
                                    }`}
                                  />
                                  {hasValidLrn && (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute right-2 top-2" />
                                  )}
                                </div>
                                {student.errorMessage && (
                                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">
                                    {student.errorMessage}
                                  </p>
                                )}
                              </td>

                              {/* ARAL Level */}
                              <td className="py-2 px-3">
                                <select
                                  value={student.aral_level}
                                  onChange={(e) => updateStudentField(student.id, 'aral_level', e.target.value)}
                                  className={`w-full px-2 py-1 text-xs font-semibold rounded border cursor-pointer dark:bg-zinc-800 dark:text-white ${
                                    student.aral_level === 'plus'
                                      ? 'border-purple-300 bg-purple-50/40 text-purple-900 dark:border-purple-800 dark:text-purple-300'
                                      : student.aral_level === 'basic'
                                      ? 'border-blue-300 bg-blue-50/40 text-blue-900 dark:border-blue-800 dark:text-blue-300'
                                      : 'border-amber-300 bg-white text-slate-400 dark:border-amber-700'
                                  }`}
                                >
                                  <option value="">Select Level...</option>
                                  <option value="basic">BASIC</option>
                                  <option value="plus">PLUS</option>
                                </select>
                              </td>

                              {/* Subject */}
                              <td className="py-2 px-3">
                                <select
                                  value={student.subject}
                                  onChange={(e) => updateStudentField(student.id, 'subject', e.target.value)}
                                  className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                                >
                                  {student.aral_level === 'plus' ? (
                                    <option value="English">English (Plus)</option>
                                  ) : (
                                    <option value="Filipino">Filipino (Basic)</option>
                                  )}
                                  <option value="Math">Math</option>
                                  <option value="Science">Science</option>
                                </select>
                              </td>

                              {/* Grade & Section */}
                              <td className="py-2 px-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                                  {student.grade_level_grade} - {student.grade_level_section}
                                </span>
                              </td>

                              {/* Tutor */}
                              <td className="py-2 px-3">
                                <select
                                  value={student.assigned_tutor_id || ''}
                                  onChange={(e) => {
                                    const tId = e.target.value || null;
                                    const tObj = tutors.find((t) => t.id === tId);
                                    updateStudentField(student.id, 'assigned_tutor_id', tId);
                                    updateStudentField(student.id, 'assigned_tutor_name', tObj?.full_name || 'TBA');
                                  }}
                                  className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 cursor-pointer truncate"
                                >
                                  <option value="">To Be Assigned (TBA)</option>
                                  {tutors.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.full_name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Parent / Guardian */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={student.parent_guardian_name}
                                  onChange={(e) => updateStudentField(student.id, 'parent_guardian_name', e.target.value.toUpperCase())}
                                  placeholder="Parent Name"
                                  className="w-full px-2 py-1 text-xs uppercase rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-emerald-500 bg-transparent text-slate-700 dark:text-slate-300"
                                />
                              </td>

                              {/* Contact Number */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={11}
                                  value={student.contact_number}
                                  onChange={(e) => updateStudentField(student.id, 'contact_number', e.target.value)}
                                  placeholder="09XXXXXXXXX"
                                  className="w-full px-2 py-1 text-xs rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-emerald-500 bg-transparent text-slate-700 dark:text-slate-300"
                                />
                              </td>

                              {/* Remove action */}
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  title="Remove row"
                                  onClick={() => removeStudentRow(student.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {students.length > 0 && (
              <span>
                Ready: <strong className="text-emerald-600">{readyCount}</strong> of {totalCount} students
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>

            {students.length > 0 && (
              <button
                type="button"
                onClick={handleEnrollAll}
                disabled={isSubmitting || readyCount === 0}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      Enrolling {enrollProgress?.current} of {enrollProgress?.total}...
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Enroll {readyCount} Ready Student{readyCount === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
