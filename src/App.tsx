import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { Employee } from './types';
import Login from './components/Login';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import { motion, AnimatePresence } from 'motion/react';

// Robust Error Boundary to catch UI crashes
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Uncaught render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 max-w-md">
            <h2 className="text-2xl font-black text-red-600 mb-4">Error Detectado</h2>
            <p className="text-slate-600 mb-6 leading-relaxed text-sm">
              La aplicación ha encontrado un problema. Es posible que sea un error temporal de conexión.
            </p>
            <div className="bg-white p-4 rounded-xl text-left mb-6 overflow-auto max-h-40 border border-red-50">
              <code className="text-[10px] text-red-500 font-mono break-all leading-tight">
                {this.state.error?.message || 'Error desconocido'}
              </code>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg"
              >
                Recargar Página
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs"
              >
                Borrar datos locales y reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Centralized types moved to src/types.ts

const EMPLOYEES: Employee[] = [
  { id: 'ana', name: 'Ana Vicent Valero', role: 'admin', email: 'anavicentvalero@gmail.com' },
  { id: 'angel', name: 'Angel Vicen Roca', role: 'employee', email: 'angvicen@gmail.com' },
  { id: 'mariluz', name: 'Mª Luz Ballesteros Ferrer', role: 'employee' },
  { id: 'marta', name: 'Marta Diaz Llovera', role: 'employee' },
  { id: 'eva', name: 'Eva Mª Mocholí Vicent', role: 'employee' },
  { id: 'pablo', name: 'Pablo David Scalzo', role: 'employee' },
  { id: 'belkabli', name: 'Belkabli Keliel Bengabbou', role: 'employee' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  // Immediate initialization from localStorage to bypass loading screen
  const [employee, setEmployee] = useState<Employee | null>(() => {
    try {
      const savedId = localStorage.getItem('employeeId');
      if (savedId) {
        return EMPLOYEES.find(e => e.id === savedId) || null;
      }
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
    return null;
  });
  
  // We skip initial loading screens for returning users
  const [loading, setLoading] = useState(false); 
  const [authError, setAuthError] = useState<string | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setAuthError(null);
      
      if (authUser) {
        setUser(authUser);
        const savedEmployeeId = localStorage.getItem('employeeId');
        if (savedEmployeeId) {
          const emp = EMPLOYEES.find(e => e.id === savedEmployeeId);
          if (emp) setEmployee(emp);
        }
      } else {
        setUser(null);
        const savedEmployeeId = localStorage.getItem('employeeId');
        if (savedEmployeeId) {
          try {
            await signInAnonymously(auth);
          } catch (err: any) {
            console.error('Auto sign-in error:', err);
          }
        }
      }
      setIsFirebaseReady(true);
    }, (error: any) => {
      console.error('Auth state error:', error);
      setAuthError(`Error de conexión Firebase: ${error.message}`);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleLogin = async (selectedEmployee: Employee) => {
    // Optimistic UI: enter as the employee immediately
    setEmployee(selectedEmployee);
    localStorage.setItem('employeeId', selectedEmployee.id);
    
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    } catch (error: any) {
      console.error('Login auth error:', error);
      // We don't block the user, the sync indicator will show they are offline
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('employeeId');
    setEmployee(null);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative">
        {/* Subtle background sync indicator */}
        <div className="fixed top-2 right-2 z-[100] pointer-events-none">
          {!isFirebaseReady && employee && !authError && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full text-[10px] font-bold border border-amber-100 shadow-sm animate-pulse uppercase tracking-wider">
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              Sincronizando...
            </div>
          )}
          {authError && employee && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold border border-red-100 shadow-sm uppercase tracking-wider">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
              Modo Local: Límites de red
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!employee ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Login employees={EMPLOYEES} onLogin={handleLogin} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {employee.role === 'admin' ? (
                <AdminDashboard employee={employee} onLogout={handleLogout} employees={EMPLOYEES} />
              ) : (
                <EmployeeDashboard employee={employee} onLogout={handleLogout} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
