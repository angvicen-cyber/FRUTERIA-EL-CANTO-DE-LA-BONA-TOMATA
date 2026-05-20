import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSunday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Employee, TimeLog } from '../types';
import { LogOut, Sun, Moon, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, CheckCircle2, CalendarDays, Trash2 } from 'lucide-react';
import { isHoliday as checkIsHoliday } from '../services/holidays';
import { motion, AnimatePresence } from 'motion/react';

interface EmployeeDashboardProps {
  employee: Employee;
  onLogout: () => void;
}

const ENTRY_OPTIONS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00'];
const EXIT_OPTIONS = ['13:30', '14:00', '14:30', '15:00', '15:30'];

export default function EmployeeDashboard({ employee, onLogout }: EmployeeDashboardProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [logs, setLogs] = useState<Record<string, TimeLog>>(() => {
    // Try to load initial logs from localStorage cache for instant UI
    try {
      const cached = localStorage.getItem(`logs_cache_${employee.id}`);
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      console.error('Cache load error:', e);
      return {};
    }
  });

  // Use a ref to track the latest logs to avoid cyclic dependencies in effects
  const logsRef = React.useRef(logs);
  useEffect(() => {
    logsRef.current = logs;
    // Persist to local storage whenever logs change
    localStorage.setItem(`logs_cache_${employee.id}`, JSON.stringify(logs));
  }, [logs, employee.id]);

  const [entryTime, setEntryTime] = useState('');
  const [exitTime, setExitTime] = useState('');
  const [observations, setObservations] = useState('');
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [tempObservations, setTempObservations] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const monthYear = format(currentDate, 'yyyy-MM');
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const [lastDate, setLastDate] = useState(dateStr);

  useEffect(() => {
    // Listen to logs for the current user and month
    const q = query(
      collection(db, 'timeLogs'),
      where('userId', '==', employee.id),
      where('monthYear', '==', monthYear)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs: Record<string, TimeLog> = {};
      snapshot.forEach((doc) => {
        const data = doc.data() as TimeLog;
        newLogs[data.date] = data;
      });
      
      setLogs(prev => {
        // Merge with existing local logs, prioritizing server data but keeping local-only ones if offline
        const merged = { ...prev, ...newLogs };
        if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
        return merged;
      });
      setIsOffline(false);
    }, (error: any) => {
      console.error('Error fetching logs:', error);
      if (error.message?.includes('quota') || error.code === 'unavailable') {
        setIsOffline(true);
      }
    });

    return () => unsubscribe();
  }, [employee.id, monthYear]);

  // Load entry/exit times whenever we change the selected date, or when database value updates (if we are not actively editing)
  useEffect(() => {
    const log = logs[dateStr];
    
    if (dateStr !== lastDate) {
      // The user switched days. Reset editing state and load the new day's values.
      setEntryTime(log ? log.entryTime : '');
      setExitTime(log ? log.exitTime : '');
      setObservations(log && log.observations ? log.observations : '');
      setIsDirty(false);
      setLastDate(dateStr);
    } else {
      // Same day. Only update if the user has not edited the selection yet.
      // This prevents background database updates from overwriting the user's active choices while clicking.
      if (!isDirty) {
        setEntryTime(log ? log.entryTime : '');
        setExitTime(log ? log.exitTime : '');
        setObservations(log && log.observations ? log.observations : '');
      }
    }
  }, [dateStr, logs, lastDate]);

  const calculateHours = (entry: string, exit: string) => {
    if (!entry || !exit) return 0;
    const [entryH, entryM] = entry.split(':').map(Number);
    const [exitH, exitM] = exit.split(':').map(Number);
    const entryTotal = entryH + entryM / 60;
    const exitTotal = exitH + exitM / 60;
    return Math.max(0, exitTotal - entryTotal);
  };

  const handleSave = async () => {
    setSaving(true);
    const totalHours = calculateHours(entryTime, exitTime);
    const isHoliday = checkIsHoliday(currentDate);
    const cleanObs = observations.trim();
    
    // Create the log object
    const logData: TimeLog = {
      userId: employee.id,
      userName: employee.name,
      date: dateStr,
      entryTime,
      exitTime,
      totalHours,
      isHoliday,
      monthYear,
      ...(cleanObs ? { observations: cleanObs } : {})
    };

    // OPTIMISTIC UPDATE: Update local state immediately
    setLogs(prev => {
      if (!entryTime && !exitTime && !cleanObs) {
        const { [dateStr]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dateStr]: logData };
    });

    try {
      if (!entryTime && !exitTime && !cleanObs) {
        await deleteDoc(doc(db, 'timeLogs', `${employee.id}_${dateStr}`));
      } else {
        await setDoc(doc(db, 'timeLogs', `${employee.id}_${dateStr}`), logData);
      }
      setSuccess(true);
      setIsDirty(false);
      setIsOffline(false);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error: any) {
      console.error('Error saving log:', error);
      // If it's a quota error or network error, we don't alert. 
      // The data IS already in the local cache, so the user won't "lose" it in this session.
      if (error.message?.includes('quota') || error.code === 'unavailable') {
        setIsOffline(true);
        // Still show success since it's saved locally
        setSuccess(true);
        setIsDirty(false);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        alert(`Error al sincronizar con el servidor: ${error.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar el registro de este día?')) return;
    
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'timeLogs', `${employee.id}_${dateStr}`));
      setEntryTime('');
      setExitTime('');
      setObservations('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error: any) {
      console.error('Error deleting log:', error);
      alert(`Error al eliminar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const totalMonthlyHours = Object.values(logs)
    .filter((log: TimeLog) => log.monthYear === monthYear)
    .reduce((acc: number, log: TimeLog) => acc + log.totalHours, 0);

  const prevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const nextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setCurrentDate(new Date(e.target.value));
    }
  };

  const isCurrentHoliday = checkIsHoliday(currentDate);
  const isShopClosed = isSunday(currentDate) || isCurrentHoliday;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-[100]">
        <div className="flex items-center gap-3">
          <img src="/logo_tomate.svg" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 leading-none">{employee.name}</h2>
              {isOffline && (
                <span className="flex h-2 w-2 rounded-full bg-orange-400 animate-pulse" title="Modo sin conexión / Cuota limitada" />
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {isOffline ? 'Modo Local (Sincronizando...)' : 'Conectado'}
            </p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
        >
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 p-6 space-y-6">
        {/* Month Summary Card */}
        <section className="bg-gradient-to-br from-[#2D5A27] to-[#1e3d1a] rounded-3xl p-6 text-white shadow-lg shadow-green-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100/70 text-xs font-bold uppercase tracking-wider">Total del mes</p>
              <h3 className="text-lg font-bold capitalize mt-1">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </h3>
            </div>
            <CalendarIcon className="text-white/30" />
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-5xl font-black">{(totalMonthlyHours as number).toFixed(1)}</span>
            <span className="text-lg font-medium opacity-70">horas</span>
          </div>
        </section>

        {/* Date Selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-2">
            <button onClick={prevDay} className="p-3 text-slate-400 hover:text-[#E23A2B] transition-colors">
              <ChevronLeft size={24} />
            </button>
            
            <div className="text-center flex flex-col items-center flex-1 py-2 relative">
              <span className="text-[10px] font-black text-[#E23A2B] uppercase tracking-[0.2em] mb-0.5">
                {format(currentDate, 'EEEE', { locale: es })}
              </span>
              <div className="flex items-center gap-2 relative">
                <span className="text-lg font-bold text-slate-800">
                  {format(currentDate, 'd MMMM', { locale: es })}
                </span>
                <CalendarDays size={16} className="text-slate-300" />
                
                {/* This input covers the area and triggers native picker on touch */}
                <input 
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  value={format(currentDate, 'yyyy-MM-dd')}
                  onChange={handleDateChange}
                />
              </div>
              
              <AnimatePresence mode="wait">
                {isShopClosed && (
                  <motion.span 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="text-[10px] font-black bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full mt-1 uppercase"
                  >
                    {isSunday(currentDate) ? 'Cerrado: Domingo' : 'Festivo'}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <button onClick={nextDay} className="p-3 text-slate-400 hover:text-[#E23A2B] transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Logging Form */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden transition-all duration-500 min-h-[400px] flex flex-col">
          {isShopClosed && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm p-6 text-center">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-yellow-100 border border-yellow-50 max-w-[280px]"
              >
                <div className="w-20 h-20 bg-yellow-400 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-yellow-200">
                  <CalendarIcon className="text-white" size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3">¡Día de Descanso!</h3>
                <p className="text-base text-slate-600 font-medium leading-tight mb-4">
                  Hoy {isSunday(currentDate) ? 'es domingo' : 'es festivo'} y la frutería permanece cerrada.
                </p>
                <span className="text-5xl block animate-bounce" style={{ textShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                  😊
                </span>
                <p className="text-sm font-bold text-yellow-600 mt-4 uppercase tracking-widest">
                  Disfruta tu día
                </p>
              </motion.div>
            </div>
          )}

          <div className={`space-y-8 flex-1 transition-all duration-500 ${isShopClosed ? 'blur-[2px] pointer-events-none opacity-20' : ''}`}>
            <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Sun size={18} />
                <span className="text-sm font-bold uppercase tracking-wider">Entrada</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ENTRY_OPTIONS.map(time => (
                  <button
                    key={time}
                    onClick={() => {
                      setEntryTime(prev => prev === time ? '' : time);
                      setIsDirty(true);
                    }}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${
                      entryTime === time
                        ? 'bg-red-50 text-[#E23A2B] ring-2 ring-[#E23A2B]'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Moon size={18} />
                <span className="text-sm font-bold uppercase tracking-wider">Salida</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {EXIT_OPTIONS.map(time => (
                  <button
                    key={time}
                    onClick={() => {
                      setExitTime(prev => prev === time ? '' : time);
                      setIsDirty(true);
                    }}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${
                      exitTime === time
                        ? 'bg-red-50 text-[#E23A2B] ring-2 ring-[#E23A2B]'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Sección de Observaciones */}
            <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
                  ✍️ Observaciones
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTempObservations(observations);
                    setIsObsModalOpen(true);
                  }}
                  className="text-xs font-bold text-[#E23A2B] hover:scale-105 hover:underline transition-all"
                >
                  {observations ? 'Editar' : '+ Añadir'}
                </button>
              </div>
              {observations ? (
                <p className="text-sm font-medium text-slate-700 bg-white p-3 rounded-xl border border-slate-100 max-h-24 overflow-y-auto leading-relaxed">
                  {observations}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 font-medium">
                  ¿Baja, enfermedad, retraso...? Agrégalo aquí si es necesario.
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 mt-auto">
            <div className="flex justify-between items-center mb-6 px-1">
              <span className="text-slate-400 font-bold uppercase text-xs">Horas hoy</span>
              <span className="text-2xl font-black text-slate-800">
                {calculateHours(entryTime, exitTime).toFixed(1)}h
              </span>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving || (entryTime !== "" && exitTime === "") || (entryTime === "" && exitTime !== "")}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
                success 
                  ? 'bg-green-500 text-white shadow-green-100' 
                  : (entryTime !== "" && exitTime === "") || (entryTime === "" && exitTime !== "")
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-[#E23A2B] text-white shadow-red-100 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {saving ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : success ? (
                <>
                  <CheckCircle2 size={24} />
                  <span>Guardado</span>
                </>
              ) : (
                <>
                  <Clock size={24} />
                  <span>Guardar Horario</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </main>

      <footer className="p-6 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">
        El Cantó de la Bona Tomata v1.0
      </footer>

      {/* Modal de Observaciones */}
      <AnimatePresence>
        {isObsModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm border border-slate-100 flex flex-col gap-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800">Añadir Observación</h3>
                <button 
                  onClick={() => setIsObsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Especifica cualquier motivo para documentar en el registro de hoy (baja, enfermedad, asunto personal, etc.):
              </p>

              {/* Botones rápidos */}
              <div className="flex flex-wrap gap-1.5 py-1">
                {['Baja Médica', 'Indisposición Enfermedad', 'Asunto Personal', 'Entrada Tarde', 'Ausencia'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setTempObservations(prev => {
                        const trimmed = prev.trim();
                        if (!trimmed) return tag;
                        if (trimmed.includes(tag)) return prev;
                        return `${trimmed} - ${tag}`;
                      });
                    }}
                    className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 hover:bg-[#E23A2B] hover:text-white text-slate-600 rounded-lg transition-all"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              <textarea
                value={tempObservations}
                onChange={(e) => setTempObservations(e.target.value)}
                placeholder="Escribe aquí las observaciones o comentarios..."
                rows={4}
                className="w-full text-sm p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#E23A2B] focus:border-transparent text-slate-800 font-medium resize-none"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTempObservations('');
                  }}
                  className="flex-1 py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl font-bold text-sm transition-all text-center"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setObservations(tempObservations);
                    setIsDirty(true);
                    setIsObsModalOpen(false);
                  }}
                  className="flex-1 py-3 px-4 bg-[#E23A2B] hover:bg-[#c72f22] text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-red-100 text-center"
                >
                  Aceptar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
