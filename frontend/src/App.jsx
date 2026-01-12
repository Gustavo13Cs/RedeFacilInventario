import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, Server, Activity, Package, Users, 
  Smartphone, DollarSign, Network, MessageCircle, 
  Building2, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const [selectedMachine, setSelectedMachine] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // Agrupamento
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

    socket.on("connect", () => console.log("🟢 Conectado ao WebSocket"));
    
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
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_role');
      
      setMachines([]); 
      setSelectedMachine(null);
      setActiveTab('dashboard');
      setIsAuthenticated(false); 
      setUserRole('');
      setIsLoggingOut(false); 
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
    switch(activeTab) {
      case 'inventory': return 'Gestão de Inventário';
      case 'sectors': return 'Gestão de Setores';
      case 'chips': return 'Gestão de Telefonia';
      case 'users': return 'Gestão de Usuários';
      case 'whatsapp': return 'Configuração WhatsApp';
      case 'financial': return 'Controle Patrimonial';
      case 'network': return 'Mapa de Rede';
      default: return 'Dashboard de Monitoramento';
    }
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
          <button onClick={() => { setActiveTab('dashboard'); setSelectedMachine(null); }} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'dashboard' && !selectedMachine ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`}>
            <LayoutDashboard className="mr-3 h-5 w-5 text-blue-500" /> Visão Geral
          </button>
          <button onClick={() => { setActiveTab('inventory'); setSelectedMachine(null); }} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'inventory' ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`}>
            <Package className="mr-3 h-5 w-5 text-emerald-500" /> Inventário
          </button>

          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Gestão</p>
          {userRole !== 'viewer' && (
            <button onClick={() => { setActiveTab('sectors'); setSelectedMachine(null); }} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'sectors' ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`}>
              <Layers className="mr-3 h-5 w-5 text-pink-500" /> Setores
            </button>
          )}
          {userRole !== 'viewer' && (
            <button onClick={() => { setActiveTab('chips'); setSelectedMachine(null); }} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'chips' ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`}>
              <Smartphone className="mr-3 h-5 w-5 text-orange-500" /> Chips / Telefonia
            </button>
          )}
          {userRole === 'admin' && (
            <button onClick={() => { setActiveTab('financial'); setSelectedMachine(null); }} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'financial' ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`}>
              <DollarSign className="mr-3 h-5 w-5 text-yellow-500" /> Patrimônio
            </button>
          )}

          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Ferramentas</p>
          <button onClick={() => { setActiveTab('network'); setSelectedMachine(null); }} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'network' ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`}>
            <Network className="mr-3 h-5 w-5 text-indigo-500" /> Mapa de Rede
          </button>
          {userRole === 'admin' && (
            <>
            <button onClick={() => { setActiveTab('whatsapp'); setSelectedMachine(null); }} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'whatsapp' ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`}>
              <MessageCircle className="mr-3 h-5 w-5 text-green-500" /> Notificações
            </button>
            <button onClick={() => { setActiveTab('users'); setSelectedMachine(null); }} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'users' ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50 hover:text-white'}`}>
              <Users className="mr-3 h-5 w-5 text-purple-500" /> Usuários
            </button>
            </>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        
        {activeTab === 'dashboard' && !selectedMachine ? (
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
               <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
                 Sistema Online
               </Badge>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-auto p-8 space-y-6">
          
          {activeTab === 'inventory' ? (
              <Inventory userRole={userRole} />
            ) : activeTab === 'sectors' ? (
              <SectorManagement 
                machines={machines} 
                onUpdateMachine={handleLocalMachineUpdate} 
              />
            ) : activeTab === 'whatsapp' ? (
              <WhatsAppConfig />
            ) : activeTab === 'chips' ? (
              <SimCardManagement userRole={userRole} />
            ) : activeTab === 'financial' ? (
                <FinancialDashboard />
            ): activeTab === 'users' ?( 
              <UserManagement />
            ): activeTab === 'network' ? (
            <NetworkMap />
            ): selectedMachine ? (
              <MachineDetails 
                machine={selectedMachine} 
                onBack={() => setSelectedMachine(null)}
                socket={socket} 
              />
            ) : (
            <>
              {/* --- DASHBOARD PRINCIPAL --- */}
              
              {!searchTerm && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in slide-in-from-top-4 duration-500">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-slate-600">Total de Máquinas</CardTitle>
                      <Server className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                      <p className="text-xs text-slate-500">Registradas na base</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-slate-600">Online Agora</CardTitle>
                          <Activity className="h-4 w-4 text-emerald-500" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold text-emerald-600">{stats.online}</div>
                          <p className="text-xs text-emerald-600/80">Ativas em tempo real</p>
                      </CardContent>
                  </Card>
                </div>
              )}
              
              <div className="space-y-8">
                {Object.keys(machinesBySector).length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                     <Server className="h-16 w-16 mb-4 opacity-20" />
                     <p className="text-lg">Nenhuma máquina encontrada.</p>
                     {searchTerm && <p className="text-sm">Tente buscar por outro termo.</p>}
                   </div>
                ) : (
                  Object.entries(machinesBySector).map(([sector, sectorMachines]) => (
                    <div key={sector} className="animate-in fade-in duration-500">
                      <div className="flex items-center gap-2 mb-3">
                         <div className="p-1.5 bg-blue-100 rounded-md">
                           <Building2 className="w-5 h-5 text-blue-700" />
                         </div>
                         <h3 className="text-lg font-bold text-slate-700">{sector}</h3>
                         <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600">
                           {sectorMachines.length} Ativos
                         </Badge>
                      </div>

                      <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[100px]">Status</TableHead>
                                <TableHead>Hostname</TableHead>
                                <TableHead>IP Address</TableHead>
                                <TableHead>Sistema Operacional</TableHead>
                                <TableHead>Hardware (CPU)</TableHead>
                                <TableHead className="text-right">Memória</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sectorMachines.map((machine) => (
                                <TableRow 
                                    key={machine.uuid} 
                                    className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                                    onClick={() => handleMachineClick(machine)} 
                                >
                                  <TableCell>
                                    <Badge 
                                      variant={getStatusBadgeVariant(machine.status)} 
                                      className={`${getStatusBadgeClass(machine.status)} font-bold border shadow-none`}
                                    >
                                      {machine.status === 'critical' ? 'CRÍTICO' : 
                                       machine.status === 'warning' ? 'ALERTA' : 
                                       machine.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-semibold text-slate-700">{machine.hostname}</TableCell>
                                  <TableCell className="text-slate-500 font-mono text-xs">{machine.ip_address}</TableCell>
                                  <TableCell className="text-slate-600">{machine.os_name}</TableCell>
                                  <TableCell className="text-slate-500 text-xs max-w-[200px] truncate" title={machine.cpu_model}>
                                    {machine.cpu_model}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-slate-600">
                                    {machine.ram_total_gb ? `${machine.ram_total_gb} GB` : '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;