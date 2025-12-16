import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Server, Activity, Package, Users, LogOut, Smartphone, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import io from 'socket.io-client';
import axios from 'axios';

// Importação dos Componentes
import Login from './components/Login';
import MachineDetails from './components/MachineDetails';
import Inventory from './components/Inventory'; 
import UserManagement from './components/UserManagement';
import SimCardManagement from './components/SimCardManagement';

const API_URL = "http://localhost:3001";
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'] 
});

function App() {
  const [machines, setMachines] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, critical: 0 });
  const [lastTelemetry, setLastTelemetry] = useState(null);

  const [selectedMachine, setSelectedMachine] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

      // 🔐 ADICIONADO: TOKEN NO HEADER
      const res = await axios.get(`${API_URL}/api/machines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMachines(res.data);
      updateStats(res.data);
    } catch (error) {
      console.error("Erro ao buscar máquinas:", error);
      if (error.response?.status === 401) {
        handleLogout(); // Se o token expirou, desloga
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
    // Pequeno delay para garantir que o token foi salvo
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

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shrink-0 transition-all">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="font-bold text-white text-lg tracking-wider flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">RF</div>
            REDE FÁCIL
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedMachine(null); }}
            className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'dashboard' && !selectedMachine ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white'}`}
          >
            <LayoutDashboard className="mr-3 h-5 w-5 text-blue-500" />
            Visão Geral
          </button>

          <button 
            onClick={() => { setActiveTab('inventory'); setSelectedMachine(null); }}
            className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'inventory' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white'}`}
          >
            <Package className="mr-3 h-5 w-5 text-emerald-500" />
            Inventário
          </button>

          {userRole !== 'viewer' && (
            <button 
              onClick={() => { setActiveTab('chips'); setSelectedMachine(null); }}
              className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'chips' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white'}`}
            >
              <Smartphone className="mr-3 h-5 w-5 text-orange-500" />
              Gestão de Chips
            </button>
          )}

          {userRole === 'admin' && (
            <button 
              onClick={() => { setActiveTab('users'); setSelectedMachine(null); }}
              className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'users' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white'}`}
            >
              <Users className="mr-3 h-5 w-5 text-purple-500" />
              Usuários
            </button>
          )}
        </nav>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-800/50 bg-[#0a0f1d]">
          <div className="flex items-center gap-3 mb-4 pl-1">
            <div className="bg-gradient-to-tr from-blue-600 to-blue-400 rounded-lg h-10 w-10 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {currentUser.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm font-semibold text-white leading-tight truncate max-w-[140px]" title={currentUser}>
                {currentUser}
              </p>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <p className="text-[11px] text-emerald-400/90 font-medium">Online</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-sm font-medium border ${
              isLoggingOut 
                ? 'bg-slate-800/50 text-slate-500 border-transparent cursor-not-allowed' 
                : 'bg-slate-800/80 text-slate-300 border-slate-700/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
            }`}
          >
            {isLoggingOut ? <><Loader2 className="h-4 w-4 animate-spin" /> Saindo...</> : <><LogOut className="h-4 w-4" /> Sair do Sistema</>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">
            {selectedMachine ? 'Detalhes do Ativo' : 
             activeTab === 'inventory' ? 'Gestão de Inventário' : 
             activeTab === 'chips' ? 'Gestão de Telefonia' :
             activeTab === 'users' ? 'Gestão de Usuários' :
             'Dashboard de Monitoramento'}
          </h2>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
                Sistema Online
             </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 space-y-6">
          
          {activeTab === 'inventory' ? (
              <Inventory userRole={userRole} />
            ) : activeTab === 'chips' ? (
              <SimCardManagement userRole={userRole} />
            ) : activeTab === 'users' ? ( 
              <UserManagement />
            ) : selectedMachine ? (
              <MachineDetails 
                machine={selectedMachine} 
                onBack={() => setSelectedMachine(null)}
                socket={socket} 
              />
            ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-white border-b border-slate-100">
                  <CardTitle className="text-lg text-slate-800">Listagem de Ativos</CardTitle>
                </CardHeader>
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
                      {machines.map((machine) => (
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;