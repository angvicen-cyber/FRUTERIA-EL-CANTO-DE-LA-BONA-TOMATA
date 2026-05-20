export interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'employee';
  email?: string;
}

export interface TimeLog {
  userId: string;
  userName: string;
  date: string;
  entryTime: string;
  exitTime: string;
  totalHours: number;
  isHoliday: boolean;
  monthYear: string;
  observations?: string;
}
