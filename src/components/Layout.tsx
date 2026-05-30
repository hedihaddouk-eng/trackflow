
import React from 'react';
import { User as UserIcon, LogOut, Power, Settings as SettingsIcon, Package, Scan, BarChart3, Clock, History, Code, Database, Menu, X, Languages } from 'lucide-react';
import { User as UserType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Language } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  user: UserType;
  onLogout: () => void;
  logoUrl?: string;
  isLocked?: boolean;
  lang: Language;
  onLangChange: (lang: Language) => void;
}

export function Layout({ children, user, onLogout, logoUrl, isLocked = false, lang, onLangChange }: LayoutProps) {
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const t = {
    fr: { system: 'Système Optique OK', timeLocale: 'fr-FR' },
    en: { system: 'Optical System OK', timeLocale: 'en-US' },
  }[lang];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#1E293B] flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="h-20 border-b border-[#E2E8F0] bg-white z-30 shrink-0 no-print sticky top-0">
        <div className="max-w-[1600px] mx-auto h-full w-full flex items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 bg-[#0066FF] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Package size={24} className="text-white" />
              )}
            </div>
            <div className="hidden sm:block">
              <span className="font-black tracking-tighter text-xl text-[#0F172A] block leading-none">TRACKFLOW</span>
              <span className="text-[9px] font-mono text-[#0066FF] font-bold uppercase tracking-[0.2em]">Systems v2.0-PRO</span>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="hidden lg:flex items-center gap-6">
              <div className="flex items-center gap-2 font-mono text-[10px] font-black text-[#64748B] bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                <Clock size={14} className="text-[#0066FF]" />
                <span>{time.toLocaleTimeString(t.timeLocale)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{t.system}</span>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => onLangChange('fr')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-black transition-all flex items-center gap-2",
                  lang === 'fr' ? "bg-white text-[#0066FF] shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
                title="Français"
              >
                <span className="text-base leading-none">🇫🇷</span>
                <span className="hidden sm:inline">FR</span>
              </button>
              <button 
                onClick={() => onLangChange('en')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-black transition-all flex items-center gap-2",
                  lang === 'en' ? "bg-white text-[#0066FF] shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
                title="English"
              >
                <span className="text-base leading-none">🇺🇸</span>
                <span className="hidden sm:inline">EN</span>
              </button>
            </div>
            
            <div className="flex items-center gap-3 md:gap-4 pl-4 md:pl-6 border-l border-slate-100">
              {!isLocked && (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] font-black text-[#0F172A] leading-none uppercase">{user.name}</div>
                    <div className="text-[9px] font-bold text-[#0066FF] uppercase tracking-[0.2em]">{user.role}</div>
                  </div>
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shadow-sm", 
                    user.role === 'supervisor' ? 'bg-blue-50 text-[#0066FF]' : 
                    user.role === 'engineering' ? 'bg-purple-50 text-purple-600' : 
                    'bg-emerald-50 text-emerald-600'
                  )}>
                    <UserIcon size={20} />
                  </div>
                </div>
              )}
              
              <button
                onClick={onLogout}
                className="p-3 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all border border-slate-200 active:scale-90 group"
                title="DÉCONNEXION"
              >
                <Power size={20} className="group-hover:rotate-12 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-4 md:p-8 relative scrollbar-hide">
        {/* Logo Background Watermark */}
        {logoUrl && (
          <div className="fixed bottom-[-10%] right-[-5%] opacity-[0.03] pointer-events-none z-0 rotate-[-15deg]">
            <img src={logoUrl} alt="" className="w-[600px] grayscale brightness-125 contrast-125" />
          </div>
        )}
        
        <div className={cn(
          "max-w-7xl mx-auto relative z-10 transition-all duration-500",
          isLocked ? "blur-md pointer-events-none scale-[0.98]" : "blur-0 scale-100"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className={cn(
      "w-full flex items-center gap-4 px-5 py-4 rounded-xl text-sm transition-all group font-bold tracking-tight mb-1",
      active ? "bg-[#0066FF] text-white shadow-lg shadow-blue-500/20" : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]"
    )}>
      <span className={active ? "text-white" : "text-[#94A3B8] group-hover:text-[#0066FF]"}>{icon}</span>
      <span>{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />}
    </button>
  );
}
