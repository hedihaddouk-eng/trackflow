import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, BarChart, Save, AlertCircle, Cpu, Shield, User as UserIcon, Code, Printer, Database, Image as ImageIcon, Trash2, Download, RefreshCw, Eraser, CheckCircle2 } from 'lucide-react';
import { User, Settings } from '../../types';
import { dataService } from '../../services/dataService';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

import { Language } from '../../App';

interface EngineeringViewProps {
  user: User;
  settings: Settings;
  onSettingsUpdate: (settings: Settings) => void;
  lang: Language;
}

export default function EngineeringView({ user, settings, onSettingsUpdate, lang }: EngineeringViewProps) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [templateType, setTemplateType] = useState<'final' | 'unit'>('final');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDangerous?: boolean } | null>(null);

  const t = {
    fr: {
      title: 'Configuration Système',
      subtitle: 'Maintenance et Administration du Serveur',
      save: 'SAUVEGARDER CONFIGURATION',
      successSave: 'Paramètres enregistrés avec succès',
      errorSave: 'Erreur lors de la sauvegarde',
      sectionPlage: 'Plage des Numéros de Série',
      sectionExp: 'Identité Expéditeur (Label)',
      sectionDefault: 'Paramètres Destinataire par Défaut',
      sectionAuth: 'Sécurité & Accès',
      sectionData: 'Gestion des Données',
      labelStart: 'Début de Plage',
      labelEnd: 'Fin de Plage',
      labelName: 'Nom / Entreprise',
      labelAddr: 'Adresse Complète',
      labelCity: 'Ville / CP',
      labelLogo: 'URL Logo (Optionnel)',
      labelRecipient: 'Client par Défaut',
      labelPassAdmin: 'Mot de passe ADMIN',
      labelPassSup: 'Mot de passe SUPERVISEUR',
      labelPassOp: 'Mot de passe OPÉRATEUR',
      btnReset: 'RESET SYSTEM',
      btnBackup: 'BACKUP JSON',
      resetTitle: 'Réinitialisation Totale',
      resetMessage: 'Attention : Cette action va effacer DÉFINITIVEMENT tous les ordres de fabrication (OF) et tous les historiques de scan. Voulez-vous continuer ?',
      backupTitle: 'Sauvegarde Intégrale',
      backupDesc: 'Exporte tous les paramètres et l\'historique complet en format JSON pour archivage externe.',
      btnExport: 'EXPORTER',
      purgeTitle: 'Nettoyage d\'Historique (3 Mois)',
      purgeDesc: 'Supprime les OF terminés et les scans obsolètes pour alléger la base de données. Garde les 3 derniers mois.',
      btnNettoyer: 'NETTOYER',
      resetDesc: 'Efface DÉFINITIVEMENT tous les ordres de fabrication et les historiques. Utilisé pour les nouveaux déploiements.',
      labelDestAddr: 'Adresse Destination',
      backupSuccess: 'Sauvegarde effectuée',
      resetSuccess: 'Base de données réinitialisée',
      confirm: 'CONFIRMER',
      cancel: 'ANNULER',
      systemReset: 'Système réinitialisé à zéro.',
      errorExport: 'Erreur lors de l\'exportation du backup',
      close: 'FERMER',
      postEng: 'Poste Engineering',
      opSuccess: 'Opération Réussie',
      systemAlert: 'Alerte Système',
      sectionEnv: 'Environnement & Labels',
      labelAdminPass: 'ADMIN Password',
      labelSupPass: 'SUPERVISOR Password',
      labelOpPass: 'OPERATOR Password',
      confirmResetTitle: 'Réinitialisation Totale',
      confirmResetMsg: 'Attention : Cette action va effacer DÉFINITIVEMENT tous les ordres de fabrication (OF) et tous les historiques de scan. Voulez-vous continuer ?',
      confirmPurgeTitle: 'Nettoyage de la Base',
      confirmPurgeMsg: 'Voulez-vous supprimer l\'historique des OF terminés datant de plus de 3 mois pour optimiser les performances ?',
      resetProductionSuccess: 'Données de production réinitialisées avec succès. Redémarrage...',
      purgeSuccess: 'Nettoyage terminé',
      errorReset: 'Erreur lors de la réinitialisation',
      errorPurge: 'Erreur lors du nettoyage des données',
      confirmMode: 'CONFIRMER',
      maintenanceTitle: 'Maintenance & Gestion des Données',
      zebraTitle: 'Éditeur de GABARIT ZEBRA (ZPL)',
      zebraStandards: 'STANDARDS v2.1',
      zebraVariables: 'Variables:',
      zebraPreview: 'Rendu Dynamique Zebra',
      zebraDesc: 'Le moteur ZPL générera l\'étiquette finale lors de l\'archivage de l\'OF.',
      prefixLabel: 'Préfixe Lot par Défaut',
      prefixDesc: 'Ce préfixe sera utilisé si aucun numéro de lot n\'est spécifié lors de l\'import CSV.',
      logoDesc: 'Téléchargez votre logo pour personnaliser les interfaces et les étiquettes de production. Format recommandé : PNG/JPG, fond blanc ou transparent.',
      logisticsTitle: 'Coordonnées Logistiques',
      senderInfo: 'Informations Expéditeur',
      sender: 'Expéditeur',
      recipientInfo: 'Informations Destinataire',
      recipient: 'Destinataire',
      opAccountsTitle: 'Comptes Opérateurs',
      newLogin: 'Nouvel Identifiant',
      newPass: 'Nouveau Mot de passe',
      scanStationConfig: 'Configuration du Poste de Scan simplifiée : Les contrôles de numéros de série sont désormais automatiques.',
      saveConfig: 'SAUVEGARDER CONFIGURATION',
      operationSuccess: 'Opération Réussie',
      systemAlertMsg: 'Alerte Système',
      postEngLabel: 'Poste Engineering',
      maintenanceDataTitle: 'Maintenance & Data Management',
      fullBackupTitle: 'Full Backup',
      fullBackupDesc: 'Exports all settings and full history in JSON format for external archiving.',
      exportBtn: 'EXPORT',
      historyCleanupTitle: 'History Cleanup (3 Months)',
      historyCleanupDesc: 'Deletes completed MO and obsolete scans to lighten the database. Keeps the last 3 months.',
      cleanupBtn: 'CLEANUP',
      totalResetTitle: 'Total Reset',
      totalResetDesc: 'PERMANENTLY deletes all manufacturing orders and histories. Used for new deployments.',
      resetSystemBtn: 'RESET SYSTEM',
    },
    en: {
      title: 'System Configuration',
      subtitle: 'Maintenance and Server Administration',
      save: 'SAVE CONFIGURATION',
      successSave: 'Settings saved successfully',
      errorSave: 'Error during save',
      sectionPlage: 'Serial Number Range',
      sectionExp: 'Sender Identity (Label)',
      sectionDefault: 'Default Recipient Settings',
      sectionAuth: 'Security & Access',
      sectionData: 'Data Management',
      labelStart: 'Range start',
      labelEnd: 'Range end',
      labelName: 'Name / Company',
      labelAddr: 'Full Address',
      labelCity: 'City / ZIP',
      labelLogo: 'Logo URL (Optional)',
      labelRecipient: 'Default Client',
      labelPassAdmin: 'ADMIN password',
      labelPassSup: 'SUPERVISOR password',
      labelPassOp: 'OPERATOR password',
      btnReset: 'RESET SYSTEM',
      btnBackup: 'JSON BACKUP',
      resetTitle: 'Total Reset',
      resetMessage: 'Do you really want to delete ALL orders and scans? This action is irreversible.',
      backupTitle: 'Full Backup',
      backupDesc: 'Exports all settings and full history in JSON format for external archiving.',
      btnExport: 'EXPORT',
      purgeTitle: 'History Cleanup (3 Months)',
      purgeDesc: 'Deletes completed MO and obsolete scans to lighten the database. Keeps the last 3 months.',
      btnNettoyer: 'CLEANUP',
      resetDesc: 'PERMANENTLY deletes all manufacturing orders and histories. Used for new deployments.',
      labelDestAddr: 'Destination Address',
      backupSuccess: 'Backup performed',
      resetSuccess: 'Database reset',
      confirm: 'CONFIRM',
      cancel: 'CANCEL',
      systemReset: 'System reset to zero.',
      errorExport: 'Error during backup export',
      close: 'CLOSE',
      postEng: 'Engineering Station',
      opSuccess: 'Operation Successful',
      systemAlert: 'System Alert',
      sectionEnv: 'Environment & Labels',
      labelAdminPass: 'ADMIN Password',
      labelSupPass: 'SUPERVISOR Password',
      labelOpPass: 'OPERATOR Password',
      confirmResetTitle: 'Total Reset',
      confirmResetMsg: 'Warning: This action will PERMANENTLY erase all manufacturing orders (MO) and scan histories. Do you want to continue?',
      confirmPurgeTitle: 'Database Cleanup',
      confirmPurgeMsg: 'Do you want to delete completed MO history older than 3 months to optimize performance?',
      resetProductionSuccess: 'Production data reset successfully. Restarting...',
      purgeSuccess: 'Cleanup completed',
      errorReset: 'Error during reset',
      errorPurge: 'Error during data cleanup',
      confirmMode: 'CONFIRM',
      maintenanceTitle: 'Maintenance & Data Management',
      zebraTitle: 'ZEBRA LABEL EDITOR (ZPL)',
      zebraStandards: 'STANDARDS v2.1',
      zebraVariables: 'Variables:',
      zebraPreview: 'Dynamic Zebra Rendering',
      zebraDesc: 'The ZPL engine will generate the final label when archiving the MO.',
      prefixLabel: 'Default Lot Prefix',
      prefixDesc: 'This prefix will be used if no lot number is specified during CSV import.',
      logoDesc: 'Upload your logo to customize production interfaces and labels. Recommended format: PNG/JPG, white or transparent background.',
      logisticsTitle: 'Logistics Coordinates',
      senderInfo: 'Sender Information',
      sender: 'Sender',
      recipientInfo: 'Recipient Information',
      recipient: 'Recipient',
      opAccountsTitle: 'Operator Accounts',
      newLogin: 'New Identifier',
      newPass: 'New Password',
      scanStationConfig: 'Simplified Scan Station Configuration: Serial number checks are now automatic.',
      saveConfig: 'SAVE CONFIGURATION',
      operationSuccess: 'Operation Successful',
      systemAlertMsg: 'System Alert',
      postEngLabel: 'Engineering Station',
      maintenanceDataTitle: 'Maintenance & Data Management',
      fullBackupTitle: 'Full Backup',
      fullBackupDesc: 'Exports all settings and full history in JSON format for external archiving.',
      exportBtn: 'EXPORT',
      historyCleanupTitle: 'History Cleanup (3 Months)',
      historyCleanupDesc: 'Deletes completed MO and obsolete scans to lighten the database. Keeps the last 3 months.',
      cleanupBtn: 'CLEANUP',
      totalResetTitle: 'Total Reset',
      totalResetDesc: 'PERMANENTLY deletes all manufacturing orders and histories. Used for new deployments.',
      resetSystemBtn: 'RESET SYSTEM',
    }
  }[lang];


  const handleSaveSettings = async () => {
    try {
      await dataService.updateSettings(localSettings);
      onSettingsUpdate(localSettings);
      setMessage({ type: 'success', text: t.successSave });
    } catch (err: any) {
      setMessage({ type: 'error', text: t.errorSave });
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = await dataService.exportDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trackflow_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: t.backupSuccess });
    } catch (err) {
      setMessage({ type: 'error', text: t.errorExport });
    }
  };

  const executeReset = async () => {
    console.log("[Maintenance] Starting Reset...");
    setConfirmModal(null); // Close modal first
    
    // Tiny delay to ensure modal unmounts
    await new Promise(resolve => setTimeout(resolve, 150));
    
    setIsMaintenanceLoading(true);
    try {
      await dataService.resetProductionData();
      console.log("[Maintenance] Reset Success");
      setMessage({ type: 'success', text: 'Données de production réinitialisées avec succès. Redémarrage...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error("[Maintenance] Reset Error:", err);
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la réinitialisation' });
      setIsMaintenanceLoading(false);
    }
  };

  const executePurge = async () => {
    console.log("[Maintenance] Starting Purge...");
    setConfirmModal(null); // Close modal first
    
    // Tiny delay to ensure modal unmounts
    await new Promise(resolve => setTimeout(resolve, 150));

    setIsMaintenanceLoading(true);
    try {
      const result = await dataService.purgeOldData(3);
      console.log("[Maintenance] Purge Success:", result);
      setMessage({ type: 'success', text: result.message || t.purgeSuccess });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error("[Maintenance] Purge Error:", err);
      setMessage({ type: 'error', text: err.message || t.errorPurge });
    } finally {
      setIsMaintenanceLoading(false);
    }
  };

  const handleResetProduction = () => {
    setConfirmModal({
      isOpen: true,
      title: t.confirmResetTitle,
      message: t.confirmResetMsg,
      onConfirm: executeReset,
      isDangerous: true
    });
  };

  const handlePurgeData = () => {
    setConfirmModal({
      isOpen: true,
      title: t.confirmPurgeTitle,
      message: t.confirmPurgeMsg,
      onConfirm: executePurge
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight text-[#0F172A]">{t.postEng}</h1>
        <button 
          onClick={handleSaveSettings}
          className="flex items-center gap-3 px-8 py-4 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 uppercase tracking-widest"
        >
          <Save size={18} /> {t.save}
        </button>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "p-6 rounded-3xl flex items-center gap-5 text-sm font-medium border shadow-xl backdrop-blur-2xl",
            message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
          )}
        >
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", message.type === 'success' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-red-500 text-white shadow-lg shadow-red-200")}>
            {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          </div>
          <div className="flex-1">
             <div className="font-black uppercase tracking-tight text-lg">{message.type === 'success' ? t.opSuccess : t.systemAlert}</div>
             <div className="text-xs font-bold opacity-80">{message.text}</div>
          </div>
          <button onClick={() => setMessage(null)} className="p-3 hover:bg-black/5 rounded-full transition-colors font-black text-xs">{t.close}</button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column */}
        <div className="space-y-10">
          {/* Maintenance Section */}
          <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl overflow-hidden relative">
            <div className="flex items-center gap-4 text-red-600 font-black text-xs tracking-[0.2em] uppercase mb-8">
              <RefreshCw size={24} className={isMaintenanceLoading ? "animate-spin" : ""} /> {t.maintenanceTitle}
            </div>
            
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Download size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-tighter">{t.backupTitle}</h3>
                    <p className="text-[10px] text-slate-500 font-bold leading-tight mt-1">{t.backupDesc}</p>
                  </div>
                  <button 
                    onClick={handleExportBackup}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[10px] font-black rounded-lg hover:bg-white hover:border-blue-300 hover:text-blue-600 transition-all uppercase tracking-widest shadow-sm"
                  >
                    {t.btnExport}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <Eraser size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-tighter">{t.purgeTitle}</h3>
                    <p className="text-[10px] text-slate-500 font-bold leading-tight mt-1">{t.purgeDesc}</p>
                  </div>
                  <button 
                    onClick={handlePurgeData}
                    disabled={isMaintenanceLoading}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[10px] font-black rounded-lg hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-all uppercase tracking-widest shadow-sm disabled:opacity-50"
                  >
                    {t.btnNettoyer}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-black text-red-800 uppercase tracking-tighter">{t.resetTitle}</h3>
                    <p className="text-[10px] text-red-600/70 font-bold leading-tight mt-1">{t.resetDesc}</p>
                  </div>
                  <button 
                    onClick={handleResetProduction}
                    disabled={isMaintenanceLoading}
                    className="px-4 py-2 bg-red-600 text-white text-[10px] font-black rounded-lg hover:bg-red-700 hover:shadow-lg hover:shadow-red-200 transition-all uppercase tracking-widest shadow-sm disabled:opacity-50"
                  >
                    {t.btnReset}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl">
            <div className="flex items-center gap-4 text-[#0066FF] font-black text-xs tracking-[0.2em] uppercase mb-8">
              <BarChart size={24} /> {t.sectionPlage}
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="space-y-3">
                <label className="block text-[11px] text-[#64748B] uppercase font-bold tracking-widest">{t.labelStart}</label>
                <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm font-mono font-bold">#</div>
                   <input 
                    type="number" 
                    value={localSettings.snRangeStart}
                    onChange={e => setLocalSettings({...localSettings, snRangeStart: parseInt(e.target.value) || 0})}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-5 py-4 font-mono font-bold text-sm focus:border-[#0066FF] focus:ring-4 focus:ring-blue-100 outline-none transition-all text-[#0F172A]"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-[11px] text-[#64748B] uppercase font-bold tracking-widest">{t.labelEnd}</label>
                <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm font-mono font-bold">#</div>
                   <input 
                    type="number" 
                    value={localSettings.snRangeEnd}
                    onChange={e => setLocalSettings({...localSettings, snRangeEnd: parseInt(e.target.value) || 0})}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-5 py-4 font-mono font-bold text-sm focus:border-[#0066FF] focus:ring-4 focus:ring-blue-100 outline-none transition-all text-[#0F172A]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] text-[#64748B] uppercase font-bold tracking-widest">{t.prefixLabel}</label>
              <div className="relative">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm font-mono font-bold">L</div>
                 <input 
                  type="text" 
                  value={localSettings.defaultLotPrefix || ''}
                  onChange={e => setLocalSettings({...localSettings, defaultLotPrefix: e.target.value})}
                  placeholder="Ex: LOT-"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-5 py-4 font-mono font-bold text-sm focus:border-[#0066FF] focus:ring-4 focus:ring-blue-100 outline-none transition-all text-[#0F172A]"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold italic mt-2">{t.prefixDesc}</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl">
            <div className="flex items-center gap-4 text-orange-600 font-black text-xs tracking-[0.2em] uppercase mb-8">
              <ImageIcon size={24} /> {t.sectionEnv}
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {localSettings.logoUrl ? (
                    <img src={localSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon size={32} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-4">
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                    {t.logoDesc}
                  </p>
                  <div className="flex gap-3">
                    <label className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-widest">
                      <ImageIcon size={14} /> {t.btnExport}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setLocalSettings({ ...localSettings, logoUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {localSettings.logoUrl && (
                      <button 
                        onClick={() => setLocalSettings({ ...localSettings, logoUrl: '' })}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer active:scale-90"
                        title="Supprimer le logo"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl">
            <div className="flex items-center gap-4 text-amber-600 font-black text-xs tracking-[0.2em] uppercase mb-8">
              <Printer size={24} /> {t.logisticsTitle}
            </div>
            
            <div className="space-y-8">
              {/* Section Expéditeur */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {t.senderInfo}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{t.labelName} ({t.sender})</label>
                    <input 
                      type="text" 
                      value={localSettings.senderName || ''}
                      onChange={e => setLocalSettings({...localSettings, senderName: e.target.value})}
                      placeholder="Identité Expéditeur"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">Téléphone ({t.sender})</label>
                    <input 
                      type="text" 
                      value={localSettings.senderPhone || ''}
                      onChange={e => setLocalSettings({...localSettings, senderPhone: e.target.value})}
                      placeholder="+33 ..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{t.labelAddr} ({t.sender})</label>
                    <input 
                      type="text" 
                      value={localSettings.senderAddress || ''}
                      onChange={e => setLocalSettings({...localSettings, senderAddress: e.target.value})}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{t.labelCity} ({t.sender})</label>
                    <input 
                      type="text" 
                      value={localSettings.senderCity || ''}
                      onChange={e => setLocalSettings({...localSettings, senderCity: e.target.value})}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">Pays ({t.sender})</label>
                    <input 
                      type="text" 
                      value={localSettings.senderCountry || ''}
                      onChange={e => setLocalSettings({...localSettings, senderCountry: e.target.value})}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Section Destinataire */}
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> {t.recipientInfo}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{t.labelName} ({t.recipient})</label>
                    <input 
                      type="text" 
                      value={localSettings.recipientName || ''}
                      onChange={e => setLocalSettings({...localSettings, recipientName: e.target.value})}
                      placeholder="Nom du Client"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">Téléphone ({t.recipient})</label>
                    <input 
                      type="text" 
                      value={localSettings.recipientPhone || ''}
                      onChange={e => setLocalSettings({...localSettings, recipientPhone: e.target.value})}
                      placeholder="+33 ..."
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{t.labelAddr} ({t.recipient})</label>
                    <input 
                      type="text" 
                      value={localSettings.recipientAddress || ''}
                      onChange={e => setLocalSettings({...localSettings, recipientAddress: e.target.value})}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{t.labelCity} ({t.recipient})</label>
                    <input 
                      type="text" 
                      value={localSettings.recipientCity || ''}
                      onChange={e => setLocalSettings({...localSettings, recipientCity: e.target.value})}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">Pays ({t.recipient})</label>
                    <input 
                      type="text" 
                      value={localSettings.recipientCountry || ''}
                      onChange={e => setLocalSettings({...localSettings, recipientCountry: e.target.value})}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl">
            <div className="flex items-center gap-4 text-purple-600 font-black text-xs tracking-[0.2em] uppercase mb-8">
              <Shield size={24} /> {t.sectionAuth}
            </div>
            <div className="space-y-6">
              <PasswordInput 
                label={t.labelPassAdmin} 
                value={localSettings.engineeringPassword} 
                onChange={v => setLocalSettings({...localSettings, engineeringPassword: v})}
                icon={<SettingsIcon size={18}/>}
                color="purple"
              />
              <PasswordInput 
                label={t.labelPassSup} 
                value={localSettings.supervisorPassword} 
                onChange={v => setLocalSettings({...localSettings, supervisorPassword: v})}
                icon={<Shield size={18}/>}
                color="blue"
              />
              <PasswordInput 
                label={t.labelPassOp} 
                value={localSettings.operatorPassword} 
                onChange={v => setLocalSettings({...localSettings, operatorPassword: v})}
                icon={<UserIcon size={18}/>}
                color="emerald"
              />
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-2xl">
            <div className="flex items-center gap-4 text-emerald-600 font-black text-xs tracking-[0.2em] uppercase mb-8">
              <UserIcon size={24} /> {t.opAccountsTitle}
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{t.newLogin}</label>
                  <input 
                    type="text" 
                    id="new-op-login"
                    placeholder="Login"
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-bold text-sm focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{t.newPass}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      id="new-op-pass"
                      placeholder="Pass"
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 font-mono font-bold text-sm focus:border-emerald-500 outline-none transition-all"
                    />
                    <button 
                      onClick={() => {
                        const loginInput = document.getElementById('new-op-login') as HTMLInputElement;
                        const passInput = document.getElementById('new-op-pass') as HTMLInputElement;
                        if (!loginInput.value || !passInput.value) return;
                        
                        const newAccounts = [...(localSettings.operatorAccounts || []), { login: loginInput.value, password: passInput.value }];
                        setLocalSettings({...localSettings, operatorAccounts: newAccounts});
                        loginInput.value = '';
                        passInput.value = '';
                      }}
                      className="px-4 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                {(localSettings.operatorAccounts || []).map((account, index) => (
                  <div key={index} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 group gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black">{account.login[0].toUpperCase()}</div>
                        <div>
                          <div className="text-xs font-black text-slate-800 uppercase">{account.login}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const newAccounts = (localSettings.operatorAccounts || []).filter((_, i) => i !== index);
                            setLocalSettings({...localSettings, operatorAccounts: newAccounts});
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors cursor-pointer active:scale-90"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="text" 
                        value={account.login}
                        onChange={e => {
                          const newAccounts = [...(localSettings.operatorAccounts || [])];
                          newAccounts[index] = { ...account, login: e.target.value };
                          setLocalSettings({...localSettings, operatorAccounts: newAccounts});
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-emerald-500"
                        placeholder="Identifiant"
                      />
                      <input 
                        type="text" 
                        value={account.password}
                        onChange={e => {
                          const newAccounts = [...(localSettings.operatorAccounts || [])];
                          newAccounts[index] = { ...account, password: e.target.value };
                          setLocalSettings({...localSettings, operatorAccounts: newAccounts});
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-mono font-bold outline-none focus:border-emerald-500"
                        placeholder="Mot de passe"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-sm italic text-center">
            <p className="text-[11px] text-[#94A3B8] font-bold">
              {t.scanStationConfig}
            </p>
          </div>
        </div>

        {/* Label Editor */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          <div className="p-8 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-blue-600 font-black text-xs tracking-[0.2em] uppercase">
              <Code size={24} /> {t.zebraTitle}
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setTemplateType('final')}
                className={cn(
                  "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  templateType === 'final' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Gabarit Final
              </button>
              <button 
                onClick={() => setTemplateType('unit')}
                className={cn(
                  "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  templateType === 'unit' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Gabarit Unité
              </button>
            </div>
            <div className="flex gap-2">
               <div className="px-3 py-1.5 bg-blue-100 text-[#0066FF] rounded-lg text-[10px] font-black border border-blue-200">{t.zebraStandards}</div>
            </div>
          </div>
          
          <div className="flex-1 p-8 space-y-6">
            <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-black flex flex-wrap gap-2 items-center">
               <Database size={14} className="text-[#0066FF]" /> 
               {t.zebraVariables} 
               <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{OF}'}</code>
               <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{REF}'}</code>
               <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{QTY}'}</code>
               {templateType === 'unit' ? (
                 <>
                   <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{SN}'}</code>
                   <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{QTY_TOTAL}'}</code>
                   <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{INDEX}'}</code>
                 </>
               ) : (
                 <>
                   <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{LOT}'}</code>
                   <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{DESTINATION}'}</code>
                 </>
               )}
               <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{SENDER_NAME}'}</code>
               <code className="bg-slate-100 font-black px-1.5 py-0.5 rounded text-[#0F172A]">{'{DATE}'}</code>
            </div>
            
            <textarea 
              value={templateType === 'final' ? localSettings.zebraTemplate : (localSettings.unitZebraTemplate || '')}
              onChange={e => {
                const newVal = e.target.value;
                if (templateType === 'final') {
                  setLocalSettings({...localSettings, zebraTemplate: newVal});
                } else {
                  setLocalSettings({...localSettings, unitZebraTemplate: newVal});
                }
              }}
              className="w-full h-[400px] bg-slate-50 border border-[#E2E8F0] rounded-2xl px-6 py-6 font-mono text-sm text-[#0066FF] font-bold focus:border-[#0066FF] focus:ring-4 focus:ring-blue-100 outline-none resize-none leading-relaxed shadow-inner"
              spellCheck="false"
            />
            
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200 flex items-center justify-center text-[#0066FF] shadow-sm">
                <Printer size={28} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-black text-[#0F172A] uppercase tracking-tight">
                  {templateType === 'final' ? 'Aperçu Gabarit Final' : 'Aperçu Gabarit Unité'}
                </div>
                <p className="text-[11px] text-blue-600 font-bold italic opacity-80">{t.zebraDesc}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setConfirmModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className={cn("p-8", confirmModal.isDangerous ? "bg-red-50/50" : "bg-blue-50/50")}>
                <div className={cn("w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 shadow-lg", confirmModal.isDangerous ? "bg-red-500 text-white shadow-red-200" : "bg-blue-500 text-white shadow-blue-200")}>
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">{confirmModal.title}</h3>
                <p className="text-sm font-bold text-slate-500 leading-relaxed">{confirmModal.message}</p>
              </div>
              
              <div className="p-8 flex items-center gap-4 bg-white">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest transition-all"
                >
                  {t.cancel}
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={cn(
                    "flex-1 px-6 py-4 rounded-2xl text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg",
                    confirmModal.isDangerous ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                  )}
                >
                  {t.confirm}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persistent Loading Overlay during maintenance */}
      {isMaintenanceLoading && (
        <div className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center space-y-6">
          <RefreshCw size={64} className="text-blue-600 animate-spin" />
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Traitement des Données...</h3>
            <p className="text-slate-500 font-bold">Veuillez ne pas fermer cette fenêtre.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordInput({ label, value, onChange, icon, color }: { label: string; value: string; onChange: (v: string) => void; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    purple: 'text-purple-600 bg-purple-50 border-purple-100 ring-purple-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100 ring-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100 ring-emerald-100'
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] text-[#64748B] uppercase font-black tracking-widest">{label}</label>
      <div className="relative group">
        <div className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", colorMap[color].split(' ')[0])}>{icon}</div>
        <input 
          type="text" 
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cn(
            "w-full border rounded-2xl pl-12 pr-6 py-4 font-mono font-bold text-sm focus:ring-4 outline-none transition-all text-[#0F172A]",
            colorMap[color].split(' ').slice(1).join(' ')
          )}
        />
      </div>
    </div>
  );
}
