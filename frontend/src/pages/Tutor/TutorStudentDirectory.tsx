import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ChevronRight } from 'lucide-react';

export const TutorStudentDirectory: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = async () => {
    if (!user) return;
    try {
      const data = await userService.getUsers({ role: 'student', assigned_tutor: user.id });
      setStudents(data.results);
    } catch (err) {
      console.error(err);
      setError('Failed to load assigned students.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)] uppercase tracking-[0.24em]">Students</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Assigned Students</h1>
          <p className="mt-1 text-sm text-gray-500">All students currently assigned to you as tutor.</p>
        </div>
        <div className="rounded-2xl bg-[var(--brand-light)] px-4 py-3 text-[var(--brand-dark)] border border-[var(--brand-border)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand)]">Total</p>
          <p className="mt-1 text-3xl font-bold">{students.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-60">
          <div className="w-10 h-10 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          {error}
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center text-gray-500">
          <p className="text-sm font-semibold">No students are currently assigned to you.</p>
          <p className="text-xs mt-2 text-gray-400">Ask your administrator to assign student accounts so you can track performance and attendance.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Assigned student roster</p>
              <p className="text-xs text-gray-500">View each student's username, LRN, and email.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase tracking-[0.16em]">Student</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase tracking-[0.16em]">Username</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase tracking-[0.16em]">LRN</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase tracking-[0.16em]">ARAL Level</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-500 uppercase tracking-[0.16em]">Email</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-500 uppercase tracking-[0.16em]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 font-semibold">{student.full_name}</td>
                    <td className="px-6 py-4 text-gray-600">{student.username}</td>
                    <td className="px-6 py-4 text-gray-600">{student.lrn || 'N/A'}</td>
                    <td className="px-6 py-4 text-gray-600">{student.aral_level || 'None'}</td>
                    <td className="px-6 py-4 text-gray-600">{student.email}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/tutor/students/${student.id}`}
                        className="inline-flex items-center text-[var(--brand)] hover:text-[var(--brand-text)] font-semibold"
                      >
                        View
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
