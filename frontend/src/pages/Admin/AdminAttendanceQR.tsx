import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import { ArrowLeft, RefreshCw, LogIn, LogOut, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';

export const AdminAttendanceQR: React.FC = () => {
  const [action, setAction] = useState<'time_in' | 'time_out'>('time_in');
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQR = async (actionType: 'time_in' | 'time_out') => {
    setIsLoading(true);
    setError(null);
    try {
      // Create a 24-hour long session so it does not count down or expire during the workday
      const newSession = await academicService.createAttendanceSession({
        session_type: 'staff',
        action: actionType,
        expires_in_minutes: 1440,
      });

      setSession(newSession);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate QR session.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateQR(action);
  }, [action]);

  // Render QR code to Canvas when session changes
  useEffect(() => {
    if (session && canvasRef.current) {
      const qrValue = session.id;
      QRCode.toCanvas(canvasRef.current, qrValue, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1e1b4b', // Deep indigo
          light: '#ffffff',
        },
      }, (err) => {
        if (err) console.error('QR Render Error:', err);
      });
    }
  }, [session]);

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center space-x-2">
        <Link
          to="/admin"
          className="text-gray-500 hover:text-indigo-600 inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        {/* Header tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/50">
          <button
            onClick={() => setAction('time_in')}
            className={`flex-1 py-4 text-center font-bold text-sm flex items-center justify-center space-x-2 border-b-2 transition-all ${
              action === 'time_in'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Staff Clock In</span>
          </button>
          <button
            onClick={() => setAction('time_out')}
            className={`flex-1 py-4 text-center font-bold text-sm flex items-center justify-center space-x-2 border-b-2 transition-all ${
              action === 'time_out'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Staff Clock Out</span>
          </button>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          {error && (
            <div className="w-full mb-6 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-4">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="w-64 h-64 flex flex-col items-center justify-center border border-gray-100 rounded-xl bg-gray-50/50">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="mt-3 text-sm text-gray-500 font-medium">Generating secure code...</span>
            </div>
          ) : (
            <div className="relative">
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <canvas ref={canvasRef} className="rounded-lg shadow-sm" />
              </div>
            </div>
          )}

          {session && (
            <div className="mt-6 space-y-4 w-full">
              <div className="inline-flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>Active Staff QR Code</span>
              </div>

              <div className="flex items-center justify-center space-x-2 text-indigo-900 bg-indigo-50 border border-indigo-100 p-4 rounded-xl max-w-sm mx-auto text-left">
                <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Time Limit Rules</p>
                  <p className="text-xs mt-0.5 font-semibold">
                    {action === 'time_in'
                      ? 'Clock-In logs are accepted until 7:30 AM only.'
                      : 'Clock-Out logs open starting from 5:00 PM onwards.'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Instruct staff to scan this QR code using their device cameras on the check-in scanner page.
              </p>

              <button
                onClick={() => generateQR(action)}
                className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center justify-center space-x-1 mx-auto transition-colors mt-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate Session ID</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
