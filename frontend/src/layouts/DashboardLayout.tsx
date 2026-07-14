import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, User as UserIcon, Settings, LogOut } from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleLabel = () => {
    if (!user) return '';
    if (user.is_superuser) return 'SuperAdmin';
    return user.role ? user.role.toUpperCase() : 'USER';
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col shrink-0 border-r border-gray-800">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-gray-800 space-x-2 shrink-0">
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <span className="font-bold text-lg text-white tracking-wider">ARALert</span>
        </div>

        {/* Navigation Section */}
        <nav className="flex-grow py-6 px-4 space-y-1 overflow-y-auto">
          {user?.is_superuser ? (
            <>
              <Link
                to="/superadmin"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/superadmin')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
              <Link
                to="/superadmin/users"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/superadmin/users') || isActive('/superadmin/users/create') || location.pathname.includes('/superadmin/users/edit')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5 mr-3" />
                Users
              </Link>
              <Link
                to="/superadmin/profile"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/superadmin/profile')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <UserIcon className="w-5 h-5 mr-3" />
                Profile
              </Link>
              <Link
                to="/superadmin/settings"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/superadmin/settings')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </Link>
            </>
          ) : user?.role === 'admin' ? (
            <>
              <Link
                to="/admin"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
              <Link
                to="/admin/students"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin/students') || isActive('/admin/students/create') || location.pathname.includes('/admin/students/edit')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5 mr-3" />
                Students
              </Link>
              <Link
                to="/admin/profile"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin/profile')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <UserIcon className="w-5 h-5 mr-3" />
                Profile
              </Link>
              <Link
                to="/admin/settings"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin/settings')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </Link>
            </>
          ) : (
            // Placeholder sidebar links for other roles
            <Link
              to={`/${user?.role}`}
              className="flex items-center px-4 py-2.5 rounded-md text-sm font-medium bg-indigo-600 text-white shadow-sm"
            >
              <LayoutDashboard className="w-5 h-5 mr-3" />
              Home
            </Link>
          )}
        </nav>

        {/* Sidebar Footer / Logout */}
        <div className="p-4 border-t border-gray-800 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-md transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex flex-col flex-grow overflow-hidden">
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-xl font-bold text-gray-800">
            {location.pathname.startsWith('/superadmin/users')
              ? 'User Management'
              : location.pathname.startsWith('/admin/students')
              ? 'Student Directory'
              : location.pathname.includes('/profile')
              ? 'Profile'
              : location.pathname.includes('/settings')
              ? 'Settings'
              : 'Dashboard'}
          </h1>

          <div className="flex items-center space-x-4">
            <div className="flex flex-col text-right">
              <span className="text-sm font-semibold text-gray-800">
                {user?.full_name || user?.username}
              </span>
              <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                {getRoleLabel()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
            </div>
          </div>
        </header>

        {/* Content body */}
        <main className="flex-grow overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
