import React, { useState, useEffect, useMemo } from 'react';
import { AppState, InvoiceData } from './types';
import { processInvoiceImage } from './services/invoiceService';
import { fetchInvoices, saveInvoiceToStorage, deleteInvoiceFromStorage } from './services/storageService';
import { requestNotificationPermission, pollInvoiceStatus } from './services/notificationService';
import CameraCapture from './components/CameraCapture';
import ReceiptView from './components/ReceiptView';
import Dashboard from './components/Dashboard';
import Button from './components/Button';
import AdminBoard from './components/AdminBoard';
import { Loader2, Search, X, CreditCard, Receipt, FileText, Sun, Moon, User, ChevronRight, ArrowUpDown, ChevronUp, ChevronDown, Upload, ShieldAlert } from 'lucide-react';

type SortField = 'storeName' | 'invoiceNumber' | 'date' | 'type' | 'totalAmount';
type SortOrder = 'asc' | 'desc';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [activeTasks, setActiveTasks] = useState<{ id: string; name: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dialogMessage, setDialogMessage] = useState<{ title: string; message: string; type: 'error' | 'info' } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});
  
  // Single global search and filter state
  const [filter, setFilter] = useState<'ALL' | 'INVOICE' | 'CREDIT_INVOICE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Table sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Authenticated user state
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [userId, setUserId] = useState<string>(() => localStorage.getItem('userId') || "");
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem('userEmail') || "");
  const [userFirstName, setUserFirstName] = useState<string>(() => localStorage.getItem('userFirstName') || "");
  const [userLastName, setUserLastName] = useState<string>(() => localStorage.getItem('userLastName') || "");

  // Authentication UI state
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Account modal & Admin mode state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const isAdmin = Boolean(userEmail && (userEmail.toLowerCase().endsWith('@slip-vault.com') || userEmail.toLowerCase().includes('admin')));

  // Password reset states
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMsg, setForgotPasswordMsg] = useState<string | null>(null);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordMsg, setResetPasswordMsg] = useState<string | null>(null);

  // Check URL hash for password reset token
  useEffect(() => {
    const checkResetToken = () => {
      const hash = window.location.hash || '';
      if (hash.includes('reset-password') && hash.includes('token=')) {
        const tokenMatch = hash.match(/token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
          setResetToken(tokenMatch[1]);
        }
      }
    };
    checkResetToken();
    window.addEventListener('hashchange', checkResetToken);
    return () => window.removeEventListener('hashchange', checkResetToken);
  }, []);

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordMsg(null);
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = isLocal ? 'http://localhost:8000/api/auth/forgot-password' : 'https://api.slip-vault.com/api/auth/forgot-password';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });
      const data = await res.json();
      setForgotPasswordMsg(data.message || 'Reset link requested.');
    } catch {
      setForgotPasswordMsg('Error requesting password reset link.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newResetPassword) return;
    setResetPasswordLoading(true);
    setResetPasswordMsg(null);
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = isLocal ? 'http://localhost:8000/api/auth/reset-password' : 'https://api.slip-vault.com/api/auth/reset-password';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: newResetPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setResetPasswordMsg('Password updated successfully! You can now log in.');
        setTimeout(() => {
          setResetToken(null);
          window.location.hash = '';
        }, 2000);
      } else {
        setResetPasswordMsg(data.detail || 'Reset failed.');
      }
    } catch {
      setResetPasswordMsg('Failed to update password.');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!token) return;
    const handleHashChange = () => {
      const hash = window.location.hash || '#/receipts';
      if (hash === '#/admin' || hash === '#admin') {
        if (isAdmin) {
          setIsAdminMode(true);
        } else {
          window.location.hash = '#/receipts';
          setIsAdminMode(false);
        }
      } else {
        setIsAdminMode(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAdmin, token]);

  const navigateToAdmin = () => {
    window.location.hash = '#/admin';
    setIsAdminMode(true);
  };

  const navigateToReceipts = () => {
    window.location.hash = '#/receipts';
    setIsAdminMode(false);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmail || !authPassword) {
      setAuthError("Please enter both email and password.");
      return;
    }
    
    setAuthLoading(true);
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:8000' : 'https://api.slip-vault.com';
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    
    const payload = isRegistering 
      ? { email: authEmail.trim(), password: authPassword, firstName: authFirstName || "", lastName: authLastName || "" }
      : { email: authEmail.trim(), password: authPassword };

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || "Invalid email or password.");
      }
      
      localStorage.setItem('token', resData.token);
      localStorage.setItem('userId', resData.userId);
      localStorage.setItem('userEmail', resData.email);
      localStorage.setItem('userFirstName', resData.firstName || authFirstName || "");
      localStorage.setItem('userLastName', resData.lastName || authLastName || "");
      
      setToken(resData.token);
      setUserId(resData.userId);
      setUserEmail(resData.email);
      setUserFirstName(resData.firstName || authFirstName || "");
      setUserLastName(resData.lastName || authLastName || "");

      setAuthPassword("");
      setAuthEmail("");
      setAuthFirstName("");
      setAuthLastName("");
      setAuthError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error occurred";
      setAuthError(msg);
      setDialogMessage({
        title: isRegistering ? "Registration Failed" : "Login Failed",
        message: msg,
        type: "error"
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userLastName');
    setToken(null);
    setUserId("");
    setUserEmail("");
    setUserFirstName("");
    setUserLastName("");
    setInvoices([]);
    setIsAccountModalOpen(false);
  };
  
  // Loading states
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    requestNotificationPermission();
    if (!token) return;
    
    const loadData = async () => {
      setIsLoadingInvoices(true);
      try {
        const data = await fetchInvoices();
        setInvoices(data);
      } catch (e) {
        console.error("Failed to load history");
      } finally {
        setIsLoadingInvoices(false);
      }
    };
    loadData();
  }, [token]);

  const handleCapture = async (base64Image: string) => {
    setState(AppState.IDLE);
    const tempTaskId = `uploading-${Date.now()}`;
    setActiveTasks(prev => [...prev, { id: tempTaskId, name: "Uploading receipt..." }]);
    
    try {
      const pendingData = await processInvoiceImage(base64Image, userId);
      const invoiceId = pendingData.id;
      
      setActiveTasks(prev => prev.map(t => t.id === tempTaskId ? { id: invoiceId, name: "Processing..." } : t));
      
      pollInvoiceStatus(
        invoiceId,
        (completedData) => {
          setActiveTasks(prev => prev.filter(t => t.id !== invoiceId));
          setInvoices(prev => [completedData, ...prev.filter(i => i.id !== completedData.id)]);
        },
        (errorReason) => {
          setActiveTasks(prev => prev.filter(t => t.id !== invoiceId));
          setDialogMessage({
            title: "Analysis Failed",
            message: errorReason,
            type: "error"
          });
        }
      );
    } catch (error) {
      console.error(error);
      setActiveTasks(prev => prev.filter(t => t.id !== tempTaskId));
      setDialogMessage({
        title: "Upload Failed",
        message: error instanceof Error ? error.message : "An error occurred",
        type: "error"
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null } }) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        handleCapture(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveInvoice = async (data: InvoiceData) => {
    setIsSaving(true);
    try {
      const saved = await saveInvoiceToStorage(data);
      setInvoices(prev => [saved, ...prev.filter(i => i.id !== saved.id)]); 
      setInvoiceData(null);
      setState(AppState.IDLE);
    } catch (e) {
      alert("Failed to save invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteInvoiceFromStorage(id);
      setInvoices(invoices.filter(i => i.id !== id));
      setInvoiceData(null);
      setState(AppState.IDLE);
    } catch (e) {
      alert("Failed to delete invoice");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewInvoice = (invoice: InvoiceData) => {
    setInvoiceData(invoice);
    setState(AppState.VIEWING);
  };

  const resetApp = () => {
    setInvoiceData(null);
    setErrorMsg("");
    setState(AppState.IDLE);
  };

  // Deduplicate invoices array to prevent duplicate IDs or duplicate items
  const uniqueInvoices = useMemo(() => {
    const map = new Map<string, InvoiceData>();
    invoices.forEach(inv => {
      const key = inv.id ? `id:${inv.id}` : `fp:${inv.storeName || ''}_${inv.invoiceNumber || ''}_${inv.date || ''}_${inv.type || ''}_${inv.totalAmount || 0}`;
      map.set(key, inv);
    });
    return Array.from(map.values());
  }, [invoices]);

  // Metrics calculation
  const stats = useMemo(() => {
    const credits = uniqueInvoices.filter(i => i.type === 'CREDIT_INVOICE');
    const totalCredits = credits.reduce((acc, curr) => acc + Math.abs(curr.totalAmount || 0), 0);
    const invoicesOnly = uniqueInvoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT');
    const totalSpend = invoicesOnly.reduce((acc, curr) => acc + Math.abs(curr.totalAmount || 0), 0);
    const currency = uniqueInvoices[0]?.currency || '₪';
    return { 
      count: uniqueInvoices.length, 
      creditCount: credits.length, 
      creditTotal: totalCredits,
      invoiceCount: invoicesOnly.length,
      totalSpend,
      currency 
    };
  }, [uniqueInvoices]);

  // Filtered invoices
  const desktopFilteredInvoices = useMemo(() => {
    return uniqueInvoices.filter(inv => {
      const matchesFilter = filter === 'ALL' || inv.type === filter;
      const matchesSearch = (inv.storeName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (inv.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [uniqueInvoices, filter, searchQuery]);

  // Handle column sort clicks
  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Group & sort invoices for tree view
  const groupedInvoices = useMemo(() => {
    const groups: { [key: string]: InvoiceData[] } = {};
    const singletons: InvoiceData[] = [];
    
    desktopFilteredInvoices.forEach(inv => {
      const invNum = inv.invoiceNumber?.trim();
      if (!invNum) {
        singletons.push(inv);
        return;
      }
      if (!groups[invNum]) {
        groups[invNum] = [];
      }
      groups[invNum].push(inv);
    });
    
    const tree: { parent: InvoiceData; children: InvoiceData[] }[] = [];
    
    Object.keys(groups).forEach(invNum => {
      const list = groups[invNum];
      list.sort((a, b) => {
        if (a.type === 'INVOICE' && b.type === 'CREDIT_INVOICE') return -1;
        if (a.type === 'CREDIT_INVOICE' && b.type === 'INVOICE') return 1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
      
      const parent = list[0];
      const children = list.slice(1);
      tree.push({ parent, children });
    });
    
    singletons.forEach(inv => {
      tree.push({ parent: inv, children: [] });
    });
    
    // Sort tree according to active sortField and sortOrder
    tree.sort((a, b) => {
      let aVal: any = a.parent[sortField] || '';
      let bVal: any = b.parent[sortField] || '';
      
      if (sortField === 'date') {
        aVal = a.parent.createdAt || new Date(a.parent.date).getTime() || 0;
        bVal = b.parent.createdAt || new Date(b.parent.date).getTime() || 0;
      } else if (sortField === 'totalAmount') {
        aVal = a.parent.totalAmount;
        bVal = b.parent.totalAmount;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return tree;
  }, [desktopFilteredInvoices, sortField, sortOrder]);

  // Brand Vault Logo Component
  const AppLogo = () => (
    <div className="w-10 h-10 rounded-[10px] bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center shadow-md shrink-0">
      <Receipt size={22} aria-hidden="true" />
    </div>
  );

  const getUserInitials = (fName?: string, lName?: string, email?: string): string => {
    const f = (fName || '').trim();
    const l = (lName || '').trim();
    if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
    if (f) return f[0].toUpperCase();
    if (l) return l[0].toUpperCase();
    if (email) return email.trim()[0].toUpperCase();
    return 'U';
  };

  const userInitials = getUserInitials(userFirstName, userLastName, userEmail);
  const userNameDisplay = userFirstName || userLastName ? `${userFirstName} ${userLastName}`.trim() : userEmail.split('@')[0];

  if (!token) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-4 bg-[#070B14] text-[#F8FAFC]">
        <div className="w-full max-w-md bg-[#111827] rounded-2xl p-8 shadow-2xl border border-[#334155]">
          <div className="flex flex-col items-center mb-8">
            <AppLogo />
            <h2 className="text-2xl font-black text-[#F8FAFC] mt-4">
              {isRegistering ? "Join Receipt Vault" : "Welcome Back"}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              {isRegistering ? "Create your digitized receipt account" : "Manage your digitized receipts"}
            </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="p-3.5 bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#F87171] text-xs font-semibold rounded-[10px] flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0 text-[#F87171]" />
                <span>{authError}</span>
              </div>
            )}

            {isRegistering && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-normal block mb-1">First Name</label>
                  <input 
                    type="text" 
                    value={authFirstName}
                    onChange={(e) => { setAuthFirstName(e.target.value); setAuthError(null); }}
                    placeholder="John"
                    className="w-full h-11 px-3.5 rounded-[10px] border border-[#334155] bg-[#1E293B] text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-normal block mb-1">Last Name</label>
                  <input 
                    type="text" 
                    value={authLastName}
                    onChange={(e) => { setAuthLastName(e.target.value); setAuthError(null); }}
                    placeholder="Doe"
                    className="w-full h-11 px-3.5 rounded-[10px] border border-[#334155] bg-[#1E293B] text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-sm"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-normal block mb-1">Email Address</label>
              <input 
                type="email" 
                value={authEmail}
                onChange={(e) => { setAuthEmail(e.target.value); setAuthError(null); }}
                placeholder="you@example.com"
                className="w-full h-11 px-3.5 rounded-[10px] border border-[#334155] bg-[#1E293B] text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-normal block mb-1">Password</label>
              <input 
                type="password" 
                value={authPassword}
                onChange={(e) => { setAuthPassword(e.target.value); setAuthError(null); }}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-[10px] border border-[#334155] bg-[#1E293B] text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] text-sm"
                required
              />
              {!isRegistering && (
                <div className="flex justify-end mt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordEmail(authEmail);
                      setIsForgotPasswordOpen(true);
                    }}
                    className="min-h-[44px] inline-flex items-center text-xs font-semibold text-[#60A5FA] hover:underline focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
            
            <Button 
              type="submit" 
              variant="primary" 
              fullWidth
              className="mt-2 min-h-[44px]"
              disabled={authLoading}
              icon={authLoading ? <Loader2 className="animate-spin" /> : undefined}
            >
              {authLoading ? "Please wait..." : isRegistering ? "Sign Up" : "Log In"}
            </Button>
          </form>
          
          <div className="text-center mt-4 pt-3 border-t border-[#334155]">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthEmail("");
                setAuthPassword("");
                setAuthFirstName("");
                setAuthLastName("");
                setAuthError(null);
              }}
              className="min-h-[44px] w-full inline-flex items-center justify-center text-xs font-semibold text-[#2563EB] hover:text-[#4F46E5] transition-colors p-2 focus:outline-none"
            >
              {isRegistering ? "Already have an account? Log In" : "New to Receipt Vault? Create Account"}
            </button>
          </div>
        </div>

        {/* Dialog Modal on Login Screen */}
        {dialogMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#111827] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#334155] flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-xl bg-[#DC2626]/10 text-[#DC2626]">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-[#F8FAFC] mb-1">
                {dialogMessage.title}
              </h3>
              <p className="text-xs text-[#94A3B8] mb-5 leading-relaxed">
                {dialogMessage.message}
              </p>
              <Button 
                onClick={() => setDialogMessage(null)} 
                variant="primary" 
                fullWidth
                className="min-h-[44px]"
              >
                Okay
              </Button>
            </div>
          </div>
        )}

        {/* Forgot Password Modal */}
        {isForgotPasswordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#111827] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#334155] relative text-[#F8FAFC]">
              <button 
                onClick={() => { setIsForgotPasswordOpen(false); setForgotPasswordMsg(null); }}
                className="w-[44px] h-[44px] absolute top-4 right-4 rounded-full text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center"
              >
                <X size={18} />
              </button>

              <h3 className="text-lg font-bold mb-2 text-[#F8FAFC]">Reset Password</h3>
              <p className="text-xs text-[#94A3B8] mb-4">
                Enter your registered email address and we'll send you a password reset link.
              </p>

              {forgotPasswordMsg ? (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-xs leading-relaxed">
                    {forgotPasswordMsg}
                  </div>
                  <Button 
                    onClick={() => { setIsForgotPasswordOpen(false); setForgotPasswordMsg(null); }}
                    variant="primary" 
                    fullWidth 
                    className="min-h-[44px]"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#94A3B8] uppercase block mb-1">Email Address</label>
                    <input 
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 px-3.5 rounded-[10px] border border-[#334155] bg-[#1E293B] text-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    fullWidth 
                    className="min-h-[44px]"
                    disabled={forgotPasswordLoading}
                    icon={forgotPasswordLoading ? <Loader2 className="animate-spin" /> : undefined}
                  >
                    {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Reset Password Form Modal (Triggered via Reset Token Link) */}
        {resetToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#111827] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#334155] relative text-[#F8FAFC]">
              <h3 className="text-lg font-bold mb-2 text-[#F8FAFC]">Set New Password</h3>
              <p className="text-xs text-[#94A3B8] mb-4">
                Please enter a new password for your Slip Vault account.
              </p>

              {resetPasswordMsg ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs leading-relaxed text-center font-semibold">
                  {resetPasswordMsg}
                </div>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#94A3B8] uppercase block mb-1">New Password</label>
                    <input 
                      type="password"
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 px-3.5 rounded-[10px] border border-[#334155] bg-[#1E293B] text-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                      required
                      minLength={6}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    fullWidth 
                    className="min-h-[44px]"
                    disabled={resetPasswordLoading}
                    icon={resetPasswordLoading ? <Loader2 className="animate-spin" /> : undefined}
                  >
                    {resetPasswordLoading ? 'Updating Password...' : 'Update Password'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full h-[100dvh] w-full bg-[#F8FAFC] dark:bg-[#070B14] flex overflow-hidden">
      
      {isAdminMode && isAdmin ? (
        <AdminBoard onClose={navigateToReceipts} onViewInvoice={handleViewInvoice} />
      ) : (
        (state === AppState.IDLE || state === AppState.VIEWING) && (
          <div className="flex-1 flex h-full w-full overflow-hidden">
            {/* Left Panel: Sidebar */}
            <div className={`h-full w-full md:w-[320px] md:shrink-0 ${state === AppState.IDLE ? 'flex' : 'hidden md:flex'} flex-col min-h-0 overflow-hidden`}>
              <Dashboard 
                invoices={uniqueInvoices}
                activeTasks={activeTasks}
                isLoading={isLoadingInvoices}
                onUploadClick={handleFileUpload}
                onInvoiceClick={handleViewInvoice}
                AppLogo={AppLogo}
                filter={filter}
                setFilter={setFilter}
                userEmail={userEmail}
                userName={userNameDisplay}
                onOpenAccountModal={() => setIsAccountModalOpen(true)}
                onLogout={handleLogout}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            </div>

            {/* Center/Right Panel: Main Receipts Area */}
            <div className={`h-full flex-1 bg-[#F8FAFC] dark:bg-[#070B14] flex flex-col overflow-hidden ${state === AppState.VIEWING ? 'block' : 'hidden md:flex'}`}>
              {/* Header: Page Title "Receipts", Single Global Search, Admin, Account & Theme Buttons */}
              <header className={`w-full bg-white dark:bg-[#111827] border-b border-[#DCE3EC] dark:border-[#334155] py-3.5 px-4 md:px-6 shadow-sm shrink-0 items-center justify-between gap-3 ${state === AppState.VIEWING ? 'hidden md:flex' : 'flex'}`}>
                <h1 className="text-lg md:text-xl font-bold text-[#172033] dark:text-[#F8FAFC] shrink-0">Receipts</h1>
                
                <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end">
                  {/* Single Global Search in Header */}
                  <div className="relative w-full max-w-[240px] sm:max-w-xs md:max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" size={18} aria-hidden="true" />
                    <input 
                      type="text"
                      placeholder="Search stores, date, invoice #..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Global search receipts"
                      className="w-full h-11 pl-10 pr-10 bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#DCE3EC] dark:border-[#334155] rounded-[10px] text-xs text-[#172033] dark:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] transition-all"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search query"
                        className="w-[44px] h-[44px] absolute right-0 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#172033] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] flex items-center justify-center"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Admin Board Button (visible only to admins) */}
                  {isAdmin && (
                    <button 
                      onClick={navigateToAdmin}
                      aria-label="Open Admin Board"
                      className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] font-semibold text-xs border border-[#F59E0B]/30 transition-all focus:outline-none focus:ring-2 focus:ring-[#60A5FA] shrink-0"
                      title="Open System Admin Board"
                    >
                      <ShieldAlert size={16} />
                      <span className="hidden md:inline">Admin Board</span>
                    </button>
                  )}

                  {/* Account Button */}
                  <button 
                    onClick={() => setIsAccountModalOpen(true)}
                    aria-label="Account Settings"
                    className="min-h-[44px] min-w-[44px] flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#DCE3EC] dark:border-[#334155] hover:border-[#2563EB] transition-all focus:outline-none focus:ring-2 focus:ring-[#60A5FA] shrink-0"
                    title="Account Settings"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      <User size={14} />
                    </div>
                    <span className="text-xs font-semibold text-[#172033] dark:text-[#F8FAFC] hidden sm:inline truncate max-w-[100px]">
                      {userNameDisplay}
                    </span>
                  </button>

                  {/* Theme Toggle Button - 44x44px */}
                  <button
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-[10px] bg-[#F1F5F9] hover:bg-[#DCE3EC] dark:bg-[#1E293B] dark:hover:bg-[#334155] text-[#172033] dark:text-[#CBD5E1] transition-colors shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
                  </button>
                </div>
              </header>

            {/* Scrollable Content Area */}
            <div className={`flex-1 overflow-y-auto no-scrollbar safe-container ${state === AppState.VIEWING ? 'p-0 md:p-6' : 'p-4 md:p-6'}`}>
              {state === AppState.VIEWING && invoiceData ? (
                <div className="w-full max-w-4xl mx-auto animate-in fade-in duration-200">
                  <ReceiptView 
                    data={invoiceData} 
                    onSave={handleSaveInvoice}
                    onDelete={handleDeleteInvoice}
                    onClose={resetApp}
                    isSaved={!!invoiceData.id}
                    isSaving={isSaving}
                    isDeleting={isDeleting}
                  />
                </div>
              ) : (
                <div className="max-w-6xl mx-auto w-full space-y-6">
                  
                  {/* Summary Cards: 1 column on mobile 320px, 2 on sm, 3 on md */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    <div className="bg-white dark:bg-[#111827] p-5 md:p-6 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] flex items-center justify-center text-[#2563EB] shrink-0">
                        <FileText size={22} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-normal block truncate">Total Documents</span>
                        <span className="text-2xl font-black text-[#172033] dark:text-[#F8FAFC]">{stats.count}</span>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-[#111827] p-5 md:p-6 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-[#059669] dark:text-[#34D399] shrink-0">
                        <Receipt size={22} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-normal block truncate">Total Spent</span>
                        <span className="text-2xl font-black text-[#172033] dark:text-[#F8FAFC] truncate block">
                          <span className="text-[#F59E0B] font-black mr-0.5">{stats.currency}</span>{stats.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#111827] p-5 md:p-6 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex items-center gap-4 sm:col-span-2 md:col-span-1">
                      <div className="w-12 h-12 rounded-xl bg-[#2563EB]/10 dark:bg-[#2563EB]/20 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA] shrink-0">
                        <CreditCard size={22} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-normal block truncate">Credit Balance</span>
                        <span className="text-2xl font-black text-[#2563EB] dark:text-[#60A5FA] truncate block">
                          <span className="text-[#F59E0B] font-black mr-0.5">{stats.currency}</span>{stats.creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Table Container - Dynamic Height */}
                  <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#DCE3EC] dark:border-[#334155] flex justify-between items-center bg-[#F8FAFC]/50 dark:bg-[#111827]">
                      <h2 className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC]">Receipts & Invoices</h2>
                      <span className="text-xs bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold px-2.5 py-1 rounded-full">
                        {desktopFilteredInvoices.length} receipts
                      </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#DCE3EC] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/40">
                            <th className="px-6 py-3.5">
                              <button onClick={() => handleSortClick('storeName')} className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 hover:text-[#172033] dark:hover:text-[#F8FAFC] focus:outline-none min-h-[44px]">
                                Store {sortField === 'storeName' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} />}
                              </button>
                            </th>
                            <th className="px-6 py-3.5 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                              Invoice #
                            </th>
                            <th className="px-6 py-3.5">
                              <button onClick={() => handleSortClick('date')} className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 hover:text-[#172033] dark:hover:text-[#F8FAFC] focus:outline-none min-h-[44px]">
                                Date {sortField === 'date' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} />}
                              </button>
                            </th>
                            <th className="px-6 py-3.5">
                              <button onClick={() => handleSortClick('type')} className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 hover:text-[#172033] dark:hover:text-[#F8FAFC] focus:outline-none min-h-[44px]">
                                Type {sortField === 'type' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} />}
                              </button>
                            </th>
                            <th className="px-6 py-3.5 text-right">
                              <button onClick={() => handleSortClick('totalAmount')} className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] inline-flex items-center gap-1 hover:text-[#172033] dark:hover:text-[#F8FAFC] focus:outline-none min-h-[44px]">
                                Amount {sortField === 'totalAmount' ? (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} />}
                              </button>
                            </th>
                            <th className="px-6 py-3.5 text-center text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DCE3EC] dark:divide-[#334155]">
                          {isLoadingInvoices ? (
                            [1, 2, 3].map(i => (
                              <tr key={i} className="animate-pulse">
                                <td colSpan={6} className="px-6 py-5"><div className="h-4 bg-[#F1F5F9] dark:bg-[#1E293B] rounded"></div></td>
                              </tr>
                            ))
                          ) : groupedInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                                <div className="max-w-xs mx-auto flex flex-col items-center">
                                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] dark:bg-[#1E293B] flex items-center justify-center mb-3 text-[#64748B]">
                                    <Search size={20} />
                                  </div>
                                  <p className="font-semibold text-sm text-[#172033] dark:text-[#F8FAFC] not-italic mb-1">No receipts found</p>
                                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">No receipts match your search or filter criteria.</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            groupedInvoices.map((group) => {
                              const parent = group.parent;
                              const children = group.children;
                              const hasChildren = children.length > 0;
                              const isExpanded = !!expandedGroups[parent.id];
                              
                              return (
                                <React.Fragment key={parent.id}>
                                  {/* Parent Row */}
                                  <tr 
                                    onClick={() => handleViewInvoice(parent)}
                                    className="bg-white dark:bg-[#111827] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] cursor-pointer transition-colors text-xs group"
                                  >
                                    <td className="px-6 py-4 font-semibold text-[#172033] dark:text-[#F8FAFC]">
                                      <div className="flex items-center gap-2">
                                        {hasChildren ? (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedGroups(prev => ({ ...prev, [parent.id]: !prev[parent.id] }));
                                            }}
                                            aria-label={isExpanded ? "Collapse receipt group" : "Expand receipt group"}
                                            className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-transform flex items-center justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                                          >
                                            <ChevronRight size={18} className={`text-[#64748B] dark:text-[#94A3B8] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                          </button>
                                        ) : (
                                          <span className="w-4 shrink-0"></span>
                                        )}
                                        <span className="line-clamp-2 break-words max-w-[220px]">{parent.storeName || "Unknown Store"}</span>
                                        {hasChildren && (
                                          <span className="text-xs bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] px-2 py-0.5 rounded-full font-semibold ml-1 shrink-0">
                                            {children.length + 1} docs
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-[#64748B] dark:text-[#CBD5E1] whitespace-nowrap">
                                      {parent.invoiceNumber || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-[#172033] dark:text-[#CBD5E1] whitespace-nowrap">
                                      {formatDate(parent.date)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {parent.type === 'CREDIT_INVOICE' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA]">
                                          <CreditCard size={12} /> Credit
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-[#059669] dark:bg-emerald-950/40 dark:text-[#34D399]">
                                          <Receipt size={12} /> Invoice
                                        </span>
                                      )}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${
                                      parent.type === 'CREDIT_INVOICE' 
                                        ? 'text-[#059669] dark:text-[#34D399]' 
                                        : 'text-[#172033] dark:text-[#CBD5E1]'
                                    }`}>
                                      {parent.type === 'CREDIT_INVOICE' ? '+' : ''}
                                      <span className="text-[#F59E0B] font-black mr-0.5">{parent.currency}</span>
                                      {Math.abs(parent.totalAmount).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleViewInvoice(parent); }}
                                        aria-label={`View details for ${parent.storeName}`}
                                        className="min-h-[44px] min-w-[64px] px-3.5 py-2 inline-flex items-center justify-center text-xs font-semibold rounded-[10px] bg-[#F1F5F9] text-[#172033] hover:bg-[#2563EB] hover:text-white dark:bg-[#1E293B] dark:text-[#CBD5E1] dark:hover:bg-[#2563EB] dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                                      >
                                        View
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Expanded Child Rows */}
                                  {hasChildren && isExpanded && children.map(child => (
                                    <tr 
                                      key={child.id}
                                      onClick={() => handleViewInvoice(child)}
                                      className="bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#334155] cursor-pointer transition-colors text-xs border-l-4 border-l-[#2563EB]"
                                    >
                                      <td className="px-6 py-3 font-medium text-[#172033] dark:text-[#CBD5E1] pl-10">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[#2563EB] dark:text-[#60A5FA] font-bold">┗</span>
                                          <span className="line-clamp-2 break-words max-w-[200px]">{child.storeName}</span>
                                          <span className="text-xs font-medium text-[#2563EB] dark:text-[#60A5FA] bg-[#2563EB]/10 dark:bg-[#2563EB]/20 px-2 py-0.5 rounded-full shrink-0">
                                            Original document
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                                        {child.invoiceNumber || '-'}
                                      </td>
                                      <td className="px-6 py-3 text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                                        {formatDate(child.date)}
                                      </td>
                                      <td className="px-6 py-3 whitespace-nowrap">
                                        {child.type === 'CREDIT_INVOICE' ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA]">
                                            <CreditCard size={12} /> Credit
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-[#059669] dark:bg-emerald-950/40 dark:text-[#34D399]">
                                            <Receipt size={12} /> Invoice
                                          </span>
                                        )}
                                      </td>
                                      <td className={`px-6 py-3 text-right font-semibold whitespace-nowrap ${
                                        child.type === 'CREDIT_INVOICE' 
                                          ? 'text-[#059669] dark:text-[#34D399]' 
                                          : 'text-[#172033] dark:text-[#CBD5E1]'
                                      }`}>
                                        {child.type === 'CREDIT_INVOICE' ? '+' : ''}
                                        <span className="text-[#F59E0B] font-extrabold mr-0.5">{child.currency}</span>
                                        {Math.abs(child.totalAmount).toFixed(2)}
                                      </td>
                                      <td className="px-6 py-3 text-center whitespace-nowrap">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleViewInvoice(child); }}
                                          aria-label={`View details for ${child.storeName}`}
                                          className="min-h-[44px] min-w-[64px] px-3 py-2 inline-flex items-center justify-center text-xs font-semibold rounded-[10px] bg-white text-[#172033] hover:bg-[#2563EB] hover:text-white dark:bg-[#111827] dark:text-[#CBD5E1] dark:hover:bg-[#2563EB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                                        >
                                          View
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* SCANNING STATE */}
      {state === AppState.SCANNING && (
        <CameraCapture 
          onCapture={handleCapture} 
          onCancel={() => setState(AppState.IDLE)} 
        />
      )}

      {/* PROCESSING STATE */}
      {state === AppState.PROCESSING && (
        <div className="fixed inset-0 bg-white/90 dark:bg-[#070B14]/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8">
          <div className="relative">
             <div className="w-16 h-16 rounded-full border-4 border-[#DCE3EC] border-t-[#2563EB] animate-spin"></div>
          </div>
          <h3 className="text-xl font-bold text-[#172033] dark:text-[#F8FAFC] mt-6 mb-2">Analyzing Receipt...</h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] text-center max-w-xs">
            Extracting merchant details, items, tax and total amounts.
          </p>
        </div>
      )}

      {/* ERROR STATE */}
      {state === AppState.ERROR && (
        <div className="w-full max-w-md h-full bg-white dark:bg-[#111827] flex flex-col items-center justify-center p-8 shadow-2xl mx-auto rounded-2xl">
           <div className="w-16 h-16 bg-[#DC2626]/10 text-[#DC2626] rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold">!</span>
           </div>
           <h3 className="text-xl font-bold text-[#172033] dark:text-[#F8FAFC] mb-2">Error Processing</h3>
           <p className="text-xs text-[#64748B] dark:text-[#94A3B8] text-center mb-6 leading-relaxed">{errorMsg}</p>
           <Button onClick={resetApp} variant="primary" className="w-full min-h-[44px]">Try Again</Button>
        </div>
      )}

      {/* Dialog Modal */}
      {dialogMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#DCE3EC] dark:border-[#334155] flex flex-col items-center text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-xl ${dialogMessage.type === 'error' ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-[#2563EB]/10 text-[#2563EB]'}`}>
              {dialogMessage.type === 'error' ? '⚠️' : 'ℹ️'}
            </div>
            <h3 className="text-base font-bold text-[#172033] dark:text-[#F8FAFC] mb-1">
              {dialogMessage.title}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-5 leading-relaxed">
              {dialogMessage.message}
            </p>
            <Button 
              onClick={() => setDialogMessage(null)} 
              variant="primary" 
              fullWidth
              className="min-h-[44px]"
            >
              Okay
            </Button>
          </div>
        </div>
      )}

      {/* Account Modal - Hides internal raw User ID */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#DCE3EC] dark:border-[#334155] flex flex-col relative">
            <button 
              onClick={() => setIsAccountModalOpen(false)}
              aria-label="Close profile modal"
              className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] absolute top-4 right-4 rounded-full text-[#64748B] hover:text-[#172033] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3.5 mb-6 pt-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center font-black text-base tracking-wider shadow-md shrink-0 uppercase">
                {userInitials}
              </div>
              <div className="flex flex-col truncate">
                <h3 className="text-base font-bold text-[#172033] dark:text-[#F8FAFC] truncate">
                  {userNameDisplay}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{userEmail}</p>
              </div>
            </div>

            {/* Appearance Mode */}
            <div className="flex items-center justify-between p-3.5 rounded-[10px] bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#DCE3EC] dark:border-[#334155] mb-6">
              <span className="text-xs font-semibold text-[#172033] dark:text-[#CBD5E1]">Appearance Theme</span>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-[10px] bg-white dark:bg-[#111827] border border-[#DCE3EC] dark:border-[#334155] text-xs font-semibold text-[#172033] dark:text-[#CBD5E1] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
              >
                {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-600" />}
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={() => setIsAccountModalOpen(false)} variant="secondary" className="flex-1 min-h-[44px]">
                Close
              </Button>
              <Button onClick={handleLogout} variant="danger" className="flex-1 min-h-[44px]">
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;