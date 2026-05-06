import { Scanner } from '@yudiel/react-qr-scanner';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  ChevronRight, 
  CreditCard, 
  Loader2, 
  LogOut, 
  Network, 
  QrCode, 
  ShieldAlert, 
  Users,
  Ticket,
  X,
  Search,
  Filter,
  User
} from 'lucide-react';
import QRCode from 'react-qr-code';

type Screen = 'login' | 'home' | 'scan' | 'claim' | 'loading' | 'active' | 'not_eligible' | 'admin' | 'passes' | 'profile';

function LogoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path 
        d="M 22 26 L 28 26 L 62 36 L 28 46 L 28 74 L 46 74 L 46 82 L 22 82 Z" 
        fill="currentColor" 
      />
      <path d="M 66 32 L 82 32" stroke="currentColor" strokeWidth="2" strokeOpacity="0.6" strokeLinecap="round" />
      <path d="M 64 36 L 78 36" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" strokeLinecap="round" />
      <path d="M 66 40 L 74 40" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" strokeLinecap="round" />
    </svg>
  );
}

type PartnerData = { id: string; name: string; offer: string; expiry?: string };

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [scannedPartner, setScannedPartner] = useState<PartnerData | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>();

  const navigateTo = (screen: Screen, delay = 0) => {
    if (delay > 0) {
      setCurrentScreen('loading');
      setTimeout(() => setCurrentScreen(screen), delay);
    } else {
      setCurrentScreen(screen);
    }
  };

  const handleLogin = (userData: any) => {
    setUser(userData);
    setIsAdmin(!!userData.isAdmin);
    navigateTo('home');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAdmin(false);
    navigateTo('login');
  };

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-md mx-auto bg-transparent relative overflow-hidden">
      <div className="mesh-bg fixed" />
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between z-10 sticky top-0">
        <button 
          onClick={() => { if (user) navigateTo('home'); }}
          className="flex items-center gap-2 outline-none cursor-pointer"
        >
          <LogoIcon className="w-6 h-6 text-black" />
          <span className="font-semibold text-sm tracking-tight text-black">Network Pass</span>
        </button>
        {isAdmin && (
          <button 
            onClick={() => navigateTo('admin')}
            className="text-xs font-semibold px-3 py-1 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
          >
            Admin
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">
        <AnimatePresence mode="wait">
          {currentScreen === 'login' && (
            <LoginScreen 
              key="login" 
              onLogin={handleLogin}
              onFail={(err) => { setLoginError(err); navigateTo('not_eligible'); }} 
            />
          )}
          {currentScreen === 'home' && (
            <HomeScreen 
              key="home" 
              user={user} 
              onScanClick={() => navigateTo('scan')} 
              onViewPasses={() => navigateTo('passes')} 
              onProfileClick={() => navigateTo('profile')} 
            />
          )}
          {currentScreen === 'scan' && (
            <ScanScreen key="scan" onScan={(data) => {
              try {
                if (data === 'mock_data') {
                  setScannedPartner({ id: 'mock-1', name: 'Standard Coffee', offer: '15% Discount' });
                  navigateTo('claim');
                  return;
                }
                const parsed = JSON.parse(data);
                if (parsed.id && parsed.name && parsed.offer) {
                  setScannedPartner(parsed);
                  navigateTo('claim');
                } else {
                  alert('Invalid Partner QR Code');
                }
              } catch (e) {
                alert('Invalid QR Code format. Please scan a valid Network Pass QR.');
              }
            }} />
          )}
          {currentScreen === 'claim' && (
            <ClaimScreen key="claim" partner={scannedPartner} user={user} onClaim={() => navigateTo('active', 1000)} />
          )}
          {currentScreen === 'loading' && <LoadingScreen key="loading" />}
          {currentScreen === 'active' && (
            <ActivePassScreen key="active" partner={scannedPartner} onClose={() => navigateTo('passes')} />
          )}
          {currentScreen === 'not_eligible' && (
            <NotEligibleScreen key="not_eligible" error={loginError} onRetry={() => navigateTo('login')} />
          )}
          {currentScreen === 'admin' && (
            <AdminScreen key="admin" onBack={() => navigateTo('home')} />
          )}
          {currentScreen === 'passes' && (
            <PassesScreen key="passes" user={user} onBack={() => navigateTo('home')} onOpenPass={(partner) => { setScannedPartner(partner); navigateTo('active'); }} />
          )}
          {currentScreen === 'profile' && (
            <ProfileScreen key="profile" user={user} onBack={() => navigateTo('home')} onLogout={handleLogout} isAdmin={isAdmin} onAdminClick={() => navigateTo('admin')} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onFail }: { onLogin: (data: any) => void, onFail: (err?: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState<string>('');

  useEffect(() => {
    // Check if we already have a code in URL (mobile redirect case)
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    if (urlCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      processCode(urlCode);
    }

    const fetchAuthUrl = async () => {
      try {
        const redirectUri = `${window.location.origin}/auth/callback`;
        const response = await fetch('/api/auth/url');
        if (response.ok) {
          const { client_id } = await response.json();
          const params = new URLSearchParams({
            client_id,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'identify email guilds guilds.members.read'
          });
          setAuthUrl(`https://discord.com/oauth2/authorize?${params.toString()}`);
        }
      } catch (e) {
        console.error("Failed to fetch auth url", e);
      }
    };
    fetchAuthUrl();

    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;
      if (event.data?.type === 'OAUTH_AUTH_CODE') {
        processCode(event.data.code);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const processCode = async (code: string) => {
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri })
      });
      const data = await verifyRes.json();
      if (verifyRes.ok && data.member) {
        onLogin(data);
      } else {
        onFail(data.error || "Verification failed or you are not a member.");
      }
    } catch (e: any) {
      onFail(e.message || "Network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      e.preventDefault();
      if (!authUrl) return;
      const authWindow = window.open(authUrl, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) alert("Please allow popups to connect your account.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col px-6 py-8"
    >
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full pt-8">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
            <LogoIcon className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-black leading-tight mb-3">Welcome to<br/>Network Pass</h1>
          <p className="text-gray-500 text-sm font-medium">Log in with your Network School account to access partner offers.</p>
        </div>
        
        <div className="space-y-4 mt-auto">
          <a
            href={authUrl || '#'}
            target="_top"
            onClick={handleConnect as any}
            className={`w-full bg-black text-white py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-900 transition-transform active:scale-[0.98] cursor-pointer ${loading || !authUrl ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Login with NS</span>}
          </a>
        </div>

        <div className="mt-6 text-center">
          <span className="text-[10px] tracking-widest text-gray-400 uppercase font-bold mb-4 block">Powered by Network Pass</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ user, onScanClick, onViewPasses, onProfileClick }: { user: any, onScanClick: () => void, onViewPasses: () => void, onProfileClick: () => void }) {
  const firstName = user?.name ? user.name.split(' ')[0] : 'Member';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex-1 flex flex-col px-6 py-8"
    >
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full pt-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-black mb-1">Hello, {firstName}</h1>
          <p className="text-gray-500 text-sm font-medium">Ready to claim an offer?</p>
        </div>
        
        <button 
          onClick={onScanClick}
          className="glass-card w-full aspect-square rounded-[32px] flex flex-col items-center justify-center gap-4 hover:bg-white/90 transition-colors active:scale-[0.98] cursor-pointer group"
        >
          <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-colors">
            <QrCode className="w-10 h-10 text-black" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900 mb-1">Scan Partner QR</p>
            <p className="text-xs text-gray-500 font-medium">Tap to open camera</p>
          </div>
        </button>

        <button 
          onClick={onViewPasses}
          className="glass-card w-full mt-4 p-5 rounded-2xl flex items-center justify-between hover:bg-white/90 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-black" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">My Passes</p>
              <p className="text-xs text-gray-500 font-medium">View claimed offers</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
        </button>

        <div 
          onClick={onProfileClick}
          className="glass-card mt-8 p-5 flex items-center justify-between cursor-pointer hover:bg-white/90 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 group-hover:text-black transition-colors">Verified Member</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">Network School</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Scan Screen ──────────────────────────────────────────────────────────────
function ScanScreen({ onScan }: { onScan: (data: string) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex-1 flex flex-col px-6 py-8"
    >
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full pt-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-black mb-2">Scan Partner QR</h1>
          <p className="text-gray-500 text-sm font-medium">Scan the code at the venue to claim your offer</p>
        </div>
        
        <div className="glass-card shadow-2xl overflow-hidden relative aspect-square w-full rounded-[32px] p-2 flex items-center justify-center bg-gray-900/5 backdrop-blur-3xl">
          <div className="w-full h-full rounded-[24px] overflow-hidden relative">
            <Scanner
              sound={false}
              onScan={(result) => {
                if (result && result.length > 0) {
                  onScan(result[0].rawValue);
                }
              }}
            />
            <div className="absolute inset-0 border-2 border-white/20 pointer-events-none rounded-[24px]" />
          </div>
        </div>

        <div className="mt-10 text-center px-4">
          <p className="text-xs text-gray-400 font-medium leading-relaxed mb-6">
            Please make sure camera permissions are enabled for this experience.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Claim Screen ─────────────────────────────────────────────────────────────
function ClaimScreen({ partner, user, onClaim }: { partner: any, user: any, onClaim: () => void }) {
  const [claiming, setClaiming] = useState(false);
  const partnerName = partner?.name || 'Partner Name';
  const partnerOffer = partner?.offer || 'Special Offer';
  const shortName = partnerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const handleClaim = async () => {
    setClaiming(true);
    try {
      // Save claim to Firestore via server
      await fetch('/api/admin/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.discordId || 'unknown',
          discordId: user?.discordId || 'unknown',
          userName: user?.name || 'Unknown',
          partnerId: partner?.id || 'unknown',
          partnerName: partnerName,
          offer: partnerOffer,
          expiry: partner?.expiry || '24'
        })
      });
    } catch (e) {
      console.error("Failed to save claim:", e);
    } finally {
      setClaiming(false);
      onClaim();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col px-6 py-8"
    >
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full pt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-black leading-tight mb-2">Claim your<br/>Network Pass</h1>
          <p className="text-gray-500 text-sm font-medium">Verify the partner details to claim your offer.</p>
        </div>
        
        <div className="glass-card p-5 mb-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{shortName}</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-tighter text-gray-400">Partner</p>
              <p className="font-semibold text-gray-900">{partnerName}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-bold uppercase tracking-tighter text-gray-400">Current Offer</p>
            <p className="text-xl font-bold text-gray-900">{partnerOffer}</p>
          </div>
        </div>

        <div className="space-y-4 mt-auto">
          <button 
            onClick={handleClaim}
            disabled={claiming}
            className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-900 transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Claim Offer</span>}
          </button>
        </div>

        <div className="mt-6 text-center">
          <span className="text-[10px] tracking-widest text-gray-400 uppercase font-bold">Powered by Network Pass</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center px-6"
    >
      <Loader2 className="w-8 h-8 text-black animate-spin mb-6" />
      <h2 className="text-lg font-medium text-gray-900 mb-2">Verifying membership</h2>
      <p className="text-sm text-gray-500 font-medium">Checking your Network School status...</p>
    </motion.div>
  );
}

// ─── Active Pass Screen ───────────────────────────────────────────────────────
function ActivePassScreen({ partner, onClose }: { partner: any, onClose: () => void }) {
  const [time, setTime] = useState(new Date());
  const claimTime = React.useMemo(() => {
    if (partner?.claimedAt?._seconds) {
      return new Date(partner.claimedAt._seconds * 1000);
    }
    if (partner?.claimedAt) {
      return new Date(partner.claimedAt);
    }
    return new Date();
  }, [partner]);

  const partnerName = partner?.name || 'Partner Name';
  const partnerOffer = partner?.offer || 'Special Offer';
  const partnerExpiry = parseInt(partner?.expiry || '24', 10);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expireTime = new Date(claimTime.getTime() + partnerExpiry * 60 * 60 * 1000);
  const timeLeft = Math.max(0, expireTime.getTime() - time.getTime());
  const h = Math.floor(timeLeft / (1000 * 60 * 60));
  const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
  const progressPercent = (timeLeft / (partnerExpiry * 60 * 60 * 1000)) * 100;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col px-6 py-6"
    >
      <div className="flex-1 max-w-sm mx-auto w-full relative flex flex-col pt-4">
        <button 
          onClick={onClose}
          className="absolute top-0 right-0 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex flex-col items-center text-center mb-6 pt-4">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3 text-green-600">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-black tracking-tight mb-2">Network Pass Active</h2>
          <span className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full">Verified NS Member</span>
        </div>

        <div className="glass-card overflow-hidden flex-1 flex flex-col mb-4 p-0">
          <div className="p-5 bg-white/50 border-b border-white/50 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{partnerName}</span>
            <span className="text-[10px] text-gray-400 font-mono">
              {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>

          <div className="p-8 flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex items-center justify-center relative overflow-hidden">
              <QrCode className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/10 to-transparent h-1/2 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-gray-900">{partnerOffer}</p>
            <p className="text-xs text-gray-400 text-center font-medium max-w-[200px]">Show this screen to staff for immediate validation</p>
          </div>
          
          <div className="p-4 bg-gray-50/50 text-center flex flex-col items-center">
            <div className="w-full max-w-[200px] mb-2">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tighter text-gray-400 mb-1.5">
                <span>Expires in</span>
                <span className="font-mono text-gray-900 border border-gray-200/80 bg-white/80 px-1.5 py-0.5 rounded">
                  {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-black rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <p className="text-[9px] uppercase font-bold tracking-tighter text-gray-400">Valid today only • Non-transferable</p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase text-gray-500">Secure Session Active</span>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }
      `}</style>
    </motion.div>
  );
}

// ─── Not Eligible Screen ──────────────────────────────────────────────────────
function NotEligibleScreen({ error, onRetry }: { error?: string, onRetry: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col px-6 py-12 items-center text-center justify-center"
    >
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6">
        <ShieldAlert className="w-8 h-8 text-red-500" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-3">NS Members Only</h1>
      <p className="text-gray-500 text-sm max-w-xs mb-4 font-medium">This offer is currently available only to verified Network School members.</p>
      {error && <p className="text-red-500 text-xs max-w-xs mb-10 p-2 bg-red-50 rounded-lg whitespace-pre-wrap">{error}</p>}
      <button 
        onClick={onRetry}
        className="py-3 px-6 bg-gray-100 text-gray-900 rounded-full font-medium hover:bg-gray-200 transition-colors active:scale-[0.98]"
      >
        Try another account
      </button>
    </motion.div>
  );
}

// ─── Admin Screen ─────────────────────────────────────────────────────────────
function AdminScreen({ onBack }: { onBack: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'claims' | 'partners' | 'users'>('claims');

  // Selected user modal state
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Claims filter state
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Expired'>('All');

  // Data state
  const [claims, setClaims] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Partner modal state
  const [isAddPartnerModalOpen, setIsAddPartnerModalOpen] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerOffer, setNewPartnerOffer] = useState('');
  const [newPartnerStatus, setNewPartnerStatus] = useState<'Active' | 'Inactive'>('Active');
  const [newPartnerExpiry, setNewPartnerExpiry] = useState('24');
  const [savingPartner, setSavingPartner] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [claimsRes, partnersRes, usersRes] = await Promise.all([
        fetch('/api/admin/claims'),
        fetch('/api/admin/partners'),
        fetch('/api/admin/users')
      ]);
      const [claimsData, partnersData, usersData] = await Promise.all([
        claimsRes.json(),
        partnersRes.json(),
        usersRes.json()
      ]);
      if (!claimsRes.ok) throw new Error(claimsData.error || 'Failed to load claims');
      if (!partnersRes.ok) throw new Error(partnersData.error || 'Failed to load partners');
      if (!usersRes.ok) throw new Error(usersData.error || 'Failed to load users');
      setClaims(claimsData);
      setPartners(partnersData);
      setUsers(usersData);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingPartnerId(null);
    setNewPartnerName('');
    setNewPartnerOffer('');
    setNewPartnerStatus('Active');
    setNewPartnerExpiry('24');
    setIsAddPartnerModalOpen(true);
  };

  const handleOpenEditModal = (partner: any) => {
    setEditingPartnerId(partner.id);
    setNewPartnerName(partner.name);
    setNewPartnerOffer(partner.offer);
    setNewPartnerStatus(partner.status || 'Active');
    setNewPartnerExpiry(partner.expiry || '24');
    setIsAddPartnerModalOpen(true);
  };

  const handleDeletePartner = async (partner: any) => {
    if (window.confirm("Are you sure you want to delete this partner?")) {
      try {
        const res = await fetch(`/api/admin/partners/${partner.id}`, { method: 'DELETE' });
        if (res.ok) {
          setPartners(partners.filter(p => p.id !== partner.id));
        }
      } catch (e) {
        console.error("Failed to delete partner:", e);
      }
    }
  };

  const handleSavePartner = async () => {
    if (!newPartnerName || !newPartnerOffer) return;
    setSavingPartner(true);
    try {
      const payload = { name: newPartnerName, offer: newPartnerOffer, status: newPartnerStatus, expiry: newPartnerExpiry };
      if (editingPartnerId) {
        const res = await fetch(`/api/admin/partners/${editingPartnerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          setPartners(partners.map(p => p.id === editingPartnerId ? { ...p, ...payload } : p));
        }
      } else {
        const res = await fetch('/api/admin/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const newPartner = await res.json();
          setPartners([...partners, newPartner]);
        }
      }
    } catch (e) {
      console.error("Failed to save partner:", e);
    } finally {
      setSavingPartner(false);
      setIsAddPartnerModalOpen(false);
      setEditingPartnerId(null);
    }
  };

  const handleDownloadQR = (elementId: string, filename: string) => {
    const svg = document.getElementById(elementId);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      // Scale up the image by a factor of 10 to ensure high-resolution QR codes
      const scale = 10;
      canvas.width = (img.width * scale) + 80;
      canvas.height = (img.height * scale) + 80;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Disable image smoothing to retain sharp edges on scaling
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 40, 40, img.width * scale, img.height * scale);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `${filename.replace(/\s+/g, "_")}_QR.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  };

  const filteredClaims = claims.filter(c => {
    // 1. Search term
    const matchesSearch = (c.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.partnerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.discordId || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Date range
    if (filterDateFrom || filterDateTo) {
      if (!c.claimedAt?._seconds) return false;
      const claimDate = new Date(c.claimedAt._seconds * 1000);
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom + 'T00:00:00');
        if (claimDate < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo + 'T23:59:59');
        if (claimDate > toDate) return false;
      }
    }

    // 3. Partner
    if (filterPartner && c.partnerName !== filterPartner) {
      return false;
    }

    // 4. Status
    if (filterStatus !== 'All') {
      let isExpired = false;
      if (c.claimedAt?._seconds) {
        const claimedMs = c.claimedAt._seconds * 1000;
        const expiryMs = parseInt(c.expiry || '24', 10) * 60 * 60 * 1000;
        isExpired = Date.now() > claimedMs + expiryMs;
      }
      if (filterStatus === 'Active' && isExpired) return false;
      if (filterStatus === 'Expired' && !isExpired) return false;
    }

    return true;
  });

  const isAnyFilterActive = !!(filterDateFrom || filterDateTo || filterPartner || filterStatus !== 'All');

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.discordId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col pt-6 max-w-sm mx-auto w-full relative"
    >
      {/* Header */}
      <div className="px-6 mb-4 flex justify-between items-center relative z-10 w-full">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Admin Panel</h2>
          <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest mt-0.5">● Primary Access Active</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchAll}
            className="text-[10px] font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest"
          >
            Refresh
          </button>
          <button 
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl">
          <p className="text-xs text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 mb-4">
        <div className="flex bg-gray-200/50 p-1 rounded-xl">
          {(['claims', 'partners', 'users'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors capitalize ${activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Claims Tab */}
          {activeTab === 'claims' && (
            <>
              <div className="px-6 mb-4 flex flex-col gap-3">
                <div className="glass-card flex items-center gap-2 px-4 py-2 mt-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search member, discord, or partner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full text-gray-900 placeholder-gray-400"
                  />
                  <button 
                    onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} 
                    className="relative flex items-center justify-center p-1 cursor-pointer"
                  >
                    <Filter className={`w-4 h-4 ${isAnyFilterActive ? 'text-gray-900' : 'text-gray-400'}`} />
                    {isAnyFilterActive && (
                      <span className="absolute top-0 right-0 border border-white w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </button>
                </div>
                
                <AnimatePresence>
                  {isFilterPanelOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="glass-card p-4 flex flex-col gap-4 overflow-hidden rounded-xl bg-white/40"
                    >
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">From</label>
                          <input 
                            type="date" 
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg bg-white/60 border border-gray-100 outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">To</label>
                          <input 
                            type="date" 
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg bg-white/60 border border-gray-100 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Partner</label>
                        <select 
                          value={filterPartner}
                          onChange={(e) => setFilterPartner(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg bg-white/60 border border-gray-100 outline-none"
                        >
                          <option value="">All Partners</option>
                          {partners.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Status</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setFilterStatus('All')}
                            className={`flex-1 text-[10px] font-bold uppercase rounded-lg py-1.5 border transition-colors ${filterStatus === 'All' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white/60 text-gray-600 border-gray-200'}`}
                          >All</button>
                          <button 
                            onClick={() => setFilterStatus('Active')}
                            className={`flex-1 text-[10px] font-bold uppercase rounded-lg py-1.5 border transition-colors ${filterStatus === 'Active' ? 'bg-green-600 text-white border-green-600' : 'bg-white/60 text-gray-600 border-gray-200'}`}
                          >Active</button>
                          <button 
                            onClick={() => setFilterStatus('Expired')}
                            className={`flex-1 text-[10px] font-bold uppercase rounded-lg py-1.5 border transition-colors ${filterStatus === 'Expired' ? 'bg-red-600 text-white border-red-600' : 'bg-white/60 text-gray-600 border-gray-200'}`}
                          >Expired</button>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-gray-100/50 mt-1">
                        <button 
                          onClick={() => {
                            setFilterDateFrom('');
                            setFilterDateTo('');
                            setFilterPartner('');
                            setFilterStatus('All');
                          }}
                          className="text-[10px] uppercase font-bold text-gray-400 hover:text-gray-900 tracking-wider transition-colors"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="px-6 space-y-3 flex-1 flex flex-col z-10 overflow-y-auto pb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">LATEST CLAIMS</span>
                  <span className="text-[10px] font-bold text-gray-400">{filteredClaims.length} results</span>
                </div>
                {filteredClaims.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400 font-medium">No claims found.</p>
                  </div>
                )}
                {filteredClaims.map((claim) => {
                  const isExpired = (() => {
                    if (!claim.claimedAt?._seconds) return false;
                    const claimedMs = claim.claimedAt._seconds * 1000;
                    const expiryMs = parseInt(claim.expiry || '24', 10) * 60 * 60 * 1000;
                    return Date.now() > claimedMs + expiryMs;
                  })();
                  return (
                  <div key={claim.id} className="glass-card p-4 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/50 border border-gray-100/50 flex items-center justify-center text-xs font-bold text-gray-600">
                      {(claim.userName || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{claim.userName || 'Unknown'}</p>
                      <p className="text-[10px] text-gray-500 tracking-wide font-mono mt-0.5">{claim.discordId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-900">{claim.partnerName || 'Unknown'}</p>
                      <p className={`text-[9px] font-bold uppercase mt-1 ${isExpired ? 'text-red-500' : 'text-green-600'}`}>
                        {isExpired ? 'Expired' : 'Active'}
                      </p>
                    </div>
                  </div>
                  );
                })}
                <div className="mt-auto pt-6 pb-6 border-t border-gray-200/50 flex justify-between items-center px-10">
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-gray-900">{claims.length}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total Claims</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Partners Tab */}
          {activeTab === 'partners' && (
            <div className="px-6 flex-1 flex flex-col z-10 overflow-y-auto pb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ACTIVE PARTNERS</span>
                <button 
                  onClick={handleOpenAddModal}
                  className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:text-blue-700"
                >
                  + Add New
                </button>
              </div>
              {partners.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400 font-medium">No partners yet.</p>
                </div>
              )}
              <div className="space-y-3">
                {partners.map((partner) => (
                  <div key={partner.id} className={`glass-card p-4 rounded-2xl flex items-center gap-3 ${partner.status === 'Inactive' ? 'opacity-60' : ''}`}>
                    <div className="w-12 h-12 rounded-xl bg-white/50 border border-gray-100/50 flex flex-col items-center justify-center shrink-0 p-1">
                      <QRCode 
                        id={`qr-${partner.id}`}
                        value={JSON.stringify({ id: partner.id, name: partner.name, offer: partner.offer, expiry: partner.expiry })} 
                        size={40} 
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{partner.name}</p>
                      <p className="text-[10px] text-gray-500 tracking-wide font-medium mt-0.5">{partner.offer} • {partner.expiry}h expiry</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${partner.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {partner.status || 'Active'}
                      </span>
                      <div className="flex gap-2 text-[10px] font-bold text-gray-400">
                        <button onClick={() => handleDownloadQR(`qr-${partner.id}`, partner.name)} className="hover:text-gray-900 underline underline-offset-2">QR</button>
                        <button onClick={() => handleOpenEditModal(partner)} className="hover:text-gray-900 underline underline-offset-2">Edit</button>
                        <button onClick={() => handleDeletePartner(partner)} className="hover:text-red-600 text-red-400 underline underline-offset-2">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <>
              <div className="px-6 mb-4">
                <div className="glass-card flex items-center gap-2 px-4 py-2 mt-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search by name, discord, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="px-6 flex-1 flex flex-col z-10 overflow-y-auto pb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">REGISTERED USERS</span>
                  <span className="text-[10px] font-bold text-gray-400">{filteredUsers.length} total</span>
                </div>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400 font-medium">No users found.</p>
                  </div>
                )}
                <div className="space-y-3">
                  {filteredUsers.map((u) => (
                    <div key={u.id} onClick={() => setSelectedUser(u)} className="glass-card p-4 rounded-2xl flex items-center gap-3 w-full text-left hover:bg-white/90 transition-colors cursor-pointer">
                      {u.discordAvatar ? (
                        <img src={`https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png`} alt={u.name} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600">
                          {(u.name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{u.name || 'Unknown'}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">{u.discordId}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${u.memberStatus ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                          {u.memberStatus ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Add/Edit Partner Modal */}
      <AnimatePresence>
        {isAddPartnerModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center p-6 pb-0 bg-black/20 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl rounded-b-none p-6 w-full max-w-sm shadow-xl overflow-y-auto max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">{editingPartnerId ? 'Edit Partner' : 'Add New Partner'}</h3>
                <button onClick={() => setIsAddPartnerModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editingPartnerId && (
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-2xl border border-gray-200 mb-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Partner QR Code</p>
                  <div className="bg-white p-3 rounded-xl shadow-sm mb-3">
                    <QRCode 
                      id={`modal-qr-${editingPartnerId}`}
                      value={JSON.stringify({ id: editingPartnerId, name: newPartnerName, offer: newPartnerOffer, expiry: newPartnerExpiry })} 
                      size={120} 
                    />
                  </div>
                  <button 
                    onClick={() => handleDownloadQR(`modal-qr-${editingPartnerId}`, newPartnerName)}
                    className="bg-white border border-gray-200 text-sm font-bold text-gray-800 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    Download as Image
                  </button>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Partner Name</label>
                  <input 
                    type="text" value={newPartnerName} onChange={(e) => setNewPartnerName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    placeholder="e.g. Beach Bar"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Offer</label>
                  <input 
                    type="text" value={newPartnerOffer} onChange={(e) => setNewPartnerOffer(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    placeholder="e.g. 10% Off Today"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Expiry (Hours)</label>
                  <input 
                    type="number" value={newPartnerExpiry} onChange={(e) => setNewPartnerExpiry(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    placeholder="e.g. 24" min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setNewPartnerStatus('Active')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${newPartnerStatus === 'Active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Active</button>
                    <button onClick={() => setNewPartnerStatus('Inactive')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${newPartnerStatus === 'Inactive' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Inactive</button>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSavePartner}
                disabled={savingPartner || !newPartnerName || !newPartnerOffer}
                className="w-full bg-black text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-gray-900 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingPartner ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Partner'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected User Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl relative"
            >
              <button 
                onClick={() => setSelectedUser(null)} 
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center mb-6 mt-2">
                {selectedUser.discordAvatar ? (
                  <img src={`https://cdn.discordapp.com/avatars/${selectedUser.discordId}/${selectedUser.discordAvatar}.png`} alt={selectedUser.name} className="w-20 h-20 rounded-2xl object-cover mb-4" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl font-bold text-blue-600 mb-4">
                    {(selectedUser.name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900">{selectedUser.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{selectedUser.discordId}</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email</span>
                  <span className="text-sm font-medium text-gray-900 truncate ml-4">{selectedUser.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${selectedUser.memberStatus ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {selectedUser.memberStatus ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 pb-3 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Roles</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedUser.roles && selectedUser.roles.length > 0 ? selectedUser.roles.map((role: string) => (
                      <span key={role} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                        {role}
                      </span>
                    )) : <span className="text-xs text-gray-500">None</span>}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Last Login</span>
                  <span className="text-xs text-gray-600 text-right">
                    {selectedUser.lastLogin?._seconds 
                      ? new Date(selectedUser.lastLogin._seconds * 1000).toLocaleString() 
                      : (selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never')}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Passes Screen ────────────────────────────────────────────────────────────
function PassesScreen({ user, onBack, onOpenPass }: { user: any, onBack: () => void, onOpenPass: (partner: any) => void }) {
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPasses = async () => {
      if (!user?.discordId) { setLoading(false); return; }
      try {
        const res = await fetch('/api/admin/claims');
        const data = await res.json();
        const userPasses = data.filter((c: any) => c.discordId === user.discordId);
        setPasses(userPasses);
      } catch (e) {
        console.error("Failed to fetch passes:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPasses();
  }, [user]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-6 py-6 max-w-sm mx-auto w-full relative"
    >
      <div className="mb-6 flex justify-between items-end relative z-10 w-full pt-2">
        <h2 className="text-xl font-bold tracking-tight text-gray-900">My Passes</h2>
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:bg-gray-50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 flex-1 flex flex-col z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : passes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 font-medium">No active passes yet.</p>
          </div>
        ) : passes.map((pass) => {
          const isExpired = (() => {
            if (!pass.claimedAt?._seconds) return false;
            const claimedMs = pass.claimedAt._seconds * 1000;
            const expiryMs = parseInt(pass.expiry || '24', 10) * 60 * 60 * 1000;
            return Date.now() > claimedMs + expiryMs;
          })();
          
          return (
          <button 
            key={pass.id} 
            onClick={() => !isExpired && onOpenPass(pass)}
            className={`glass-card p-4 rounded-2xl flex items-center gap-4 text-left w-full transition-colors ${isExpired ? 'opacity-60 cursor-default' : 'hover:bg-white/90 cursor-pointer'}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-white/50 border border-gray-100/50 flex items-center justify-center font-bold text-gray-600">
              {(pass.partnerName || 'P').split(' ').map((n: any) => n[0]).join('').toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{pass.partnerName}</p>
              <p className="text-[10px] text-gray-500 tracking-wide font-medium mt-0.5">{pass.offer}</p>
            </div>
            <div className="text-right">
              <p className={`text-[9px] font-bold uppercase mt-1 px-2 py-0.5 rounded-sm inline-block ${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {isExpired ? 'Expired' : 'Active'}
              </p>
            </div>
          </button>
        )})}
      </div>
    </motion.div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────
function ProfileScreen({ user, onBack, onLogout, isAdmin, onAdminClick }: { user: any, onBack: () => void, onLogout: () => void, isAdmin: boolean, onAdminClick: () => void }) {
  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'NS';
  const role = user?.roles?.[0] || 'Member';

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col bg-gray-50 pb-8 h-full overflow-y-auto"
    >
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-[40px] shadow-sm relative mb-6">
        <button onClick={onBack} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center absolute top-6 left-6">
          <ChevronRight className="w-5 h-5 text-gray-900 rotate-180" />
        </button>
        <div className="flex flex-col items-center mt-6">
          {user?.discordAvatar ? (
            <img src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png`} alt={user.name} className="w-24 h-24 rounded-[32px] shadow-inner mb-4 object-cover" />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-[32px] flex items-center justify-center shadow-inner mb-4">
              <span className="text-3xl font-bold text-blue-900">{initials}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{user?.name || 'Network School Member'}</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">{user?.email || ''}</p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-xl">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-green-700 uppercase tracking-widest">Active Member</span>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Affiliation Details</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-600">Institution</span>
              <span className="text-sm font-bold text-gray-900">Network School</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-600">Role</span>
              <span className="text-sm font-bold text-gray-900">{role}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Discord ID</span>
              <span className="text-sm font-mono text-gray-900">{user?.discordId || '—'}</span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <button onClick={onAdminClick} className="w-full bg-white border border-gray-200 text-gray-900 py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
            <Network className="w-4 h-4" />
            Admin Control Board
          </button>
        )}
        
        <button onClick={onLogout} className="w-full bg-white border border-gray-200 text-red-600 py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </motion.div>
  );
}