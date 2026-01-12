import React from 'react';
import { Search, Bell, User, LogOut, Menu } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

const TopNavbar = ({ 
  title, 
  searchTerm, 
  onSearchChange, 
  currentUser, 
  onLogout, 
  isLoggingOut 
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm sticky top-0 z-10">
      
      {/* LADO ESQUERDO: Título */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">
          {title}
        </h2>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0.5 text-xs">
           Online
         </Badge>
      </div>

      {/* CENTRO: Barra de Pesquisa Global */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar máquina, IP ou setor..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* LADO DIREITO: Perfil e Ações */}
      <div className="flex items-center gap-4">
        {/* Botão de Notificações (Decorativo por enquanto) */}
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="h-8 w-px bg-slate-200 mx-1"></div>

        {/* Perfil do Usuário */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-slate-700 leading-none">{currentUser}</p>
            <p className="text-xs text-slate-500 mt-1">Admin</p>
          </div>
          <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200">
            {currentUser.substring(0, 2).toUpperCase()}
          </div>
          
          <button 
            onClick={onLogout}
            disabled={isLoggingOut}
            className="ml-2 p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Sair do Sistema"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;