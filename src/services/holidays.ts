import { isSameDay, format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isMonday } from 'date-fns';

export interface Holiday {
  date: Date;
  name: string;
}

// Function to calculate Easter Sunday for a given year
function getEaster(year: number): Date {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);

  return new Date(year, month - 1, day);
}

export function getHolidays(year: number): Holiday[] {
  const easter = getEaster(year);
  
  // Good Friday
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  // Easter Monday
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  // San Vicente Ferrer (First Monday after Easter Monday)
  const sanVicenteFerrer = new Date(easter);
  sanVicenteFerrer.setDate(easter.getDate() + 8);

  const fixedHolidays: Holiday[] = [
    { date: new Date(year, 0, 1), name: 'Año Nuevo' },
    { date: new Date(year, 0, 6), name: 'Reyes' },
    { date: new Date(year, 0, 22), name: 'San Vicente Mártir' },
    { date: new Date(year, 2, 19), name: 'San José' },
    { date: new Date(year, 4, 1), name: 'Día del Trabajo' },
    { date: new Date(year, 7, 15), name: 'Asunción' },
    { date: new Date(year, 9, 9), name: 'Día de la Comunitat Valenciana' },
    { date: new Date(year, 9, 12), name: 'Fiesta Nacional' },
    { date: new Date(year, 10, 1), name: 'Todos los Santos' },
    { date: new Date(year, 11, 6), name: 'Constitución' },
    { date: new Date(year, 11, 8), name: 'Inmaculada' },
    { date: new Date(year, 11, 25), name: 'Navidad' },
    { date: goodFriday, name: 'Viernes Santo' },
    { date: easterMonday, name: 'Lunes de Pascua' },
    { date: sanVicenteFerrer, name: 'San Vicente Ferrer' },
  ];

  return fixedHolidays;
}

export function isHoliday(date: Date): boolean {
  const holidays = getHolidays(date.getFullYear());
  return holidays.some(h => isSameDay(h.date, date));
}
