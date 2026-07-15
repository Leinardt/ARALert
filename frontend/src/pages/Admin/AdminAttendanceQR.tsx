import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import { ArrowLeft, Clock, RefreshCw, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';

export const AdminAttendanceQR: React.FC = () => {
  const [action, setAction] = useState<'time_in' | 'time_out'>('time_in');
  const [session, setSession] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const generateQR = async (actionType: 'time_in' | 'time_out') => {
    setIsLoading(true);
    setError(null);
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      
      const newSession = await academicService.createAttendanceSession({
        session_type: 'staff',
        action: actionType,
        expires_in_minutes: 5,
      });

      setSession(newSession);
      setTimeLeft(newSession.time_left || 300);

      // Start Countdown Timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setSession((curr: any) => curr ? { ...curr, is_active: false } : null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate QR session.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateQR(action);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
              {session && !session.is_active && (
                <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center p-6 border border-gray-200">
                  <Clock className="w-12 h-12 text-red-500 mb-2" />
                  <h3 className="font-bold text-gray-900 text-base">QR Code Expired</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                    This security token has expired. Please regenerate a new QR code.
                  </p>
                  <button
                    onClick={() => generateQR(action)}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Regenerate</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {session && session.is_active && (
            <div className="mt-6 space-y-4 w-full">
              <div className="inline-flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100">
                <CheckCircle2 className="w-4 h-4" />
                <span>Active & Secure Session</span>
              </div>

              <div className="flex items-center justify-center space-x-2 text-gray-600 font-medium bg-gray-50 py-2.5 px-4 rounded-xl border border-gray-100 w-fit mx-auto">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-sm">Expires in:</span>
                <span className="text-sm font-bold font-mono text-indigo-700">{formatTime(timeLeft)}</span>
              </div>

              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Instruct staff to scan this QR code using their device cameras on the check-in scanner page.
              </p>

              <button
                onClick={() => generateQR(action)}
                className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center justify-center space-x-1 mx-auto transition-colors mt-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
