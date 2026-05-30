/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { dataService } from './services/dataService';
import { Role, User, Settings } from './types';
import Login from './components/Login';
import SupervisorView from './components/Supervisor/SupervisorView';
import OperatorView from './components/Operator/OperatorView';
import EngineeringView from './components/Engineering/EngineeringView';
import { Layout } from './components/Layout';

export type Language = 'fr' | 'en';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Language>('fr');

  useEffect(() => {
    async function init() {
      // First try to migrate any local data to server
      await dataService.migrateFromLocalStorage();
      
      const s = await dataService.getSettings();
      setSettings(s);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center font-mono">
        <div className="text-white animate-pulse">CHARGEMENT DU SYSTÈME...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC] font-sans">
      {/* Background View - Operator View is the default direct interface */}
      <Layout 
        user={user || { id: 'temp', role: 'operator', name: 'Système' }} 
        onLogout={() => setUser(null)} 
        logoUrl={settings?.logoUrl}
        isLocked={!user}
        lang={lang}
        onLangChange={setLang}
      >
        {user?.role === 'supervisor' ? (
          <SupervisorView user={user} settings={settings!} onSettingsUpdate={setSettings} lang={lang} />
        ) : user?.role === 'engineering' ? (
          <EngineeringView user={user} settings={settings!} onSettingsUpdate={setSettings} lang={lang} />
        ) : (
          <OperatorView user={user || { id: 'temp', role: 'operator', name: 'Système' }} settings={settings!} lang={lang} />
        )}
      </Layout>

      {/* Login Modal Overlay */}
      {!user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <Login onLogin={setUser} settings={settings!} lang={lang} />
        </div>
      )}
    </div>
  );
}
