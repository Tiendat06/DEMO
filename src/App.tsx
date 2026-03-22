import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  Users, 
  UserPlus, 
  Briefcase, 
  Building2, 
  Calendar, 
  LogOut, 
  LayoutDashboard, 
  Search, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  TrendingUp,
  ChevronRight,
  Filter,
  Download,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db } from './firebase';
import { User, Employee, Department, Attendance } from './types';

// --- Utility Functions ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Surface to UI via state instead of throwing if possible, or throw for ErrorBoundary
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<FirestoreErrorInfo | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      try {
        const parsed = JSON.parse(event.error.message);
        if (parsed.error && parsed.authInfo) {
          setErrorInfo(parsed);
          setHasError(true);
        }
      } catch {
        // Not a Firestore error
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-xl font-bold">Đã có lỗi xảy ra</h2>
          </div>
          <p className="text-stone-600 mb-6">
            Hệ thống gặp sự cố khi truy cập dữ liệu. Vui lòng kiểm tra quyền truy cập hoặc thử lại sau.
          </p>
          {errorInfo && (
            <div className="bg-stone-100 p-4 rounded-lg mb-6 overflow-auto max-h-40 text-xs font-mono">
              <p className="font-bold text-red-700">Lỗi: {errorInfo.error}</p>
              <p>Thao tác: {errorInfo.operationType}</p>
              <p>Đường dẫn: {errorInfo.path}</p>
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full mb-4"
    />
    <p className="text-stone-500 font-medium">Đang tải dữ liệu...</p>
  </div>
);

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-stone-100 text-center"
    >
      <div className="w-20 h-20 bg-stone-900 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
        <Users className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-stone-900 mb-2">HR Pro</h1>
      <p className="text-stone-500 mb-10">Hệ thống Quản lý Nhân sự Chuyên nghiệp</p>
      
      <button 
        onClick={onLogin}
        className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-stone-200 text-stone-700 rounded-2xl font-bold hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-95"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
        Đăng nhập với Google
      </button>
      
      <p className="mt-8 text-xs text-stone-400">
        Bằng cách đăng nhập, bạn đồng ý với các điều khoản dịch vụ của chúng tôi.
      </p>
    </motion.div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'departments' | 'attendance'>('dashboard');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // --- Auth Logic ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            // Create new user profile
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              role: 'hr', // Default role
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'employees'));

    const unsubDepartments = onSnapshot(collection(db, 'departments'), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'departments'));

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    return () => {
      unsubEmployees();
      unsubDepartments();
      unsubAttendance();
    };
  }, [user]);

  // --- Test Connection ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-50 flex">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-stone-200 flex flex-col hidden lg:flex">
          <div className="p-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-stone-900 tracking-tight">HR Pro</span>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              icon={<LayoutDashboard className="w-5 h-5" />}
              label="Tổng quan"
            />
            <NavItem 
              active={activeTab === 'employees'} 
              onClick={() => setActiveTab('employees')}
              icon={<Users className="w-5 h-5" />}
              label="Nhân viên"
            />
            <NavItem 
              active={activeTab === 'departments'} 
              onClick={() => setActiveTab('departments')}
              icon={<Building2 className="w-5 h-5" />}
              label="Phòng ban"
            />
            <NavItem 
              active={activeTab === 'attendance'} 
              onClick={() => setActiveTab('attendance')}
              icon={<Calendar className="w-5 h-5" />}
              label="Chấm công"
            />
          </nav>

          <div className="p-6 border-t border-stone-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center overflow-hidden">
                {auth.currentUser?.photoURL ? (
                  <img src={auth.currentUser.photoURL} alt="Avatar" referrerPolicy="no-referrer" />
                ) : (
                  <Users className="w-5 h-5 text-stone-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-900 truncate">{user.displayName || 'User'}</p>
                <p className="text-xs text-stone-500 truncate uppercase tracking-wider font-semibold">{user.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Đăng xuất</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-20 bg-white border-bottom border-stone-200 px-8 flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-900">
              {activeTab === 'dashboard' && 'Tổng quan hệ thống'}
              {activeTab === 'employees' && 'Danh sách nhân viên'}
              {activeTab === 'departments' && 'Quản lý phòng ban'}
              {activeTab === 'attendance' && 'Theo dõi chấm công'}
            </h2>
            
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm..." 
                  className="pl-10 pr-4 py-2 bg-stone-100 border-none rounded-full text-sm focus:ring-2 focus:ring-stone-900 w-64 transition-all"
                />
              </div>
              <button className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors">
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-8">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Dashboard employees={employees} departments={departments} attendance={attendance} />
                </motion.div>
              )}
              {activeTab === 'employees' && (
                <motion.div 
                  key="employees"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <EmployeeList employees={employees} departments={departments} />
                </motion.div>
              )}
              {activeTab === 'departments' && (
                <motion.div 
                  key="departments"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <DepartmentList departments={departments} employees={employees} />
                </motion.div>
              )}
              {activeTab === 'attendance' && (
                <motion.div 
                  key="attendance"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <AttendanceView employees={employees} attendance={attendance} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-components ---

const NavItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium",
      active 
        ? "bg-stone-900 text-white shadow-lg shadow-stone-200" 
        : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const Dashboard = ({ employees, departments, attendance }: { employees: Employee[], departments: Department[], attendance: Attendance[] }) => {
  const stats = [
    { label: 'Tổng nhân viên', value: employees.length, icon: <Users className="w-6 h-6" />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Phòng ban', value: departments.length, icon: <Building2 className="w-6 h-6" />, color: 'bg-purple-50 text-purple-600' },
    { label: 'Có mặt hôm nay', value: attendance.filter(a => a.date === format(new Date(), 'yyyy-MM-dd') && a.status === 'present').length, icon: <CheckCircle2 className="w-6 h-6" />, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Vắng mặt', value: attendance.filter(a => a.date === format(new Date(), 'yyyy-MM-dd') && a.status === 'absent').length, icon: <XCircle className="w-6 h-6" />, color: 'bg-rose-50 text-rose-600' },
  ];

  const chartData = useMemo(() => {
    return departments.map(dept => ({
      name: dept.name,
      count: employees.filter(e => e.departmentId === dept.id).length
    }));
  }, [employees, departments]);

  const recentEmployees = [...employees].sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.color)}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-stone-500">{stat.label}</p>
              <p className="text-2xl font-bold text-stone-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-stone-900">Phân bổ nhân sự</h3>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />
              <span>+12% tháng này</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f5f5f4' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" fill="#1c1917" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900 mb-6">Nhân viên mới</h3>
          <div className="space-y-6">
            {recentEmployees.length > 0 ? recentEmployees.map((emp, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 font-bold">
                  {emp.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-900 truncate">{emp.fullName}</p>
                  <p className="text-xs text-stone-500 truncate">{emp.position}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300" />
              </div>
            )) : (
              <p className="text-stone-400 text-sm italic">Chưa có nhân viên mới</p>
            )}
          </div>
          <button className="w-full mt-8 py-3 text-sm font-bold text-stone-600 hover:text-stone-900 transition-colors">
            Xem tất cả
          </button>
        </div>
      </div>
    </div>
  );
};

const EmployeeList = ({ employees, departments }: { employees: Employee[], departments: Department[] }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `employees/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-2 rounded-xl border border-stone-200 flex items-center gap-2 text-sm font-medium text-stone-600">
            <span>Tất cả: {employees.length}</span>
          </div>
        </div>
        <button 
          onClick={() => { setEditingEmployee(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
        >
          <UserPlus className="w-5 h-5" />
          Thêm nhân viên
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-100">
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Nhân viên</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Phòng ban</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Vị trí</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Ngày gia nhập</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-stone-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-600 font-bold">
                      {emp.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">{emp.fullName}</p>
                      <p className="text-xs text-stone-500">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-stone-600">
                    {departments.find(d => d.id === emp.departmentId)?.name || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-stone-600">{emp.position}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-stone-600">{emp.joinDate}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    emp.status === 'active' ? "bg-emerald-50 text-emerald-600" : 
                    emp.status === 'on-leave' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                  )}>
                    {emp.status === 'active' ? 'Đang làm việc' : emp.status === 'on-leave' ? 'Nghỉ phép' : 'Đã nghỉ'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingEmployee(emp); setShowModal(true); }}
                      className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(emp.id)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <div className="p-20 text-center">
            <Users className="w-12 h-12 text-stone-200 mx-auto mb-4" />
            <p className="text-stone-400">Chưa có nhân viên nào trong danh sách</p>
          </div>
        )}
      </div>

      {showModal && (
        <EmployeeModal 
          employee={editingEmployee} 
          departments={departments} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </div>
  );
};

const EmployeeModal = ({ employee, departments, onClose }: { employee: Employee | null, departments: Department[], onClose: () => void }) => {
  const [formData, setFormData] = useState<Partial<Employee>>(
    employee || {
      fullName: '',
      email: '',
      departmentId: departments[0]?.id || '',
      position: '',
      salary: 0,
      joinDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'active'
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (employee) {
        await updateDoc(doc(db, 'employees', employee.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'employees'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, employee ? OperationType.UPDATE : OperationType.CREATE, 'employees');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-stone-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-stone-900">{employee ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-stone-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Họ và tên</label>
              <input 
                required
                type="text" 
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Email</label>
              <input 
                required
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Phòng ban</label>
              <select 
                required
                value={formData.departmentId}
                onChange={e => setFormData({...formData, departmentId: e.target.value})}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
              >
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Vị trí</label>
              <input 
                required
                type="text" 
                value={formData.position}
                onChange={e => setFormData({...formData, position: e.target.value})}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Mức lương</label>
              <input 
                required
                type="number" 
                value={formData.salary}
                onChange={e => setFormData({...formData, salary: Number(e.target.value)})}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Ngày gia nhập</label>
              <input 
                required
                type="date" 
                value={formData.joinDate}
                onChange={e => setFormData({...formData, joinDate: e.target.value})}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 mt-8">
            <button type="button" onClick={onClose} className="px-6 py-3 text-stone-600 font-bold hover:bg-stone-50 rounded-xl transition-all">Hủy</button>
            <button type="submit" className="px-8 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200">
              {employee ? 'Lưu thay đổi' : 'Thêm nhân viên'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const DepartmentList = ({ departments, employees }: { departments: Department[], employees: Employee[] }) => {
  const [showModal, setShowModal] = useState(false);
  
  const handleAdd = async () => {
    const name = prompt('Nhập tên phòng ban mới:');
    if (!name) return;
    try {
      await addDoc(collection(db, 'departments'), { name, createdAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'departments');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {departments.map(dept => (
        <div key={dept.id} className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="w-14 h-14 bg-stone-900 rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <button className="p-2 text-stone-300 hover:text-stone-900 transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          <h3 className="text-xl font-bold text-stone-900 mb-2">{dept.name}</h3>
          <p className="text-stone-500 text-sm mb-6">{dept.description || 'Chưa có mô tả cho phòng ban này.'}</p>
          
          <div className="flex items-center justify-between pt-6 border-t border-stone-100">
            <div className="flex -space-x-2">
              {employees.filter(e => e.departmentId === dept.id).slice(0, 4).map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-stone-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-stone-500">
                  {i + 1}
                </div>
              ))}
              {employees.filter(e => e.departmentId === dept.id).length > 4 && (
                <div className="w-8 h-8 rounded-full bg-stone-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-stone-400">
                  +{employees.filter(e => e.departmentId === dept.id).length - 4}
                </div>
              )}
            </div>
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              {employees.filter(e => e.departmentId === dept.id).length} Nhân viên
            </span>
          </div>
        </div>
      ))}
      
      <button 
        onClick={handleAdd}
        className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-3xl flex flex-col items-center justify-center p-8 hover:bg-white hover:border-stone-400 transition-all group min-h-[240px]"
      >
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6 text-stone-400 group-hover:text-stone-900" />
        </div>
        <span className="font-bold text-stone-400 group-hover:text-stone-900">Thêm phòng ban</span>
      </button>
    </div>
  );
};

const AttendanceView = ({ employees, attendance }: { employees: Employee[], attendance: Attendance[] }) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const dailyAttendance = useMemo(() => {
    return employees.map(emp => {
      const record = attendance.find(a => a.employeeId === emp.id && a.date === selectedDate);
      return {
        employee: emp,
        record: record || null
      };
    });
  }, [employees, attendance, selectedDate]);

  const handleMarkAttendance = async (employeeId: string, status: Attendance['status']) => {
    const existing = attendance.find(a => a.employeeId === employeeId && a.date === selectedDate);
    try {
      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.id), { status });
      } else {
        await addDoc(collection(db, 'attendance'), {
          employeeId,
          date: selectedDate,
          status,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, existing ? OperationType.UPDATE : OperationType.CREATE, 'attendance');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-stone-400" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="font-bold text-stone-900 outline-none cursor-pointer"
            />
          </div>
          <div className="h-8 w-px bg-stone-100" />
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-stone-500">Có mặt: {dailyAttendance.filter(d => d.record?.status === 'present').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-sm text-stone-500">Vắng mặt: {dailyAttendance.filter(d => d.record?.status === 'absent').length}</span>
            </div>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-stone-600 font-bold hover:bg-stone-50 rounded-xl transition-all">
          <Download className="w-4 h-4" />
          Xuất báo cáo
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-100">
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Nhân viên</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Giờ vào</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Giờ ra</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Điểm danh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {dailyAttendance.map(({ employee, record }) => (
              <tr key={employee.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-xs font-bold text-stone-500">
                      {employee.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">{employee.fullName}</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">{employee.position}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-stone-500 font-mono">
                    {record?.checkIn ? format(record.checkIn.toDate(), 'HH:mm') : '--:--'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-stone-500 font-mono">
                    {record?.checkOut ? format(record.checkOut.toDate(), 'HH:mm') : '--:--'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {record ? (
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      record.status === 'present' ? "bg-emerald-50 text-emerald-600" : 
                      record.status === 'absent' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {record.status === 'present' ? 'Có mặt' : record.status === 'absent' ? 'Vắng mặt' : 'Đi muộn'}
                    </span>
                  ) : (
                    <span className="text-stone-300 text-[10px] font-bold uppercase tracking-wider">Chưa ghi nhận</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleMarkAttendance(employee.id, 'present')}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        record?.status === 'present' ? "bg-emerald-500 text-white" : "text-stone-300 hover:bg-emerald-50 hover:text-emerald-500"
                      )}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleMarkAttendance(employee.id, 'absent')}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        record?.status === 'absent' ? "bg-rose-500 text-white" : "text-stone-300 hover:bg-rose-50 hover:text-rose-500"
                      )}
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
