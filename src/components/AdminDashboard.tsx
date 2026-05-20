import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Employee, TimeLog } from '../types';
import { LogOut, Calendar as CalendarIcon, FileText, Share2, Mail, MessageCircle, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// We need to extend the jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface AdminDashboardProps {
  employee: Employee;
  onLogout: () => void;
  employees: Employee[];
}

export default function AdminDashboard({ employee, onLogout, employees }: AdminDashboardProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allLogs, setAllLogs] = useState<TimeLog[]>(() => {
    try {
      const cached = localStorage.getItem('admin_logs_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('admin_logs_cache', JSON.stringify(allLogs));
  }, [allLogs]);

  const [selectedUserLogs, setSelectedUserLogs] = useState<string | null>(null);
  const selectedEmp = employees.find(e => e.id === selectedUserLogs);
  const [isOffline, setIsOffline] = useState(false);

  const monthYear = format(currentDate, 'yyyy-MM');

  useEffect(() => {
    const q = query(
      collection(db, 'timeLogs'),
      where('monthYear', '==', monthYear)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: TimeLog[] = [];
      snapshot.forEach((doc) => {
        logs.push(doc.data() as TimeLog);
      });
      setAllLogs(prev => {
        if (JSON.stringify(prev) === JSON.stringify(logs)) return prev;
        return logs;
      });
      setIsOffline(false);
    }, (error: any) => {
      console.error('Admin snapshot error:', error);
      if (error.message?.includes('quota') || error.code === 'unavailable') {
        setIsOffline(true);
      }
    });

    return () => unsubscribe();
  }, [monthYear]);

  const getMonthlyTotal = (userId: string) => {
    return allLogs
      .filter(log => log.userId === userId)
      .reduce((acc, log) => acc + log.totalHours, 0);
  };

  const generatePDF = (emp: Employee) => {
    const empLogs = allLogs.filter(log => log.userId === emp.id).sort((a, b) => a.date.localeCompare(b.date));
    
    if (empLogs.length === 0) {
      alert(`No hay registros para ${emp.name} en este mes.`);
      return;
    }

    const doc = new jsPDF();
    const total = getMonthlyTotal(emp.id);

    doc.setFontSize(16);
    doc.setTextColor(226, 58, 43); // #E23A2B (Tomato Red)
    doc.text('Control de Horarios - El Cantó de la Bona Tomata', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(45, 90, 39); // #2D5A27 (Store Green)
    doc.text(`Empleado: ${emp.name}`, 14, 32);
    doc.text(`Mes: ${format(currentDate, 'MMMM yyyy', { locale: es })}`, 14, 40);
    doc.text(`Total Horas: ${total.toFixed(1)}h`, 14, 48);

    const tableData = empLogs.map(log => [
      log.date,
      format(new Date(log.date), 'EEEE', { locale: es }),
      log.entryTime || '-',
      log.exitTime || '-',
      log.totalHours.toFixed(1) + 'h',
      log.isHoliday ? 'Sí' : 'No',
      log.observations || ''
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Día', 'Entrada', 'Salida', 'Horas', 'Festivo', 'Observaciones']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [45, 90, 39] },
      columnStyles: {
        6: { cellWidth: 50 }
      }
    });

    const fileName = `horarios_${emp.name}_${monthYear}.pdf`;
    doc.save(fileName);
  };

  const sendWhatsApp = (emp: Employee) => {
    const total = getMonthlyTotal(emp.id);
    const text = `Hola Ana, aquí tienes el resumen de horarios de ${emp.name} para ${format(currentDate, 'MMMM yyyy', { locale: es })}. Total: ${total.toFixed(1)}h.`;
    const url = `https://wa.me/34669830963?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const sendEmail = (emp: Employee) => {
    const total = getMonthlyTotal(emp.id);
    const subject = `Horarios ${emp.name} - ${monthYear}`;
    const body = `Resumen de horarios de ${emp.name} para ${format(currentDate, 'MMMM yyyy', { locale: es })}.\nTotal: ${total.toFixed(1)}h.`;
    const mailto = `mailto:anavicentvalero@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  return (
    <div className="max-w-4xl mx-auto min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white px-8 py-6 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <img src="/logo_tomate.svg" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" referrerPolicy="no-referrer" />
          <div>
            <h1 className="text-lg font-black text-slate-800 leading-tight">El Cantó de la Bona Tomata</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] font-bold text-[#2D5A27] uppercase tracking-widest">
                {isOffline ? 'Offline (Usando Cache)' : `Panel Admin: ${employee.name}`}
              </p>
              {isOffline && <span className="h-1.5 w-1.5 bg-orange-400 rounded-full animate-pulse" />}
            </div>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut size={22} />
        </button>
      </header>

      <main className="p-6 md:p-10 space-y-8 flex-1">
        {/* Month Selector */}
        <div className="flex items-center justify-between bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
          <button onClick={prevMonth} className="p-4 text-slate-400 hover:text-[#E23A2B] transition-colors rounded-2xl hover:bg-slate-50">
            <ChevronLeft size={28} />
          </button>
          <div className="flex items-center gap-3">
            <CalendarIcon className="text-slate-300" size={24} />
            <h2 className="text-xl font-black text-slate-800 capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h2>
          </div>
          <button onClick={nextMonth} className="p-4 text-slate-400 hover:text-[#E23A2B] transition-colors rounded-2xl hover:bg-slate-50">
            <ChevronRight size={28} />
          </button>
        </div>

        {/* Employee Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {employees.map(emp => {
            const total = getMonthlyTotal(emp.id);
            const empLogs = allLogs.filter(log => log.userId === emp.id);
            
            return (
              <div key={emp.id} className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all group">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-red-50 group-hover:text-[#E23A2B] transition-colors">
                        <UserIcon size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{emp.name}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {emp.role === 'admin' ? 'Administrador' : 'Empleado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => setSelectedUserLogs(emp.id)}
                    className="bg-slate-50 rounded-2xl p-6 mb-8 flex justify-between items-end cursor-pointer hover:bg-red-50/40 border border-transparent hover:border-red-100 transition-all duration-300 relative group/box"
                    title="Haga clic para ver el detalle diario de horas y observaciones"
                  >
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover/box:text-[#E23A2B] transition-colors">Total Horas</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-800">{total.toFixed(1)}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase">hrs</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover/box:text-[#E23A2B] transition-colors">Registros</p>
                      <span className="text-lg font-bold text-slate-700">{empLogs.length} días</span>
                      <span className="text-[9px] font-bold text-[#E23A2B] uppercase tracking-wider mt-1 opacity-100 flex items-center gap-0.5">
                        Ver Detalle 🔎
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => generatePDF(emp)}
                    title="Bajar PDF"
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all border border-slate-100"
                  >
                    <FileText size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Descargar</span>
                  </button>
                  <button 
                    onClick={() => sendWhatsApp(emp)}
                    title="Enviar WhatsApp"
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-green-50 text-green-600 hover:bg-green-100 transition-all border border-green-100"
                  >
                    <MessageCircle size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => sendEmail(emp)}
                    title="Enviar Correo"
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-red-50 text-[#E23A2B] hover:bg-red-100 transition-all border border-red-100"
                  >
                    <Mail size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Email</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="p-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
        El Cantó de la Bona Tomata
      </footer>

      {/* Modal: Detalle Diario de Horarios y Observaciones */}
      {selectedUserLogs && selectedEmp && (() => {
        const empLogs = allLogs
          .filter(log => log.userId === selectedUserLogs)
          .sort((a, b) => b.date.localeCompare(a.date)); // Newest first

        return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] p-6 shadow-2xl w-full max-w-2xl border border-slate-100 flex flex-col max-h-[85vh]">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <span>Detalle de Registros</span>
                    <span className="text-sm font-bold bg-[#E23A2B]/10 text-[#E23A2B] px-2.5 py-0.5 rounded-full capitalize">
                      {selectedEmp.name}
                    </span>
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                    {format(currentDate, 'MMMM yyyy', { locale: es })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUserLogs(null)}
                  className="p-1 px-3 bg-slate-50 text-slate-400 hover:text-slate-600 font-bold rounded-lg text-sm"
                >
                  Cerrar ✕
                </button>
              </div>

              {/* List of daily entries */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {empLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-medium">
                    No hay registros de horarios para {selectedEmp.name} en este mes.
                  </div>
                ) : (
                  empLogs.map((log) => (
                    <div 
                      key={log.date}
                      className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-200 transition-all"
                    >
                      {/* Date details */}
                      <div className="flex items-center gap-3">
                        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 text-center min-w-[56px]">
                          <span className="block text-xs font-black text-[#E23A2B] uppercase tracking-tighter leading-none mb-0.5">
                            {format(new Date(log.date), 'EEE', { locale: es })}
                          </span>
                          <span className="block text-sm font-bold text-slate-700 leading-none">
                            {format(new Date(log.date), 'd')}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 leading-none mb-1">Fecha</p>
                          <p className="text-sm font-bold text-slate-700 leading-none capitalize">
                            {format(new Date(log.date), 'd \'de\' MMMM', { locale: es })}
                          </p>
                        </div>
                      </div>

                      {/* Log details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          {log.entryTime || log.exitTime ? (
                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-slate-100 text-xs font-medium text-slate-600">
                              <span className="font-bold text-emerald-600">Entrada:</span> {log.entryTime || '-'}
                              <span className="text-slate-300">|</span>
                              <span className="font-bold text-[#E23A2B]">Salida:</span> {log.exitTime || '-'}
                            </div>
                          ) : (
                            <span className="text-[10px] inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 font-black px-2.5 py-1 rounded-xl uppercase tracking-wider">
                              ⚠️ Solo Observación
                            </span>
                          )}

                          <div className="text-xs font-bold text-slate-500">
                            Total: <span className="text-[#E23A2B] font-black text-sm">{log.totalHours.toFixed(1)}h</span>
                          </div>

                          {log.isHoliday && (
                            <span className="text-[10px] font-black bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full uppercase">
                              Festivo
                            </span>
                          )}
                        </div>

                        {/* Observations detail */}
                        {log.observations && (
                          <div className="mt-2 text-xs bg-amber-50 border border-amber-100/60 rounded-xl p-3 text-amber-800 font-medium">
                            <span className="font-bold block text-[10px] text-amber-600 uppercase tracking-widest mb-1">
                              ✍️ Observación de {selectedEmp.name}:
                            </span>
                            {log.observations}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Total del mes: {getMonthlyTotal(selectedEmp.id).toFixed(1)}h
                </span>

                <button
                  onClick={() => generatePDF(selectedEmp)}
                  className="py-2.5 px-4 bg-[#2D5A27] hover:bg-[#1e3d1a] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-green-100 flex items-center gap-1.5"
                >
                  <FileText size={14} />
                  Descargar PDF
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
