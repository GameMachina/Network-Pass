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
  const [loginError, setLoginError] = useState<string | undefined>();

  // Utility to handle navigation with a fake loading delay if requested
  const navigateTo = (screen: Screen, delay = 0) => {
    if (delay > 0) {
      setCurrentScreen('loading');
      setTimeout(() => setCurrentScreen(screen), delay);
    } else {
      setCurrentScreen(screen);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-md mx-auto bg-transparent relative overflow-hidden">
      <div className="mesh-bg fixed" />
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <LogoIcon className="w-6 h-6 text-black" />
          <span className="font-semibold text-sm tracking-tight">Network Pass</span>
        </div>
        <button 
          onClick={() => navigateTo('admin')}
          className="text-xs font-medium text-gray-400 hover:text-gray-900 transition-colors"
        >
          Admin
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">
        <AnimatePresence mode="wait">
          {currentScreen === 'login' && <LoginScreen key="login" onLogin={(userData) => { setUser(userData); navigateTo('home'); }} onFail={(err) => { setLoginError(err); navigateTo('not_eligible'); }} />}
          {currentScreen === 'home' && <HomeScreen key="home" user={user} onScanClick={() => navigateTo('scan')} onViewPasses={() => navigateTo('passes')} onProfileClick={() => navigateTo('profile')} />}
          {currentScreen === 'scan' && <ScanScreen key="scan" onScan={(data) => {
            try {
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
          }} />}
          {currentScreen === 'claim' && <ClaimScreen key="claim" partner={scannedPartner} onClaim={() => navigateTo('active', 1000)} />}
          {currentScreen === 'loading' && <LoadingScreen key="loading" />}
          {currentScreen === 'active' && <ActivePassScreen key="active" partner={scannedPartner} onClose={() => navigateTo('passes')} />}
          {currentScreen === 'not_eligible' && <NotEligibleScreen key="not_eligible" error={loginError} onRetry={() => navigateTo('login')} />}
          {currentScreen === 'admin' && <AdminScreen key="admin" onBack={() => navigateTo('login')} />}
          {currentScreen === 'passes' && <PassesScreen key="passes" onBack={() => navigateTo('home')} onOpenPass={() => navigateTo('active')} />}
          {currentScreen === 'profile' && <ProfileScreen key="profile" user={user} onBack={() => navigateTo('home')} onLogout={() => { setUser(null); navigateTo('login'); }} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, onFail }: { onLogin: (data: any) => void, onFail: (err?: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState<string>('');

  useEffect(() => {
    // Check if we already have a code in URL (e.g. redirected back on mobile)
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    
    if (urlCode) {
      // Clear code from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const processCode = async () => {
         setLoading(true);
         try {
            const redirectUri = `${window.location.origin}/auth/callback`;
            const verifyRes = await fetch('/api/auth/verify', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ code: urlCode, redirectUri })
            });
            const data = await verifyRes.json();
            if (verifyRes.ok && data.member) {
               onLogin(data);
            } else {
               onFail(data.error || "Verification failed or you are not a member.");
            }
         } catch (e: any) {
            console.error(e);
            onFail(e.message || "Network error occurred.");
         } finally {
            setLoading(false);
         }
      };
      
      processCode();
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
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
         return;
      }
      if (event.data?.type === 'OAUTH_AUTH_CODE') {
         setLoading(true);
         try {
            const redirectUri = `${window.location.origin}/auth/callback`;
            const verifyRes = await fetch('/api/auth/verify', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ code: event.data.code, redirectUri })
            });
            const data = await verifyRes.json();
            if (verifyRes.ok && data.member) {
               onLogin(data);
            } else {
               onFail(data.error || "Verification failed or you are not a member.");
            }
         } catch (e: any) {
            console.error(e);
            onFail(e.message || "Network error occurred.");
         } finally {
            setLoading(false);
         }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLogin, onFail]);

  const handleConnect = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      e.preventDefault(); // Prevent default link navigation on desktop to use popup
      if (!authUrl) return;
      const authWindow = window.open(authUrl, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
         alert("Please allow popups to connect your account.");
      }
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
          
          <button 
            onClick={() => onFail()}
            className="w-full text-xs text-gray-400 text-center hover:text-gray-900 underline underline-offset-4 decoration-gray-200"
          >
            (Simulate Invalid Member)
          </button>
        </div>

        <div className="mt-6 text-center">
          <span className="text-[10px] tracking-widest text-gray-400 uppercase font-bold mb-4 block">Powered by Network Pass</span>
          
          <div className="text-[10px] text-gray-400 mt-2 max-w-[280px] mx-auto break-all leading-tight border border-gray-100 rounded-lg p-2 bg-gray-50 text-left">
            <span className="font-semibold text-gray-600 block mb-1">Make sure you added this EXACT URI to the Discord Developer Portal:</span>
            {window.location.origin}/auth/callback
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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
              <p className="text-xs text-gray-500 font-medium">1 Active Offer</p>
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
             {/* Overlay for scanning area */}
             <div className="absolute inset-0 border-2 border-white/20 pointer-events-none rounded-[24px]" />
           </div>
        </div>

        <div className="mt-10 text-center px-4">
          <p className="text-xs text-gray-400 font-medium leading-relaxed mb-6">
            Please make sure camera permissions are enabled for this experience.
          </p>
          <button 
             onClick={() => onScan("mock_data")} 
             className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-gray-900 transition-colors"
          >
             Skip (Mock Scan)
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ClaimScreen({ partner, onClaim }: { partner: any, onClaim: () => void }) {
  const partnerName = partner?.name || 'Partner Name';
  const partnerOffer = partner?.offer || 'Special Offer';
  const shortName = partnerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

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
        
        {/* Partner Card */}
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
            onClick={onClaim}
            className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-900 transition-transform active:scale-[0.98]"
          >
            <span>Claim Offer</span>
          </button>
        </div>

        <div className="mt-6 text-center">
          <span className="text-[10px] tracking-widest text-gray-400 uppercase font-bold">Powered by Network Pass</span>
        </div>
      </div>
    </motion.div>
  );
}

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

function ActivePassScreen({ partner, onClose }: { partner: any, onClose: () => void }) {
  const [time, setTime] = useState(new Date());
  const [claimTime] = useState(() => new Date());

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
  const totalDuration = partnerExpiry * 60 * 60 * 1000;
  const progressPercent = (timeLeft / totalDuration) * 100;

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

        {/* The Pass Card */}
        <div className="glass-card overflow-hidden flex-1 flex flex-col mb-4 p-0">
          
          {/* Header */}
          <div className="p-5 bg-white/50 border-b border-white/50 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{partnerName}</span>
            <span className="text-[10px] text-gray-400 font-mono">
              {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>

          {/* Body */}
          <div className="p-8 flex-1 flex flex-col items-center justify-center gap-4">
            
            {/* Dynamic visual element (mock QR) */}
            <div className="w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex items-center justify-center relative overflow-hidden group">
               <QrCode className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
               {/* scanning line animation */}
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

function AdminScreen({ onBack }: { onBack: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'claims' | 'partners'>('claims');
  const [partners, setPartners] = useState([
    { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Beach Bar', offer: '10% Off Today', status: 'Active' as 'Active' | 'Inactive', expiry: '24' },
    { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Coworking Hub', offer: 'Free Day Pass', status: 'Active' as 'Active' | 'Inactive', expiry: '48' },
    { id: '123e4567-e89b-12d3-a456-426614174002', name: 'Coffee Shop', offer: '15% Off', status: 'Inactive' as 'Active' | 'Inactive', expiry: '24' },
  ]);
  const [isAddPartnerModalOpen, setIsAddPartnerModalOpen] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerOffer, setNewPartnerOffer] = useState('');
  const [newPartnerStatus, setNewPartnerStatus] = useState<'Active' | 'Inactive'>('Active');
  const [newPartnerExpiry, setNewPartnerExpiry] = useState('24');

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
    setNewPartnerStatus(partner.status);
    setNewPartnerExpiry(partner.expiry || '24');
    setIsAddPartnerModalOpen(true);
  };
  
  const handleDownloadQR = (elementId: string, filename: string) => {
    const svg = document.getElementById(elementId);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      // Add padding for better scanning
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `${filename.replace(/\s+/g, "_")}_QR.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  };
  
  const mockClaims = [
    { id: '1', name: 'Jalen Smith', discord: 'jalen#1234', partner: 'Beach Bar', time: '14:28', type: 'Member', status: 'Claimed' },
    { id: '2', name: 'Alex Johnson', discord: 'ajohnson#9921', partner: 'Beach Bar', time: '13:52', type: 'Core', status: 'Claimed' },
    { id: '3', name: 'Sarah Lee', discord: 'sleepper#4432', partner: 'Coworking Hub', time: '12:15', type: 'Member', status: 'Expired' },
    { id: '4', name: 'Mike Ross', discord: 'miker#1122', partner: 'Coffee Shop', time: '09:30', type: 'Member', status: 'Claimed' },
    { id: '5', name: 'Emma Doe', discord: 'emmad#5544', partner: 'Beach Bar', time: 'Yesterday', type: 'Builder', status: 'Expired' },
  ];

  const filteredClaims = mockClaims.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.partner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.discord.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col pt-6 max-w-sm mx-auto w-full relative"
    >
      <div className="px-6 mb-4 flex justify-between items-end relative z-10 w-full">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Admin Panel</h2>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-6 mb-6">
        <div className="flex bg-gray-200/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('claims')}
            className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${activeTab === 'claims' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Claims
          </button>
          <button 
            onClick={() => setActiveTab('partners')}
            className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${activeTab === 'partners' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Partners
          </button>
        </div>
      </div>

      {activeTab === 'claims' ? (
        <>
          <div className="px-6 mb-4">
            <div className="glass-card flex items-center gap-2 px-4 py-2 mt-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search member, discord, or partner..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full text-gray-900 placeholder-gray-400"
              />
              <Filter className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-900" />
            </div>
          </div>

          <div className="px-6 space-y-3 flex-1 flex flex-col z-10 overflow-y-auto pb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">LATEST CLAIMS</span>
              <span className="text-[10px] font-bold text-gray-400">{filteredClaims.length} results</span>
            </div>
            {filteredClaims.map((claim) => (
              <div key={claim.id} className={`glass-card p-4 rounded-2xl flex items-center gap-3 ${claim.status === 'Expired' ? 'opacity-60' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-white/50 border border-gray-100/50 flex items-center justify-center text-xs font-bold text-gray-600">
                  {claim.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{claim.name}</p>
                  <p className="text-[10px] text-gray-500 tracking-wide font-mono mt-0.5">{claim.discord} • {claim.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">{claim.partner}</p>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <p className="text-[10px] font-bold text-gray-500">{claim.time}</p>
                    <p className={`text-[9px] font-bold uppercase ${claim.status === 'Claimed' ? 'text-green-600' : 'text-gray-400'}`}>
                      • {claim.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {filteredClaims.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-gray-500 font-medium">No claims match your search.</p>
              </div>
            )}
          </div>
          
          <div className="mt-auto pt-6 pb-6 border-t border-gray-200/50 flex justify-between items-center px-10">
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-gray-900">128</p>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total Claims</p>
            </div>
            <div className="w-[1px] h-8 bg-gray-200/50"></div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold text-gray-900">$842</p>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Est. Savings</p>
            </div>
          </div>
        </>
      ) : (
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
          <div className="space-y-3">
            {partners.map((partner) => (
              <div key={partner.id} className={`glass-card p-4 rounded-2xl flex items-center gap-3 ${partner.status === 'Inactive' ? 'opacity-60' : ''}`}>
                <div className="w-12 h-12 rounded-xl bg-white/50 border border-gray-100/50 flex flex-col items-center justify-center shrink-0 p-1">
                  <QRCode 
                    id={`qr-${partner.id}`}
                    value={JSON.stringify({ 
                      id: partner.id, 
                      name: partner.name, 
                      offer: partner.offer,
                      expiry: partner.expiry 
                    })} 
                    size={40} 
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{partner.name}</p>
                  <p className="text-[10px] text-gray-500 tracking-wide font-medium mt-0.5">{partner.offer} • {partner.expiry}h expiry</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${partner.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {partner.status}
                  </span>
                  <div className="flex gap-2 text-[10px] font-bold text-gray-400">
                    <button 
                      onClick={() => handleDownloadQR(`qr-${partner.id}`, partner.name)}
                      className="hover:text-gray-900 underline underline-offset-2"
                    >
                      Download QR
                    </button>
                    <button 
                      onClick={() => handleOpenEditModal(partner)}
                      className="hover:text-gray-900 underline underline-offset-2"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isAddPartnerModalOpen && (
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
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">{editingPartnerId ? 'Edit Partner' : 'Add New Partner'}</h3>
                <button 
                  onClick={() => setIsAddPartnerModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {editingPartnerId && (
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-200 mb-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Partner QR Code</p>
                    <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
                      <QRCode 
                        id={`modal-qr-${editingPartnerId}`}
                        value={JSON.stringify({ 
                          id: editingPartnerId, 
                          name: newPartnerName, 
                          offer: newPartnerOffer,
                          expiry: newPartnerExpiry
                        })} 
                        size={120} 
                      />
                    </div>
                    <button 
                      onClick={() => handleDownloadQR(`modal-qr-${editingPartnerId}`, newPartnerName)}
                      className="bg-white border border-gray-200 text-sm font-bold text-gray-800 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                    >
                      Download as Image
                    </button>
                    <p className="text-[10px] text-gray-400 mt-4 text-center max-w-[200px]">
                      Users can scan this code to claim the {newPartnerOffer} offer.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Partner Name</label>
                  <input 
                    type="text" 
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    placeholder="e.g. Beach Bar"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Offer</label>
                  <input 
                    type="text" 
                    value={newPartnerOffer}
                    onChange={(e) => setNewPartnerOffer(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    placeholder="e.g. 10% Off Today"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Expiry Time (Hours)</label>
                  <input 
                    type="number" 
                    value={newPartnerExpiry}
                    onChange={(e) => setNewPartnerExpiry(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    placeholder="e.g. 24"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setNewPartnerStatus('Active')}
                      className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${newPartnerStatus === 'Active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Active
                    </button>
                    <button 
                      onClick={() => setNewPartnerStatus('Inactive')}
                      className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${newPartnerStatus === 'Inactive' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  if (newPartnerName && newPartnerOffer) {
                    if (editingPartnerId) {
                      setPartners(partners.map(p => p.id === editingPartnerId ? { ...p, name: newPartnerName, offer: newPartnerOffer, status: newPartnerStatus, expiry: newPartnerExpiry } : p));
                    } else {
                      setPartners([...partners, { id: crypto.randomUUID(), name: newPartnerName, offer: newPartnerOffer, status: newPartnerStatus, expiry: newPartnerExpiry }]);
                    }
                    setIsAddPartnerModalOpen(false);
                    setEditingPartnerId(null);
                    setNewPartnerName('');
                    setNewPartnerOffer('');
                    setNewPartnerExpiry('24');
                    setNewPartnerStatus('Active');
                  }
                }}
                className="w-full bg-black text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-gray-900 transition-transform active:scale-[0.98]"
              >
                Save Partner
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PassesScreen({ onBack, onOpenPass }: { onBack: () => void, onOpenPass: () => void }) {
  const userPasses = [
    { id: '1', partner: 'Beach Bar', offer: '10% Off Today', time: 'Active', status: 'Active' },
    { id: '2', partner: 'Coworking Hub', offer: 'Free Day Pass', time: 'Yesterday', status: 'Expired' },
    { id: '3', partner: 'Coffee Shop', offer: '15% Off', time: 'Last Week', status: 'Expired' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col px-6 py-6 max-w-sm mx-auto w-full relative"
    >
      <div className="mb-6 flex justify-between items-end relative z-10 w-full pt-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">My Passes</h2>
        </div>
        <button 
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 flex-1 flex flex-col z-10">
        {userPasses.map((pass) => (
          <button 
            key={pass.id} 
            onClick={() => pass.status === 'Active' ? onOpenPass() : undefined}
            className={`glass-card p-4 rounded-2xl flex items-center gap-4 text-left w-full ${pass.status === 'Expired' ? 'opacity-60 cursor-default' : 'hover:bg-white/90 transition-colors cursor-pointer'}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-white/50 border border-gray-100/50 flex items-center justify-center font-bold text-gray-600">
              {pass.partner.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{pass.partner}</p>
              <p className="text-[10px] text-gray-500 tracking-wide font-medium mt-0.5">{pass.offer}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-900">{pass.time}</p>
              <p className={`text-[9px] font-bold uppercase mt-1 px-2 py-0.5 rounded-sm inline-block ${pass.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {pass.status}
              </p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ProfileScreen({ user, onBack, onLogout }: { user: any, onBack: () => void, onLogout: () => void }) {
  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'NS';
  const role = user?.roles?.[0] || user?.userType || 'Member';

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col bg-gray-50 pb-8 h-full overflow-y-auto"
    >
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-[40px] shadow-sm relative mb-6">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center absolute top-6 left-6"
        >
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
          <p className="text-sm font-medium text-gray-500 mt-1">{user?.email || 'verified@networkschool.com'}</p>
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
                 <span className="text-sm font-medium text-gray-600">Member Since</span>
                 <span className="text-sm font-bold text-gray-900">2023</span>
              </div>
           </div>
        </div>
        
        <button 
           onClick={onLogout}
           className="w-full bg-white border border-gray-200 text-red-600 py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
        >
           <LogOut className="w-4 h-4" />
           Sign Out
        </button>
      </div>
    </motion.div>
  );
}

