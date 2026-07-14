import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gray-50 border-b border-gray-100 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 text-xs font-semibold text-indigo-700 mb-6">
            <span>Sprint 1 Auth Foundation Active</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight max-w-3xl leading-none">
            Student Performance Monitoring &amp; Early Academic Risk Detection
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl">
            A comprehensive, secure monitoring platform helping educators detect student academic risk early and implement proactive interventions.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            {isAuthenticated ? (
              <Link
                to={getDashboardLink()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-lg shadow-md transition-all text-base"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-lg shadow-md transition-all text-base"
                >
                  Get Started
                </Link>
                <a
                  href="#features"
                  className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-lg transition-all text-base"
                >
                  Learn More
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Platform Features</h2>
            <p className="mt-4 text-gray-600">
              ARALert monitors critical performance indexes to keep students on track.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold mb-4">
                01
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Early Risk Detection</h3>
              <p className="text-sm text-gray-600">
                Detect learning loss, attendance gaps, and academic flags automatically before students fall behind.
              </p>
            </div>

            <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold mb-4">
                02
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Role-Based Access</h3>
              <p className="text-sm text-gray-600">
                Secure access for Principals, Admins, Faculty, Tutors, and Students with tailored views.
              </p>
            </div>

            <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold mb-4">
                03
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Integrated Monitoring</h3>
              <p className="text-sm text-gray-600">
                Unified data tracking including attendance trends, weekly assessment scores, and risk classifications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gray-50 border-t border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">About ARALert</h2>
              <p className="text-gray-600 mb-4">
                ARALert was designed to address student learning challenges. By combining simple, secure user portals with intuitive monitoring, ARALert empowers educators, tutors, and parents to act early.
              </p>
              <p className="text-gray-600">
                Sprint 1 introduces a rock-solid, secure, JWT-based login mechanism with strict role-based dashboards and user directory controls for system administrators.
              </p>
            </div>
            <div className="bg-gray-200 rounded-xl h-64 flex items-center justify-center text-gray-400 font-medium">
              [Placeholder About Image]
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Get In Touch</h2>
          <p className="text-gray-600 mb-8">
            Have questions about the ARALert platform or rollout timeline? Contact our system administrator.
          </p>
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-sm text-gray-500">Email Administrator</p>
            <p className="text-base font-semibold text-indigo-600 mt-1">support@aralert.com</p>
          </div>
        </div>
      </section>
    </div>
  );
};
