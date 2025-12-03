import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Server, AlertCircle, Activity, HardDrive, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import io from 'socket.io-client';
import axios from 'axios';
import MachineDetails from './components/MachineDetails'; 

const API_URL = "http://localhost:3001";
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'] 
});

function App() {
  const [machines, setMachines] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, critical: 0 });
  const [lastTelemetry, setLastTelemetry] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [selectedMachine, setSelectedMachine] = useState(null);

  useEffect(() => {
    fetchMachines();

    socket.on("connect", () => console.log("🟢 Conectado ao WebSocket"));
    
    socket.on("new_telemetry", (data) => {
      setLastTelemetry(data);
      setMachines(prevMachines => 
         prevMachines.map(m => m.uuid === data.machine_uuid ? { ...m, status: 'online' } : m)
      );
    });

    socket.on("new_alert", (alert) => {
      console.log("Novo Alerta:", alert);
    });

    return () => {
      socket.off("connect");
      socket.off("new_telemetry");
      socket.off("new_alert");
    };
  }, []);

  const fetchMachines = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/machines`);
      setMachines(res.data);
      updateStats(res.data);
    } catch (error) {
      console.error("Erro ao buscar máquinas:", error);
    }
  };

  const updateStats = (data) => {
    const total = data.length;
    const online = data.filter((m) => m.status === 'online').length;
    const critical = data.filter((m) => m.status === 'critical').length; 
    setStats({ total, online, critical });
  };
  const handleMachineClick = (machine) => {
    setSelectedMachine(machine);
  };

  const handleBack = () => {
    setSelectedMachine(null);
  };

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
          {/* Outros botões... */}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-blue-900/50 rounded-full h-10 w-10 flex items-center justify-center text-blue-200 font-bold text-sm border border-blue-800">
              AD
            </div>
            <div>
              <p className="text-sm font-medium text-white">Administrador</p>
              <p className="text-xs text-slate-500">TI Suporte</p>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">
            {selectedMachine ? 'Detalhes do Ativo' : 'Dashboard de Monitoramento'}
          </h2>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
                Sistema Online
             </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 space-y-6">
          
          {/* RENDERIZAÇÃO CONDICIONAL: DETALHES OU DASHBOARD */}
          {selectedMachine ? (
            <MachineDetails 
            machine={selectedMachine} 
            onBack={handleBack}
            socket={socket} />
          ) : (
            <>
              {/* CARDS DE ESTATÍSTICAS */}
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
                {/* ... Outros cards iguais ao anterior ... */}
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
              {/* TABELA DE MÁQUINAS */}
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
                              variant={machine.status === 'online' ? 'default' : 'secondary'} 
                              className={`${machine.status === 'online' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} font-medium border shadow-none`}
                            >
                              {machine.status}
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