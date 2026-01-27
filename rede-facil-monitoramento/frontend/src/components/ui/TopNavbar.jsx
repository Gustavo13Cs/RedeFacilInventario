import React, { useState } from 'react';
import { Search, Bell, LogOut, Shield, AlertTriangle, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';

const TopNavbar = ({ 
  title, 
  searchTerm, 
  onSearchChange, 
  currentUser, 
  userRole,
  onLogout, 
  isLoggingOut,
  notifications = [] 
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm sticky top-0 z-10">
      
      {/* Título */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0.5 text-xs flex items-center gap-1">
           <Shield className="h-3 w-3" /> Conexão Segura
         </Badge>
      </div>

      {/* Busca */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-4">
        <div className="relative">
            <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-pulse">
                        {notifications.length}
                    </span>
                )}
            </button>

            {/* Dropdown de Notificações */}
            {showNotifications && (
                <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)}></div>
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-lg z-20 overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <span className="font-semibold text-sm text-slate-700">Notificações</span>
                        <button onClick={() => setShowNotifications(false)}><X size={14} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-sm text-slate-400">Nenhum chamado pendente.</div>
                        ) : (
                            notifications.map((notif, index) => (
                                <Link to="/suporte" key={index} onClick={() => setShowNotifications(false)} className="block p-3 border-b hover:bg-slate-50 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-red-100 p-1.5 rounded-full mt-0.5">
                                            <AlertTriangle size={14} className="text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">Pedido de Ajuda</p>
                                            <p className="text-xs text-slate-600 mt-0.5">
                                                Máquina: <span className="font-semibold">{notif.machine_name || notif.hostname}</span>
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                {new Date(notif.created_at).toLocaleTimeString()} - Clique para resolver
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                    {notifications.length > 0 && (
                        <Link to="/suporte" onClick={() => setShowNotifications(false)} className="block p-2 text-center text-xs font-medium text-blue-600 hover:bg-blue-50 border-t">
                            Ver Central de Suporte
                        </Link>
                    )}
                </div>
                </>
            )}
        </div>

        <div className="h-8 w-px bg-slate-200 mx-1"></div>

        {/* Perfil */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-slate-700 leading-none">{currentUser}</p>
            <p className="text-xs text-slate-500 mt-1 capitalize">
                {userRole === 'admin' ? 'Administrador' : userRole}
            </p>
          </div>
          <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200 uppercase">
            {currentUser ? currentUser.substring(0, 2) : 'RF'}
          </div>
          <button onClick={onLogout} disabled={isLoggingOut} className="ml-2 p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;