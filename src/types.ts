export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'hr';
  createdAt: any;
}

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  departmentId: string;
  position: string;
  salary: number;
  joinDate: string;
  status: 'active' | 'on-leave' | 'terminated';
  createdAt: any;
  updatedAt: any;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: any;
  checkOut?: any;
  status: 'present' | 'absent' | 'late' | 'on-leave';
}
