import React, { useState, useRef, useMemo } from 'react';
import ExcelJS from 'exceljs';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Trash2,
  Check,
  Search,
  Loader2,
} from 'lucide-react';
import { userService } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types';

export interface BatchParsedStudent {
  id: string; // client-side unique id for keying
  rowNumber: number; // original Excel row number (e.g. 5, 25)
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

const GRADE_LEVEL_OPTIONS = [
  'GRADE 7',
  'GRADE 8',
  'GRADE 9',
  'GRADE 10',
  'GRADE 11',
  'GRADE 12',
  'GRADE 1',
  'GRADE 2',
  'GRADE 3',
  'GRADE 4',
  'GRADE 5',
  'GRADE 6',
];

export const BatchStudentEnrollmentModal: React.FC<BatchStudentEnrollmentModalProps> = ({
  isOpen,
  onClose,
  tutors,
  onEnrollmentSuccess,
}) => {
  const { user: currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [students, setStudents] = useState<BatchParsedStudent[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Confirmation dialogs
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);
  const [showChangeFileConfirm, setShowChangeFileConfirm] = useState<boolean>(false);
  const [showEnrollConfirm, setShowEnrollConfirm] = useState<boolean>(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [enrollProgress, setEnrollProgress] = useState<{ current: number; total: number } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [enrollSummary, setEnrollSummary] = useState<{ success: number; failed: number } | null>(null);
  const [enrollScope, setEnrollScope] = useState<'all' | 'active'>('all');
  const [totalEnrolledCount, setTotalEnrolledCount] = useState<number>(0);

  // Pre-check against existing database records
  const [existingDbLrns, setExistingDbLrns] = useState<Set<string>>(new Set());
  const [isCheckingDbLrns, setIsCheckingDbLrns] = useState<boolean>(false);


  // Attempt close: prompt confirmation if students exist
  const handleAttemptClose = () => {
    if (isSubmitting) return;
    if (students.length > 0) {
      setShowCloseConfirm(true);
    } else {
      executeClose();
    }
  };

  const executeClose = () => {
    setShowCloseConfirm(false);
    setShowChangeFileConfirm(false);
    setShowEnrollConfirm(false);
    setStudents([]);
    setFileName('');
    setParseError(null);
    setGlobalError(null);
    setEnrollSummary(null);
    setSelectedSheet('all');
    setSearchQuery('');
    setExistingDbLrns(new Set());
    setIsCheckingDbLrns(false);
    setEnrollScope('all');
    setTotalEnrolledCount(0);
    onClose();
  };

  // Attempt change file: prompt confirmation if students exist
  const handleAttemptChangeFile = () => {
    if (isSubmitting) return;
    if (students.length > 0) {
      setShowChangeFileConfirm(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const executeChangeFile = () => {
    setShowChangeFileConfirm(false);
    setStudents([]);
    setFileName('');
    setParseError(null);
    setGlobalError(null);
    setEnrollSummary(null);
    setSelectedSheet('all');
    setSearchQuery('');
    setExistingDbLrns(new Set());
    setIsCheckingDbLrns(false);
    setEnrollScope('all');
    setTotalEnrolledCount(0);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
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

  // Reject non-name placeholders commonly found in school templates
  const isValidLearnerName = (name: string): boolean => {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim();
    if (clean.length < 2) return false;
    // Must contain at least two letters (a person's name cannot be "-", "0", ".", etc.)
    const lettersOnly = clean.replace(/[^a-zA-ZñÑ]/g, '');
    if (lettersOnly.length < 2) return false;
    // Reject system placeholders and table markers
    if (/^(N\/?A|NONE|NULL|NOTHING\s*FOLLOWS|TBD|TBA|VACANT|\-+|[0-9.]+|TOTAL.*|SUMMARY.*|PREPARED.*|CHECKED.*|NOTED.*|ADVISER.*|PRINCIPAL.*)$/i.test(clean)) {
      return false;
    }
    return true;
  };

  // Parse Philippine Name format: "LASTNAME, FIRSTNAME MIDDLEINITIAL"
  const parseLearnerName = (rawName: string): { last_name: string; first_name: string; middle_name: string } => {
    const clean = (rawName || '').trim().replace(/\s+/g, ' ');
    if (!clean || !isValidLearnerName(clean)) return { last_name: '', first_name: '', middle_name: '' };

    const commaIdx = clean.indexOf(',');
    if (commaIdx !== -1) {
      const lastName = clean.substring(0, commaIdx).trim().toUpperCase();
      const rest = clean.substring(commaIdx + 1).trim();
      const tokens = rest.split(' ').filter(Boolean);

      if (tokens.length > 1) {
        const lastToken = tokens[tokens.length - 1];
        if (lastToken.length <= 3 && /^[A-Za-z.]+$/.test(lastToken)) {
          let mi = lastToken.toUpperCase();
          if (mi && !mi.endsWith('.')) {
            mi = `${mi}.`;
          }
          return {
            last_name: lastName,
            first_name: tokens.slice(0, tokens.length - 1).join(' ').toUpperCase(),
            middle_name: mi,
          };
        }
      }
      return {
        last_name: lastName,
        first_name: rest.toUpperCase(),
        middle_name: '',
      };
    }

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

  // Process uploaded Excel file
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
      const seenStudentNamesAcrossSheets = new Set<string>();

      workbook.eachSheet((worksheet, sheetId) => {
        const sheetName = worksheet.name.trim();
        let sheetStudentCount = 0;
        let sheetHasBosyPopulated = false;

        let detectedGrade = 'GRADE 7';
        let detectedSection = '';

        // Match sheet/tab name: "7 - HYACINTH", "GRADE 7 - DAFFODIL", "7-AZALEA", "HYACINTH", etc.
        const cleanSheet = sheetName.trim();
        const tabWithGradeMatch = cleanSheet.match(/^(?:GRADE|G)?\s*(\d{1,2})\s*[-_–:\s]\s*([A-Za-z0-9\s\-]+)$/i);
        if (tabWithGradeMatch) {
          detectedGrade = `GRADE ${tabWithGradeMatch[1]}`;
          const rawSec = tabWithGradeMatch[2].trim().toUpperCase();
          detectedSection = SECTION_MAP[rawSec] || rawSec;
        } else {
          const upperSheet = cleanSheet.toUpperCase();
          if (SECTION_MAP[upperSheet]) {
            detectedSection = SECTION_MAP[upperSheet];
          } else if (cleanSheet && !/^Sheet\d+$/i.test(cleanSheet)) {
            detectedSection = upperSheet;
          }
        }

        let detectedTutorName = '';
        let detectedTutor: User | null = null;
        let headerRowIdx = -1;

        // Scan header area (rows 1-25)
        for (let r = 1; r <= 25; r++) {
          const row = worksheet.getRow(r);
          for (let c = 1; c <= 15; c++) {
            const cellVal = row.getCell(c).text?.trim() || '';
            if (!cellVal) continue;

            const gradeSecMatch = cellVal.match(
              /GRADE(?:\s*(?:LEVEL|&|\/|AND)?\s*SECTION)?[:\s]+(?:GRADE\s*)?(\d{1,2})\s*[-–:\s]\s*([A-Za-z0-9\s\-]+)/i
            );
            if (gradeSecMatch) {
              detectedGrade = `GRADE ${gradeSecMatch[1]}`;
              const rawSec = gradeSecMatch[2].trim().toUpperCase();
              detectedSection = SECTION_MAP[rawSec] || rawSec;
            } else {
              const secMatch = cellVal.match(/SECTION[:\s\-]+([A-Za-z0-9\s\-]+)/i);
              if (secMatch) {
                const rawSec = secMatch[1].trim().toUpperCase();
                detectedSection = SECTION_MAP[rawSec] || rawSec;
              }
              const gradeOnlyMatch = cellVal.match(/GRADE(?:\s*LEVEL)?[:\s]+(?:GRADE\s*)?(\d{1,2})\b/i);
              if (gradeOnlyMatch) {
                detectedGrade = `GRADE ${gradeOnlyMatch[1]}`;
              }
            }

            const tutorCellMatch = cellVal.match(/(?:TUTOR|TEACHER|ADVISER|FACILITATOR)[:\s]+([A-Za-z\s.\-ñÑ']+)/i);
            if (tutorCellMatch && !detectedTutorName) {
              detectedTutorName = tutorCellMatch[1].trim();
              detectedTutor = findMatchingTutor(detectedTutorName);
            }

            if (/Name of Learner/i.test(cellVal) || (/Learner/i.test(cellVal) && /No/i.test(row.getCell(1).text || ''))) {
              headerRowIdx = r;
            }
          }
        }

        if (!detectedSection) detectedSection = 'HYACINTH';
        if (!detectedGrade) detectedGrade = 'GRADE 7';

        if (!detectedTutorName) {
          for (let r = 35; r <= Math.min(worksheet.rowCount, 80); r++) {
            const row = worksheet.getRow(r);
            for (let c = 1; c <= 10; c++) {
              const text = row.getCell(c).text?.trim() || '';
              const match = text.match(/([A-Za-z\s.\-ñÑ']+)\s*\n?\(?(?:TUTOR|TEACHER|ADVISER)\)?/i);
              if (match) {
                detectedTutorName = match[1].trim();
                detectedTutor = findMatchingTutor(detectedTutorName);
                break;
              }
            }
            if (detectedTutorName) break;
          }
        }

        if (headerRowIdx === -1) {
          for (let r = 1; r <= 25; r++) {
            const row = worksheet.getRow(r);
            const a = row.getCell(1).text?.trim() || '';
            const b = row.getCell(2).text?.trim() || '';
            if (/^(No\.?|#)$/i.test(a) && /Name/i.test(b)) {
              headerRowIdx = r;
              break;
            }
          }
        }

        if (headerRowIdx === -1) return;

        const headerRow = worksheet.getRow(headerRowIdx);
        let colNo = -1;
        let colName = -1;
        let colBosy = -1;
        let colMosy = -1;
        let colEosy = -1;
        let colSubject = -1;
        let colGuardian = -1;
        let colContact = -1;
        let colLrn = -1;

        for (let c = 1; c <= 15; c++) {
          const colTitle = headerRow.getCell(c).text?.trim() || '';
          if (!colTitle) continue;

          if (colNo === -1 && /^(No\.?|#)$/i.test(colTitle) && !/Contact/i.test(colTitle)) colNo = c;
          else if (colName === -1 && /Name of Learner|Learner|Student Name/i.test(colTitle)) colName = c;
          else if (colBosy === -1 && /^BOSY/i.test(colTitle)) colBosy = c;
          else if (colMosy === -1 && /^MOSY/i.test(colTitle)) colMosy = c;
          else if (colEosy === -1 && /^EOSY/i.test(colTitle)) colEosy = c;
          else if (colSubject === -1 && /Subject/i.test(colTitle)) colSubject = c;
          else if (colGuardian === -1 && /Parent|Guardian/i.test(colTitle)) colGuardian = c;
          else if (colContact === -1 && /Contact|Phone|Mobile/i.test(colTitle)) colContact = c;
          else if (colLrn === -1 && /LRN/i.test(colTitle)) colLrn = c;
        }

        if (colNo === -1) colNo = 1;
        if (colName === -1) colName = 2;
        if (colBosy === -1) colBosy = 3;
        if (colMosy === -1) colMosy = 4;
        if (colEosy === -1) colEosy = 5;
        if (colSubject === -1) colSubject = 6;
        if (colGuardian === -1) colGuardian = 7;
        if (colContact === -1) colContact = 8;

        let consecutiveEmptyRows = 0;

        for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
          const row = worksheet.getRow(r);
          const rawNo = row.getCell(colNo).text?.trim() || '';
          const rawName = row.getCell(colName).text?.trim() || '';

          // Stop if footer section reached
          if (
            /Prepared|Checked|Noted|Adviser|Principal|Total|Summary|Certified|Verified/i.test(rawNo) ||
            /Prepared|Checked|Noted|Adviser|Principal|Total|Summary|Certified|Verified/i.test(rawName)
          ) {
            break;
          }

          // Stop if explicit "NOTHING FOLLOWS" marker
          if (/NOTHING\s*FOLLOWS|END\s*OF\s*LIST/i.test(rawName) || /NOTHING\s*FOLLOWS|END\s*OF\s*LIST/i.test(rawNo)) {
            break;
          }

          const cleanNo = rawNo.replace(/[.)#\s]/g, '');
          const isNumericNo = /^\d+$/.test(cleanNo);

          if (!isValidLearnerName(rawName)) {
            consecutiveEmptyRows++;
            // If 2 or more consecutive rows have no valid learner name, the list for this class has ended
            if (consecutiveEmptyRows >= 2) {
              break;
            }
            continue;
          }

          // In templates with a No. column, if row has no number after students have started
          if (colNo !== -1 && !rawNo && !isNumericNo && parsedList.some((p) => p.sheetName === sheetName)) {
            consecutiveEmptyRows++;
            if (consecutiveEmptyRows >= 2) {
              break;
            }
            continue;
          }

          consecutiveEmptyRows = 0;

          const { last_name, first_name, middle_name } = parseLearnerName(rawName);
          if (!last_name && !first_name) continue;

          const normKey = `${last_name}|${first_name}`.replace(/[^A-Z]/g, '');

          // Detect un-cleared template copies from earlier tabs:
          // When a teacher duplicates an earlier sheet (e.g. Tab 1) as a template for subsequent classes,
          // any students left at the bottom of the table are duplicates from the earlier sheet's roster.
          if (sheetStudentCount > 0 && seenStudentNamesAcrossSheets.has(normKey)) {
            break;
          }

          const rawBosy = row.getCell(colBosy).text?.trim().toUpperCase();
          const rawMosy = row.getCell(colMosy).text?.trim().toUpperCase();
          const rawEosy = row.getCell(colEosy).text?.trim().toUpperCase();
          const rawSubject = row.getCell(colSubject).text?.trim();

          // If preceding rows had BOSY populated and this row is completely empty for BOSY and Subject
          if (sheetHasBosyPopulated && !rawBosy && !rawSubject) {
            break;
          }

          if (rawBosy) {
            sheetHasBosyPopulated = true;
          }

          seenStudentNamesAcrossSheets.add(normKey);
          sheetStudentCount++;

          const cleanSubject = normalizeSubject(rawSubject);

          const rawGuardian = row.getCell(colGuardian).text?.trim() || '';
          const rawContact = row.getCell(colContact).value;
          const normalizedContact = normalizePhoneNumber(rawContact);

          const hasBosy = rawBosy === 'TRUE' || rawBosy === '1' || rawBosy === 'YES' || rawBosy === 'Y' || Boolean(rawBosy);
          const hasMosy = rawMosy === 'TRUE' || rawMosy === '1' || rawMosy === 'YES';
          const hasEosy = rawEosy === 'TRUE' || rawEosy === '1' || rawEosy === 'YES';

          const explicitLrn = colLrn !== -1 ? row.getCell(colLrn).text?.trim().replace(/\D/g, '') : '';

          parsedList.push({
            id: `student_${sheetId}_${r}_${Date.now()}_${Math.random()}`,
            rowNumber: r,
            sheetName,
            grade_level_grade: detectedGrade,
            grade_level_section: detectedSection,
            first_name,
            middle_name,
            last_name,
            lrn: explicitLrn || '',
            aral_level: '', // LRN and ARAL level not in template, manual input required
            subject: cleanSubject,
            assigned_tutor_id: detectedTutor ? detectedTutor.id : null,
            assigned_tutor_name: detectedTutor ? detectedTutor.full_name : detectedTutorName || 'To Be Assigned',
            parent_guardian_name: rawGuardian.toUpperCase(),
            contact_number: normalizedContact,
            has_bosy: hasBosy,
            has_mosy: hasMosy,
            has_eosy: hasEosy,
            has_summer: false,
            status: 'pending',
          });
        }
      });

      if (parsedList.length === 0) {
        setParseError('No learner rows could be extracted from this Excel file. Please ensure the file follows the specified column format.');
      } else {
        setStudents(parsedList);

        // Pre-check against existing database records immediately
        const validLrns = Array.from(new Set(parsedList.map((s) => s.lrn.trim()).filter((l) => LRN_REGEX.test(l))));
        if (validLrns.length > 0) {
          setIsCheckingDbLrns(true);
          try {
            const foundInDb = await userService.checkExistingLrns(validLrns);
            setExistingDbLrns(new Set(foundInDb));
          } catch (checkErr) {
            console.error('Failed to pre-check existing LRNs in DB:', checkErr);
          } finally {
            setIsCheckingDbLrns(false);
          }
        } else {
          setExistingDbLrns(new Set());
        }
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

  // Distinct sheets
  const uniqueSheets = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      map.set(s.sheetName, (map.get(s.sheetName) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [students]);

  // Filtered students
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
          s.grade_level_grade.toLowerCase().includes(q) ||
          s.grade_level_section.toLowerCase().includes(q) ||
          s.parent_guardian_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, selectedSheet, searchQuery]);

  // Bulk actions: Set visible to Basic or Plus (scope can be 'all' or 'active')
  const handleSetAllAralLevel = (level: 'basic' | 'plus', scope: 'all' | 'active' = 'all') => {
    setStudents((prev) =>
      prev.map((s) => {
        if (scope === 'active' && selectedSheet !== 'all' && s.sheetName !== selectedSheet) return s;
        const newSubject = level === 'plus' && s.subject === 'Filipino' ? 'English' : level === 'basic' && s.subject === 'English' ? 'Filipino' : s.subject;
        const isReady = LRN_REGEX.test(s.lrn) && Boolean(level) && !s.errorMessage;
        return {
          ...s,
          aral_level: level,
          subject: newSubject,
          status: isReady ? 'ready' : 'pending',
        };
      })
    );
  };

  // Update single student field
  const updateStudentField = (id: string, field: keyof BatchParsedStudent, val: any) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: val };
        delete updated.errorMessage;
        if (field === 'lrn') {
          updated.lrn = String(val).replace(/\D/g, '').slice(0, 12);
        } else if (field === 'grade_level_grade') {
          updated.grade_level_grade = String(val).toUpperCase();
        } else if (field === 'grade_level_section') {
          updated.grade_level_section = String(val).toUpperCase();
        } else if (field === 'middle_name') {
          updated.middle_name = String(val).toUpperCase();
        } else if (field === 'aral_level') {
          if (val === 'plus' && updated.subject === 'Filipino') updated.subject = 'English';
          if (val === 'basic' && updated.subject === 'English') updated.subject = 'Filipino';
        }
        const isReady = LRN_REGEX.test(updated.lrn) && Boolean(updated.aral_level);
        updated.status = isReady ? 'ready' : 'pending';
        return updated;
      })
    );

    if (field === 'lrn') {
      const clean = String(val).replace(/\D/g, '').slice(0, 12);
      if (LRN_REGEX.test(clean)) {
        userService.checkExistingLrns([clean]).then((res) => {
          setExistingDbLrns((prev) => {
            const next = new Set(prev);
            if (res.includes(clean)) {
              next.add(clean);
            } else {
              next.delete(clean);
            }
            return next;
          });
        }).catch((err) => console.error('Error verifying edited LRN in DB:', err));
      }
    }
  };

  // Remove row
  const removeStudentRow = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  // ── 1. Intra-File Duplicate Pre-Detection ────────────────────────────────────
  // Map of 12-digit LRN -> array of student ID & Excel row number
  const intraFileLrnMap = useMemo(() => {
    const map = new Map<string, { id: string; rowNumber: number }[]>();
    students.forEach((s) => {
      const clean = (s.lrn || '').trim();
      if (clean && LRN_REGEX.test(clean)) {
        if (!map.has(clean)) {
          map.set(clean, []);
        }
        map.get(clean)!.push({ id: s.id, rowNumber: s.rowNumber });
      }
    });
    return map;
  }, [students]);

  // Students flagged with intra-file duplicate LRNs
  const duplicateLrnStudents = useMemo(() => {
    return students.filter((s) => {
      const clean = (s.lrn || '').trim();
      if (!clean || !LRN_REGEX.test(clean)) return false;
      const dups = intraFileLrnMap.get(clean);
      return dups && dups.length > 1;
    });
  }, [students, intraFileLrnMap]);

  const duplicateLrnCount = duplicateLrnStudents.length;

  // ── 2. Pre-check Against Existing Database LRNs ──────────────────────────────
  const alreadyEnrolledStudents = useMemo(() => {
    return students.filter((s) => {
      const clean = (s.lrn || '').trim();
      return clean && existingDbLrns.has(clean);
    });
  }, [students, existingDbLrns]);

  const existingDbLrnCount = alreadyEnrolledStudents.length;

  // Helper to get LRN-specific validation error for each row
  const getRowLrnError = (student: BatchParsedStudent): string | null => {
    if (student.errorMessage) return student.errorMessage;
    const clean = (student.lrn || '').trim();
    if (!clean) return null; // Missing LRN is indicated by missing state
    if (!LRN_REGEX.test(clean)) return 'LRN must be exactly 12 digits.';

    // 1. Check intra-file duplicates
    const dups = intraFileLrnMap.get(clean);
    if (dups && dups.length > 1) {
      const rowList = dups.map((d) => `Excel Row ${d.rowNumber}`).join(' & ');
      return `Duplicate LRN detected in file (${rowList})`;
    }

    // 2. Check already enrolled in database
    if (existingDbLrns.has(clean)) {
      return 'Already Enrolled in System';
    }

    return null;
  };

  // Active students based on current tab filter
  const activeStudents = useMemo(() => {
    if (selectedSheet === 'all') return students;
    return students.filter((s) => s.sheetName === selectedSheet);
  }, [students, selectedSheet]);

  const totalCount = students.length;
  const totalNeedLrnCount = students.filter((s) => !LRN_REGEX.test((s.lrn || '').trim())).length;
  const totalNeedAralCount = students.filter((s) => !s.aral_level).length;
  const totalDuplicateLrnCount = duplicateLrnCount;
  const totalExistingDbLrnCount = existingDbLrnCount;
  const totalErrorCount = students.filter((s) => s.status === 'error' || Boolean(s.errorMessage)).length;
  const totalReadyCount = students.filter(
    (s) => LRN_REGEX.test((s.lrn || '').trim()) && Boolean(s.aral_level) && !getRowLrnError(s) && s.status !== 'error'
  ).length;

  const activeTotalCount = activeStudents.length;
  const activeNeedLrnCount = activeStudents.filter((s) => !LRN_REGEX.test((s.lrn || '').trim())).length;
  const activeNeedAralCount = activeStudents.filter((s) => !s.aral_level).length;
  const activeDuplicateLrnCount = activeStudents.filter((s) => {
    const clean = (s.lrn || '').trim();
    if (!clean || !LRN_REGEX.test(clean)) return false;
    const dups = intraFileLrnMap.get(clean);
    return dups && dups.length > 1;
  }).length;
  const activeExistingDbLrnCount = activeStudents.filter((s) => {
    const clean = (s.lrn || '').trim();
    return clean && existingDbLrns.has(clean);
  }).length;
  const activeErrorCount = activeStudents.filter((s) => s.status === 'error' || Boolean(s.errorMessage)).length;
  const activeReadyCount = activeStudents.filter(
    (s) => LRN_REGEX.test((s.lrn || '').trim()) && Boolean(s.aral_level) && !getRowLrnError(s) && s.status !== 'error'
  ).length;

  // Disabled logic for ENROLL buttons
  const canEnrollAll =
    totalCount > 0 &&
    totalNeedLrnCount === 0 &&
    totalNeedAralCount === 0 &&
    totalDuplicateLrnCount === 0 &&
    totalExistingDbLrnCount === 0 &&
    totalErrorCount === 0 &&
    !isSubmitting &&
    !isCheckingDbLrns;

  const canEnrollActive =
    activeTotalCount > 0 &&
    activeNeedLrnCount === 0 &&
    activeNeedAralCount === 0 &&
    activeDuplicateLrnCount === 0 &&
    activeExistingDbLrnCount === 0 &&
    activeErrorCount === 0 &&
    !isSubmitting &&
    !isCheckingDbLrns;

  const getDisabledReason = (scope: 'all' | 'active' = 'all') => {
    const isAll = scope === 'all';
    const tCount = isAll ? totalCount : activeTotalCount;
    const needLrn = isAll ? totalNeedLrnCount : activeNeedLrnCount;
    const needAral = isAll ? totalNeedAralCount : activeNeedAralCount;
    const dupLrn = isAll ? totalDuplicateLrnCount : activeDuplicateLrnCount;
    const existingDb = isAll ? totalExistingDbLrnCount : activeExistingDbLrnCount;
    const errCount = isAll ? totalErrorCount : activeErrorCount;
    const scopeLabel = isAll ? 'in file' : `in ${selectedSheet}`;

    if (tCount === 0) return `No students ${scopeLabel}.`;
    if (isCheckingDbLrns) return 'Checking student LRNs against existing database records...';
    if (errCount > 0) {
      return `Cannot enroll: ${errCount} student(s) encountered errors. Please resolve or remove the affected rows before retrying.`;
    }
    if (dupLrn > 0 && existingDb > 0) {
      return `Cannot enroll: ${dupLrn} student(s) have duplicate LRNs in file, and ${existingDb} student(s) already enrolled in system.`;
    }
    if (dupLrn > 0) {
      return `Cannot enroll: Duplicate LRN detected in file. Please resolve or remove duplicate rows before enrolling.`;
    }
    if (existingDb > 0) {
      return `Cannot enroll: ${existingDb} student(s) already enrolled in the system. Please remove or update already enrolled students.`;
    }
    if (needLrn > 0 && needAral > 0) {
      return `Cannot enroll: ${needLrn} student(s) missing 12-digit LRN, and ${needAral} student(s) missing ARAL Level. All students ${scopeLabel} must have complete details before enrolling.`;
    }
    if (needLrn > 0) {
      return `Cannot enroll: ${needLrn} student(s) missing 12-digit LRN. All students must have a valid 12-digit LRN.`;
    }
    if (needAral > 0) {
      return `Cannot enroll: ${needAral} student(s) missing ARAL Level. Please assign BASIC or PLUS before enrolling.`;
    }
    return '';
  };

  // Execute batch enrollment for all classes or active tab
  const handleEnrollConfirmed = async () => {
    setShowEnrollConfirm(false);
    setIsSubmitting(true);
    setGlobalError(null);

    const studentsToEnroll = enrollScope === 'all' ? [...students] : [...activeStudents];
    setEnrollProgress({ current: 0, total: studentsToEnroll.length });

    let successCount = 0;
    let failCount = 0;
    let remainingStudents: BatchParsedStudent[] = [...students];

    for (let i = 0; i < studentsToEnroll.length; i++) {
      const student = studentsToEnroll[i];
      setEnrollProgress({ current: i + 1, total: studentsToEnroll.length });

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
        remainingStudents = remainingStudents.filter((s) => s.id !== student.id);
      } catch (err: any) {
        failCount++;
        const errorData = err.response?.data;
        let msg = 'Failed to enroll student.';
        if (errorData) {
          const firstKey = Object.keys(errorData)[0];
          const val = errorData[firstKey];
          msg = Array.isArray(val) ? val[0] : typeof val === 'string' ? val : msg;
        }
        remainingStudents = remainingStudents.map((s) =>
          s.id === student.id
            ? { ...s, status: 'error', errorMessage: msg }
            : s
        );
      }
    }

    setStudents(remainingStudents);
    setIsSubmitting(false);
    setEnrollProgress(null);

    const newCumulative = totalEnrolledCount + successCount;
    setTotalEnrolledCount(newCumulative);
    setEnrollSummary({ success: successCount, failed: failCount });

    // ONLY close and notify parent if 100% of all students across the entire batch have succeeded and ZERO errors exist!
    if (remainingStudents.length === 0 && failCount === 0) {
      if (onEnrollmentSuccess) {
        onEnrollmentSuccess(newCumulative);
      }
      setTimeout(() => {
        executeClose();
      }, 1500);
    } else {
      // KEEP MODAL OPEN!
      // Do NOT trigger onEnrollmentSuccess (which would prematurely close/navigate CreateUser)
      // Do NOT auto-close modal!
      if (failCount > 0) {
        setGlobalError(
          `${failCount} student record(s) encountered an error during enrollment. The modal will remain open so you can review and correct the errors below.`
        );
      } else if (remainingStudents.length > 0 && selectedSheet !== 'all') {
        const stillInThisSheet = remainingStudents.some((s) => s.sheetName === selectedSheet);
        if (!stillInThisSheet) {
          const nextSheet = remainingStudents[0]?.sheetName || 'all';
          setSelectedSheet(nextSheet);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-zinc-800 rounded-2xl w-[98vw] max-w-[1550px] max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Hidden Global File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInputChange}
          className="hidden"
          id="excel-file-hidden-input"
        />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                BATCH STUDENT ENROLLMENT
              </h2>
              {fileName && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-medium">
                  {fileName}
                </span>
              )}
            </div>
            {students.length > 0 && (
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5">
                Please always double check all the details
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {students.length > 0 && (
              <button
                type="button"
                onClick={handleAttemptChangeFile}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Change Excel File
              </button>
            )}
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-40"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* File Upload Dropzone (Initial State) */}
          {students.length === 0 && (
            <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-8 sm:p-12 text-center bg-slate-50/50 dark:bg-zinc-900/20 hover:border-[var(--brand)] transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-[var(--brand-light)] text-[var(--brand)] mx-auto flex items-center justify-center mb-4 shadow-xs">
                {isParsing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                {isParsing ? 'Reading and Parsing Excel Sheets...' : 'Upload Excel File Master List'}
              </h3>

              {/* Requirement explanation & template guidance */}
              <div className="max-w-2xl mx-auto mt-3 mb-6 text-xs text-slate-600 dark:text-zinc-300 space-y-2.5 text-left bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                <p className="font-semibold text-slate-800 dark:text-white">
                  Upload a single Excel file (multiple tabs in a single file are supported).
                </p>
                <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-zinc-400">
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">Table Column Headers:</strong> Each class table must have columns named:{' '}
                    <code className="text-[var(--brand)] font-mono font-bold">No.</code>,{' '}
                    <code className="text-[var(--brand)] font-mono font-bold">Name of Learner</code> (LASTNAME, FIRSTNAME M.I.),{' '}
                    <code className="text-[var(--brand)] font-mono font-bold">BOSY</code>,{' '}
                    <code className="text-[var(--brand)] font-mono font-bold">MOSY</code>,{' '}
                    <code className="text-[var(--brand)] font-mono font-bold">EOSY</code>,{' '}
                    <code className="text-[var(--brand)] font-mono font-bold">Subject Focus</code>,{' '}
                    <code className="text-[var(--brand)] font-mono font-bold">Parent/Guardian</code>,{' '}
                    <code className="text-[var(--brand)] font-mono font-bold">Contact No.</code>
                  </p>
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">Top Header Format:</strong> At the top of each sheet/table, specify Grade Level &amp; Section (e.g.{' '}
                    <code className="font-mono bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-slate-800 dark:text-slate-200">GRADE LEVEL: 7 - HYACINTH</code>) and the assigned Tutor (e.g.{' '}
                    <code className="font-mono bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-slate-800 dark:text-slate-200">TUTOR: JUAN D. CRUZ</code>).
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 pt-1.5 border-t border-slate-100 dark:border-zinc-800 font-medium">
                    Important Notice: LRN and ARAL Level are not supported in the template; they must be manually inputted and double checked. Please always double check all the details to avoid mistakes.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-bold uppercase tracking-wider shadow-md transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Select Excel File (.xlsx)
              </button>

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
            <div className="space-y-3.5">
              {/* 1. Stats Line Enclosed in Gray Containers */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100/90 dark:bg-zinc-800/80 font-bold text-slate-900 dark:text-white shadow-2xs">
                  <Users className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span>
                    {activeTotalCount} {selectedSheet === 'all' ? 'Total Students' : `Students in ${selectedSheet}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100/90 dark:bg-zinc-800/80 font-semibold text-emerald-700 dark:text-emerald-400 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{activeReadyCount} Ready to Enroll</span>
                </div>
                {activeErrorCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 font-semibold text-rose-600 dark:text-rose-400 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>{activeErrorCount} Need Correction</span>
                  </div>
                )}
                {activeDuplicateLrnCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 font-semibold text-rose-600 dark:text-rose-400 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>{activeDuplicateLrnCount} Duplicate in File</span>
                  </div>
                )}
                {activeExistingDbLrnCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 font-semibold text-rose-600 dark:text-rose-400 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>{activeExistingDbLrnCount} Already in System</span>
                  </div>
                )}
                {isCheckingDbLrns && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 font-semibold text-sky-700 dark:text-sky-300 shadow-2xs animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking Database Records...</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100/90 dark:bg-zinc-800/80 font-semibold text-red-600 dark:text-red-400 shadow-2xs">
                  <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span>{activeNeedLrnCount} Need LRN</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100/90 dark:bg-zinc-800/80 font-semibold text-red-600 dark:text-red-400 shadow-2xs">
                  <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span>{activeNeedAralCount} Need ARAL Level</span>
                </div>
              </div>

              {/* 2. Bulk Actions Row (Above Class tabs, ARALert Brand Blue Buttons) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetAllAralLevel('basic', 'all')}
                    className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white shadow-xs transition-colors cursor-pointer"
                    title={`Assign BASIC to all ${totalCount} students across all classes in file`}
                  >
                    SET ALL TO BASIC ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllAralLevel('plus', 'all')}
                    className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white shadow-xs transition-colors cursor-pointer"
                    title={`Assign PLUS to all ${totalCount} students across all classes in file`}
                  >
                    SET ALL TO PLUS ({totalCount})
                  </button>
                  {selectedSheet !== 'all' && (
                    <>
                      <span className="text-slate-300 dark:text-zinc-700 hidden sm:inline">|</span>
                      <button
                        type="button"
                        onClick={() => handleSetAllAralLevel('basic', 'active')}
                        className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                        title={`Assign BASIC only to ${selectedSheet} (${activeTotalCount} students)`}
                      >
                        Set {selectedSheet} to Basic ({activeTotalCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllAralLevel('plus', 'active')}
                        className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                        title={`Assign PLUS only to ${selectedSheet} (${activeTotalCount} students)`}
                      >
                        Set {selectedSheet} to Plus ({activeTotalCount})
                      </button>
                    </>
                  )}
                </div>

                {/* Search input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or section..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </div>
              </div>

              {/* 3. Class Tabs Row (ARALert Brand Blue for Active Tab) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedSheet('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                    selectedSheet === 'all'
                      ? 'bg-[var(--brand)] text-white shadow-xs'
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
                        ? 'bg-[var(--brand)] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {name} ({count})
                  </button>
                ))}
              </div>

              {/* Notifications & Error messages */}
              {globalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{globalError}</span>
                </div>
              )}

              {enrollSummary && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                    enrollSummary.failed > 0
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                      : 'bg-[var(--brand-light)] border-[var(--brand-border)] text-[var(--brand-dark)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {enrollSummary.failed > 0 ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-[var(--brand)] shrink-0" />
                    )}
                    <span>
                      {enrollSummary.success > 0 && (
                        <>
                          Successfully enrolled <strong>{enrollSummary.success}</strong> student
                          {enrollSummary.success === 1 ? '' : 's'}!{' '}
                        </>
                      )}
                      {enrollSummary.failed > 0 ? (
                        <strong>
                          {enrollSummary.failed} student{enrollSummary.failed === 1 ? '' : 's'} encountered an error. Please review and resolve the highlighted errors below before retrying.
                        </strong>
                      ) : students.length > 0 ? (
                        <span className="text-slate-600 dark:text-zinc-400">
                          ({students.length} student{students.length === 1 ? '' : 's'} remaining across classes)
                        </span>
                      ) : (
                        <strong>All students successfully enrolled!</strong>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* 4. Student Table with Column & Row Lines */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-[#0c0d12]">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800">
                      <tr className="divide-x divide-slate-200 dark:divide-zinc-800">
                        <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200 dark:border-zinc-800">#</th>
                        <th className="py-2.5 px-3 min-w-[130px] border-r border-slate-200 dark:border-zinc-800">Last Name</th>
                        <th className="py-2.5 px-3 min-w-[130px] border-r border-slate-200 dark:border-zinc-800">First Name</th>
                        <th className="py-2.5 px-3 min-w-[75px] border-r border-slate-200 dark:border-zinc-800">M.I.</th>
                        <th className="py-2.5 px-3 min-w-[145px] border-r border-slate-200 dark:border-zinc-800">
                          LRN <span className="text-red-500">*</span>
                        </th>
                        <th className="py-2.5 px-3 min-w-[125px] border-r border-slate-200 dark:border-zinc-800">
                          ARAL Level <span className="text-red-500">*</span>
                        </th>
                        <th className="py-2.5 px-3 min-w-[120px] border-r border-slate-200 dark:border-zinc-800">Subject</th>
                        <th className="py-2.5 px-3 min-w-[125px] border-r border-slate-200 dark:border-zinc-800">Grade Level</th>
                        <th className="py-2.5 px-3 min-w-[130px] border-r border-slate-200 dark:border-zinc-800">Section</th>
                        <th className="py-2.5 px-3 min-w-[160px] border-r border-slate-200 dark:border-zinc-800">Assigned Tutor</th>
                        <th className="py-2.5 px-3 min-w-[150px] border-r border-slate-200 dark:border-zinc-800">Parent / Guardian</th>
                        <th className="py-2.5 px-3 min-w-[120px] border-r border-slate-200 dark:border-zinc-800">Contact No.</th>
                        <th className="py-2.5 px-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-10 text-center text-slate-400">
                            No students found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student, idx) => {
                          const lrnError = getRowLrnError(student);
                          const hasValidLrn = LRN_REGEX.test((student.lrn || '').trim()) && !lrnError;
                          const hasValidAral = Boolean(student.aral_level);
                          const isRowReady = hasValidLrn && hasValidAral && student.status !== 'error';
                          const isErrorRow = Boolean(lrnError) || student.status === 'error';

                          return (
                            <tr
                              key={student.id}
                              className={`divide-x divide-slate-200 dark:divide-zinc-800 transition-colors ${
                                isErrorRow
                                  ? 'bg-rose-50/70 dark:bg-rose-950/20'
                                  : isRowReady
                                  ? 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                                  : 'bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50/60'
                              }`}
                            >
                              <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 dark:border-zinc-800">
                                {idx + 1}
                              </td>

                              {/* Last Name */}
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white uppercase border-r border-slate-200 dark:border-zinc-800">
                                <input
                                  type="text"
                                  value={student.last_name}
                                  onChange={(e) => updateStudentField(student.id, 'last_name', e.target.value.toUpperCase())}
                                  className="w-full px-2 py-1 rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-[var(--brand)] bg-transparent uppercase text-xs"
                                />
                              </td>

                              {/* First Name */}
                              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 uppercase border-r border-slate-200 dark:border-zinc-800">
                                <input
                                  type="text"
                                  value={student.first_name}
                                  onChange={(e) => updateStudentField(student.id, 'first_name', e.target.value.toUpperCase())}
                                  className="w-full px-2 py-1 rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-[var(--brand)] bg-transparent uppercase text-xs"
                                />
                              </td>

                              {/* Middle Initial */}
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-zinc-800">
                                <input
                                  type="text"
                                  maxLength={5}
                                  value={student.middle_name}
                                  onChange={(e) => updateStudentField(student.id, 'middle_name', e.target.value.toUpperCase())}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val && !val.endsWith('.')) {
                                      updateStudentField(student.id, 'middle_name', `${val}.`);
                                    }
                                  }}
                                  className="w-full px-1.5 py-1 rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-[var(--brand)] bg-transparent uppercase text-xs text-center font-medium"
                                />
                              </td>

                              {/* LRN (Required 12 digits) */}
                              <td className="py-2 px-3 border-r border-slate-200 dark:border-zinc-800">
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={12}
                                    value={student.lrn}
                                    placeholder="12-digit LRN"
                                    onChange={(e) => updateStudentField(student.id, 'lrn', e.target.value)}
                                    className={`w-full pl-2 pr-7 py-1 text-xs font-mono font-bold rounded border uppercase shadow-2xs focus:outline-none focus:ring-1 focus:ring-[var(--brand)] dark:bg-zinc-800 dark:text-white ${
                                      isErrorRow
                                        ? 'border-rose-400 bg-rose-50/60 text-rose-900 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-200'
                                        : hasValidLrn
                                        ? 'border-emerald-400 bg-emerald-50/40 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                                        : 'border-red-300 bg-white dark:border-red-700/80'
                                    }`}
                                  />
                                  {isErrorRow ? (
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 absolute right-2 top-2" />
                                  ) : hasValidLrn ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute right-2 top-2" />
                                  ) : null}
                                </div>
                                {isErrorRow && (
                                  <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                                    <span>{student.errorMessage || lrnError}</span>
                                  </p>
                                )}
                              </td>

                              {/* ARAL Level (Clean Neutral Style) */}
                              <td className="py-2 px-3 border-r border-slate-200 dark:border-zinc-800">
                                <select
                                  value={student.aral_level}
                                  onChange={(e) => updateStudentField(student.id, 'aral_level', e.target.value)}
                                  className="w-full px-2 py-1 text-xs font-semibold rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                                >
                                  <option value="">Select Level...</option>
                                  <option value="basic">BASIC</option>
                                  <option value="plus">PLUS</option>
                                </select>
                              </td>

                              {/* Subject */}
                              <td className="py-2 px-3 border-r border-slate-200 dark:border-zinc-800">
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

                              {/* Grade Level */}
                              <td className="py-2 px-3 border-r border-slate-200 dark:border-zinc-800">
                                <select
                                  value={student.grade_level_grade}
                                  onChange={(e) => updateStudentField(student.id, 'grade_level_grade', e.target.value)}
                                  className="w-full px-2 py-1 text-xs font-semibold rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                                >
                                  {!GRADE_LEVEL_OPTIONS.includes(student.grade_level_grade) && student.grade_level_grade && (
                                    <option value={student.grade_level_grade}>{student.grade_level_grade}</option>
                                  )}
                                  {GRADE_LEVEL_OPTIONS.map((g) => (
                                    <option key={g} value={g}>
                                      {g}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Section */}
                              <td className="py-2 px-3 border-r border-slate-200 dark:border-zinc-800">
                                <input
                                  type="text"
                                  value={student.grade_level_section}
                                  onChange={(e) => updateStudentField(student.id, 'grade_level_section', e.target.value.toUpperCase())}
                                  placeholder="SECTION"
                                  className={`w-full px-2 py-1 text-xs uppercase font-medium rounded border transition-colors bg-transparent ${
                                    !student.grade_level_section?.trim()
                                      ? 'border-amber-300 dark:border-amber-700 bg-amber-50/20'
                                      : 'border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-[var(--brand)] text-slate-800 dark:text-slate-200'
                                  }`}
                                />
                              </td>

                              {/* Tutor */}
                              <td className="py-2 px-3 border-r border-slate-200 dark:border-zinc-800">
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
                              <td className="py-2 px-3 border-r border-slate-200 dark:border-zinc-800">
                                <input
                                  type="text"
                                  value={student.parent_guardian_name}
                                  onChange={(e) => updateStudentField(student.id, 'parent_guardian_name', e.target.value.toUpperCase())}
                                  placeholder="Parent Name"
                                  className="w-full px-2 py-1 text-xs uppercase rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-[var(--brand)] bg-transparent text-slate-700 dark:text-slate-300"
                                />
                              </td>

                              {/* Contact Number */}
                              <td className="py-2 px-3 border-r border-slate-200 dark:border-zinc-800">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={11}
                                  value={student.contact_number}
                                  onChange={(e) => updateStudentField(student.id, 'contact_number', e.target.value)}
                                  placeholder="09XXXXXXXXX"
                                  className="w-full px-2 py-1 text-xs rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 focus:border-[var(--brand)] bg-transparent text-slate-700 dark:text-slate-300"
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
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Ready: <strong className="text-[var(--brand)]">{totalReadyCount}</strong> of {totalCount} total students
                  {selectedSheet !== 'all' ? ` (${activeReadyCount} of ${activeTotalCount} in ${selectedSheet})` : ''}
                </span>
                {!canEnrollAll && getDisabledReason('all') && (
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{getDisabledReason('all')}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-40 uppercase"
            >
              Cancel
            </button>

            {students.length > 0 && selectedSheet !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  if (canEnrollActive) {
                    setEnrollScope('active');
                    setShowEnrollConfirm(true);
                  }
                }}
                disabled={!canEnrollActive || isSubmitting}
                title={getDisabledReason('active')}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 uppercase ${
                  canEnrollActive && !isSubmitting
                    ? 'border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand)]/10 cursor-pointer'
                    : 'border-slate-300 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 cursor-not-allowed opacity-60'
                }`}
              >
                <span>ENROLL ONLY {selectedSheet} ({activeTotalCount})</span>
              </button>
            )}

            {students.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (canEnrollAll) {
                    setEnrollScope('all');
                    setShowEnrollConfirm(true);
                  }
                }}
                disabled={!canEnrollAll || isSubmitting}
                title={getDisabledReason('all')}
                className={`px-5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 uppercase shadow-md ${
                  canEnrollAll && !isSubmitting
                    ? 'bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white cursor-pointer'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed opacity-60'
                }`}
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
                      ENROLL ALL CLASSES ({totalCount})
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog: Close Batch Enrollment */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#11131a] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">
                  Close Batch Student Enrollment?
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {totalEnrolledCount > 0 ? (
                    <>
                      You have enrolled <strong>{totalEnrolledCount}</strong> student{totalEnrolledCount === 1 ? '' : 's'} so far. Are you sure you want to exit? The remaining {students.length} student record{students.length === 1 ? '' : 's'} will not be enrolled.
                    </>
                  ) : (
                    'Are you sure you want to close the batch student enrollment? Any imported and inputted data will be cleared.'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer uppercase"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (totalEnrolledCount > 0 && onEnrollmentSuccess) {
                    onEnrollmentSuccess(totalEnrolledCount);
                  }
                  executeClose();
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white transition-colors cursor-pointer uppercase shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Change Excel File */}
      {showChangeFileConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#11131a] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">
                  Change File?
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Are you sure you want to change file? Any imported and inputted data will be cleared.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowChangeFileConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer uppercase"
              >
                Back
              </button>
              <button
                type="button"
                onClick={executeChangeFile}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white transition-colors cursor-pointer uppercase shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Double Check Details Before Enrolling */}
      {showEnrollConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#11131a] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">
                  Confirm Student Enrollment
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Have you double checked each student's details for{' '}
                  <strong className="text-slate-800 dark:text-white">
                    {enrollScope === 'all'
                      ? `All Classes (${totalCount} students)`
                      : `${selectedSheet} (${activeTotalCount} students)`}
                  </strong>? Please ensure all names, grade levels, sections, subjects, tutors, LRNs, and ARAL levels are completely accurate before finalizing enrollment.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowEnrollConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer uppercase"
              >
                BACK
              </button>
              <button
                type="button"
                onClick={handleEnrollConfirmed}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white transition-colors cursor-pointer uppercase shadow-xs"
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
