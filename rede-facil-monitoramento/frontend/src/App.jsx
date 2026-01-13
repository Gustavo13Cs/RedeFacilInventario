import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, Package, Users, Smartphone, DollarSign, 
  Network, MessageCircle, Layers
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";

import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';

import io from 'socket.io-client';
import axios from 'axios';
import { API_URL } from './config'; 

import FinancialDashboard from './components/FinancialDashboard'; 
import Inventory from './components/Inventory'; 
import MachineDetails from './components/MachineDetails';
import SimCardManagement from './components/SimCardManagement';
import UserManagement from './components/UserManagement';
import SectorManagement from './components/SectorManagement'; 
import WhatsAppConfig from './pages/WhatsAppConfig';
import NetworkMap from './pages/NetworkMap';
import Login from './components/Login';
import TopNavbar from './components/ui/TopNavbar'; 
import DashboardHome from './components/DashboardHome'; 

const getSocketUrl = (url) => {
  let cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  if (cleanUrl.endsWith('/api')) {
    cleanUrl = cleanUrl.slice(0, -4);
  }
  return cleanUrl;
};

const socket = io(getSocketUrl(API_URL), {
  transports: ['websocket', 'polling'] 
});

function App() {
  const [machines, setMachines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, online: 0, critical: 0 });
  const [lastTelemetry, setLastTelemetry] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  const [selectedMachine, setSelectedMachine] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const getApiEndpoint = (endpoint) => {
    const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    if (baseUrl.endsWith('/api')) {
      return `${baseUrl}${endpoint}`;
    }
    return `${baseUrl}/api${endpoint}`;
  };

  const filteredMachines = machines.filter(m => {
    if (!searchTerm) return true;
    const lowerTerm = searchTerm.toLowerCase();
    return (
      m.hostname?.toLowerCase().includes(lowerTerm) ||
      m.ip_address?.includes(lowerTerm) ||
      (m.sector && m.sector.toLowerCase().includes(lowerTerm)) ||
      (m.os_name && m.os_name.toLowerCase().includes(lowerTerm))
    );
  });

  const getMachinesBySector = () => {
    const grouped = filteredMachines.reduce((acc, machine) => {
      const sectorName = machine.sector ? machine.sector : 'Sem Setor';
      if (!acc[sectorName]) {
        acc[sectorName] = [];
      }
      acc[sectorName].push(machine);
      return acc;
    }, {});

    return Object.keys(grouped).sort().reduce((obj, key) => {
      obj[key] = grouped[key];
      return obj;
    }, {});
  };

  const machinesBySector = getMachinesBySector();

  const handleLocalMachineUpdate = (uuid, newSector) => {
    setMachines(prev => prev.map(m => 
      m.uuid === uuid ? { ...m, sector: newSector } : m
    ));
  };

  const updateStats = (data) => {
    const total = data.length;
    const online = data.filter((m) => m.status === 'online').length;
    const critical = data.filter((m) => m.status === 'critical').length; 
    setStats({ total, online, critical });
  };

  const fetchMachines = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const url = getApiEndpoint('/machines');
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMachines(res.data);
      updateStats(res.data);
    } catch (error) {
      console.error("Erro ao buscar máquinas:", error);
      if (error.response?.status === 401) {
        handleLogout(); 
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user_name');
    const role = localStorage.getItem('user_role');

    if (token) {
      setIsAuthenticated(true);
      setCurrentUser(user || 'Usuário');
      setUserRole(role || 'suporte');
      fetchMachines(); 
    }
    
    socket.on("new_telemetry", (data) => {
      setLastTelemetry(data);
      setMachines(prevMachines => 
         prevMachines.map(m => m.uuid === data.machine_uuid ? { ...m, status: data.status || 'online' } : m)
      );
    });

    return () => {
      socket.off("connect");
      socket.off("new_telemetry");
    };
  }, []);

  const handleLoginSuccess = (user) => {
    setIsAuthenticated(true);
    setCurrentUser(user.name);
    setUserRole(user.role);
    localStorage.setItem('user_role', user.role);
    setTimeout(() => fetchMachines(), 100);
    navigate('/'); 
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_role');
      
      setMachines([]); 
      setSelectedMachine(null);
      setIsAuthenticated(false); 
      setUserRole('');
      setIsLoggingOut(false); 
      navigate('/');
    }, 1500); 
  };

  const handleMachineClick = (machine) => {
    setSelectedMachine(machine);
  };

  const getStatusBadgeVariant = (status) => {
      if (status === 'critical') return 'destructive';
      if (status === 'warning') return 'secondary';
      if (status === 'online') return 'default';
      return 'outline';
  };

  const getStatusBadgeClass = (status) => {
      if (status === 'critical') return 'bg-red-100 text-red-700 border-red-200 animate-pulse';
      if (status === 'warning') return 'bg-orange-100 text-orange-700 border-orange-200';
      if (status === 'online') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      return 'bg-slate-100 text-slate-500';
  };

  const getPageTitle = () => {
    if (selectedMachine) return 'Detalhes do Ativo';
    const path = location.pathname;
    
    if (path.includes('/inventario')) return 'Gestão de Inventário';
    if (path.includes('/setores')) return 'Gestão de Setores';
    if (path.includes('/chips')) return 'Gestão de Telefonia';
    if (path.includes('/usuarios')) return 'Gestão de Usuários';
    if (path.includes('/whatsapp')) return 'Configuração WhatsApp';
    if (path.includes('/patrimonio')) return 'Controle Patrimonial';
    if (path.includes('/mapa')) return 'Mapa de Rede';
    
    return 'Dashboard de Monitoramento';
  };

  const getMenuClass = (path) => {
    const isActive = location.pathname === path;
    return `w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${isActive && !selectedMachine ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`;
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shrink-0 transition-all shadow-xl z-20">
        <div className="h-16 flex items-center px-6 bg-[#0a0f1d]">
          <div className="font-bold text-white text-lg tracking-wider flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-900/50">RF</div>
            REDE FÁCIL
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">Principal</p>
          
          <Link to="/" onClick={() => setSelectedMachine(null)} className={getMenuClass('/')}>
            <LayoutDashboard className="mr-3 h-5 w-5 text-blue-500" /> Visão Geral
          </Link>
          
          <Link to="/inventario" onClick={() => setSelectedMachine(null)} className={getMenuClass('/inventario')}>
            <Package className="mr-3 h-5 w-5 text-emerald-500" /> Inventário
          </Link>

          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Gestão</p>
          {userRole !== 'viewer' && (
            <Link to="/setores" onClick={() => setSelectedMachine(null)} className={getMenuClass('/setores')}>
              <Layers className="mr-3 h-5 w-5 text-pink-500" /> Setores
            </Link>
          )}
          {userRole !== 'viewer' && (
            <Link to="/chips" onClick={() => setSelectedMachine(null)} className={getMenuClass('/chips')}>
              <Smartphone className="mr-3 h-5 w-5 text-orange-500" /> Chips / Telefonia
            </Link>
          )}
          {userRole === 'admin' && (
            <Link to="/patrimonio" onClick={() => setSelectedMachine(null)} className={getMenuClass('/patrimonio')}>
              <DollarSign className="mr-3 h-5 w-5 text-yellow-500" /> Patrimônio
            </Link>
          )}

          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Ferramentas</p>
          <Link to="/mapa" onClick={() => setSelectedMachine(null)} className={getMenuClass('/mapa')}>
            <Network className="mr-3 h-5 w-5 text-indigo-500" /> Mapa de Rede
          </Link>
          
          {userRole === 'admin' && (
            <>
            <Link to="/whatsapp" onClick={() => setSelectedMachine(null)} className={getMenuClass('/whatsapp')}>
              <MessageCircle className="mr-3 h-5 w-5 text-green-500" /> Notificações
            </Link>
            <Link to="/usuarios" onClick={() => setSelectedMachine(null)} className={getMenuClass('/usuarios')}>
              <Users className="mr-3 h-5 w-5 text-purple-500" /> Usuários
            </Link>
            </>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        
        {location.pathname === '/' && !selectedMachine ? (
          <TopNavbar 
            title={getPageTitle()}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            currentUser={currentUser}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
          />
        ) : (
          <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm shrink-0">
            <h2 className="text-xl font-semibold text-slate-800">
              {getPageTitle()}
            </h2>
            <div className="flex items-center gap-4">
               {selectedMachine && (
                  <button onClick={() => setSelectedMachine(null)} className="text-sm text-blue-600 hover:underline">
                    Voltar
                  </button>
               )}
               <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
                 Sistema Online
               </Badge>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-auto p-8 space-y-6">
          
          {selectedMachine ? (
             <MachineDetails 
               machine={selectedMachine} 
               onBack={() => setSelectedMachine(null)}
               socket={socket} 
             />
          ) : (
            <Routes>
              <Route path="/" element={
                <DashboardHome 
                  stats={stats}
                  searchTerm={searchTerm}
                  machinesBySector={machinesBySector}
                  handleMachineClick={handleMachineClick}
                  getStatusBadgeVariant={getStatusBadgeVariant}
                  getStatusBadgeClass={getStatusBadgeClass}
                />
              } />
              
              <Route path="/inventario" element={<Inventory userRole={userRole} />} />
              
              <Route path="/setores" element={
                <SectorManagement 
                  machines={machines} 
                  onUpdateMachine={handleLocalMachineUpdate} 
                />
              } />
              
              <Route path="/whatsapp" element={<WhatsAppConfig />} />
              <Route path="/chips" element={<SimCardManagement userRole={userRole} />} />
              <Route path="/patrimonio" element={<FinancialDashboard />} />
              <Route path="/usuarios" element={<UserManagement />} />
              <Route path="/mapa" element={<NetworkMap />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;