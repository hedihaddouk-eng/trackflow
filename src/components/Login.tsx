
import React, { useState } from 'react';
import { Shield, User as UserIcon, Lock, Cpu, Settings as SettingsIcon } from 'lucide-react';
import { Role, User, Settings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

import { Language } from '../App';

interface LoginProps {
  onLogin: (user: User) => void;
  settings: Settings;
  lang: Language;
}

export default function Login({ onLogin, settings, lang }: LoginProps) {
  const [selectedRole, setSelectedRole] = useState<Role>('operator');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  const t = {
    fr: {
      title: 'ACCÈS SYSTÈME',
      subtitle: 'Authentification Requise',
      role: 'SÉLECTIONNEZ VOTRE RÔLE',
      operator: 'Opérateur',
      supervisor: 'Superviseur',
      engineering: 'Engineering',
      identifiant: 'Identifiant',
      password: 'Mot de Passe',
      placeholderName: 'Prénom ou Login',
      loginBtn: "VALIDER L'ACCÈS",
      error: 'IDENTIFIANTS INCORRECTS',
      connected: 'Connecté au Serveur'
    },
    en: {
      title: 'SYSTEM ACCESS',
      subtitle: 'Authentication Required',
      role: 'SELECT YOUR ROLE',
      operator: 'Operator',
      supervisor: 'Supervisor',
      engineering: 'Engineering',
      identifiant: 'Username',
      password: 'Password',
      placeholderName: 'First name or Login',
      loginBtn: 'VALIDATE ACCESS',
      error: 'INCORRECT CREDENTIALS',
      connected: 'Server Connected'
    }
  }[lang];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    let correctPassword = '';
    let isOperatorLoginMatch = false;

    if (selectedRole === 'supervisor') correctPassword = settings.supervisorPassword;
    else if (selectedRole === 'operator') {
      correctPassword = settings.operatorPassword;
      // Also check against defined operator accounts
      const account = settings.operatorAccounts?.find(a => a.login.toLowerCase() === name.toLowerCase());
      if (account && password === account.password) {
        isOperatorLoginMatch = true;
      }
    }
    else if (selectedRole === 'engineering') correctPassword = settings.engineeringPassword;

    if (isOperatorLoginMatch || password === correctPassword) {
      onLogin({
        id: Math.random().toString(36).substr(2, 9),
        role: selectedRole,
        name: name || (selectedRole === 'supervisor' ? 'Superviseur' : selectedRole === 'engineering' ? 'Ingénieur' : 'Opérateur'),
      });
    } else {
      setError(t.error);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_32px_64px_rgba(0,102,255,0.15)] border border-[#E2E8F0] overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-[#0066FF]" />
      
      <div className="p-10">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-[#0066FF] rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 overflow-hidden group">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
            ) : (
              <Cpu size={32} className="text-white" />
            )}
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-tight text-[#0F172A] mb-1">{t.title}</h1>
          <p className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-[0.3em]">{t.subtitle}</p>
        </div>

        {/* Role Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
          {(['operator', 'supervisor', 'engineering'] as Role[]).map((role) => (
            <button
              key={role}
              onClick={() => { setSelectedRole(role); setError(''); }}
              className={cn(
                "flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                selectedRole === role 
                  ? "bg-white text-[#0066FF] shadow-sm" 
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
            >
              {role === 'operator' ? t.operator : role === 'supervisor' ? t.supervisor : t.engineering}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest pl-1">{t.identifiant}</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.placeholderName}
                className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl pl-12 pr-5 py-3.5 text-sm font-bold focus:outline-none focus:border-[#0066FF] focus:ring-4 focus:ring-blue-100 transition-all shadow-inner"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest pl-1">{t.password}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl pl-12 pr-5 py-3.5 text-sm font-bold focus:outline-none focus:border-[#0066FF] focus:ring-4 focus:ring-blue-100 transition-all font-mono shadow-inner"
                required
                autoFocus
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 text-red-500 text-[10px] p-3 rounded-xl font-bold border border-red-100 flex items-center gap-2"
              >
                <Shield size={14} /> {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/25 transition-all mt-4 uppercase tracking-widest text-xs active:scale-[0.98]"
          >
            {t.loginBtn}
          </button>
        </form>
      </div>
      
      <div className="bg-slate-50 px-10 py-4 border-t border-[#F1F5F9] flex justify-between items-center">
        <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">{t.connected}</span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
