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
      log.entryTime,
      log.exitTime,
      log.totalHours.toFixed(1),
      log.isHoliday ? 'Sí' : 'No'
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Día', 'Entrada', 'Salida', 'Horas', 'Festivo']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [45, 90, 39] },
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

                  <div className="bg-slate-50 rounded-2xl p-6 mb-8 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Horas</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-800">{total.toFixed(1)}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase">hrs</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registros</p>
                      <span className="text-lg font-bold text-slate-700">{empLogs.length} días</span>
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
    </div>
  );
}
