
import React from 'react';
import { LayoutDashboard, Calendar as CalendarIcon, Dumbbell, History, Settings, LogIn, LogOut, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';

export const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Painel' },
  { id: 'calendar', icon: CalendarIcon, label: 'Agenda' },
  { id: 'workout', icon: Dumbbell, label: 'Treinar' },
  { id: 'history', icon: History, label: 'Histórico' },
  { id: 'profile', icon: Settings, label: 'Perfil' },
];

interface LayoutProps {
  currentView: string;
  onViewChange: (v: string) => void;
  children: React.ReactNode;
}

export const Layout = ({ currentView, onViewChange, children }: LayoutProps) => {
    const { user, login, logout, isConfigured, authError } = useAppStore();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 pb-24 lg:pb-0">
            {/* Sidebar (Desktop) */}
            <nav className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 p-4 z-30">
                <div className="flex items-center gap-3 px-2 mb-10 mt-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20">
                        AI
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">CaliProgress</span>
                </div>
                
                <div className="space-y-1 flex-1">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                currentView === item.id 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            <item.icon size={20} />
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Auth Section */}
                <div className="mt-auto border-t border-slate-800 pt-4">
                    {user ? (
                        <div className="space-y-3">
                             <div className="flex items-center gap-3 px-2">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
                                ) : (
                                    <div className="w-8 h-8 bg-emerald-700 rounded-full flex items-center justify-center text-xs">{user.email?.substring(0,2).toUpperCase()}</div>
                                )}
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-bold text-white truncate">{user.displayName}</span>
                                    <span className="text-xs text-slate-500 truncate">{user.email}</span>
                                </div>
                             </div>
                             <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
                                 <LogOut size={16} /> Sair
                             </button>
                        </div>
                    ) : (
                        <button 
                            onClick={isConfigured ? login : () => alert('Abra o arquivo services/firebase.ts e cole as chaves do seu projeto Firebase!')} 
                            className={`w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-lg ${
                                isConfigured 
                                ? 'bg-white text-slate-900 hover:bg-slate-200' 
                                : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500/20'
                            }`}
                        >
                            {isConfigured ? <LogIn size={18} /> : <AlertTriangle size={18} />}
                            {isConfigured ? 'Entrar com Google' : 'Configurar Firebase'}
                        </button>
                    )}
                </div>
            </nav>

            {/* Bottom Nav (Mobile) */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40 pb-safe shadow-xl">
                <div className="flex justify-around items-center h-16">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-90 transition-transform ${
                                currentView === item.id ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                        >
                            <item.icon size={20} className={currentView === item.id ? 'animate-bounce-subtle' : ''} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </button>
                    ))}
                    {/* Mobile Auth Trigger */}
                    <button 
                        onClick={user ? logout : (isConfigured ? login : () => alert('Configure o Firebase em services/firebase.ts'))}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-90 transition-transform ${
                             user ? 'text-red-400' : (isConfigured ? 'text-slate-200' : 'text-yellow-500')
                        }`}
                    >
                        {user ? <LogOut size={20} /> : (isConfigured ? <LogIn size={20} /> : <AlertTriangle size={20} />)}
                        <span className="text-[10px] font-medium">{user ? 'Sair' : (isConfigured ? 'Entrar' : 'Configurar')}</span>
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="lg:pl-64 min-h-screen">
                {authError && (
                    <div className="bg-red-500/90 text-white p-4 text-center text-sm font-bold sticky top-0 z-50 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-2">
                        <span className="break-all">{authError}</span>
                        <button onClick={() => window.location.reload()} className="bg-white text-red-500 px-3 py-1 rounded text-xs whitespace-nowrap hover:bg-red-50">
                            Tentar Novamente
                        </button>
                    </div>
                )}
                <div className="max-w-5xl mx-auto p-4 lg:p-10 animate-in fade-in duration-300">
                    {children}
                </div>
            </main>
        </div>
    );
};
