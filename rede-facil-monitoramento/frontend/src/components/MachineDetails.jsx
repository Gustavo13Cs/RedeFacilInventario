import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom'; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, Cpu, HardDrive, Activity, Thermometer, Database, 
  AlertTriangle, CheckCircle, Wrench, Calendar, Plus, Save, X, User,
  CircuitBoard, MemoryStick, Monitor as MonitorIcon, Network, Layers, Search, AppWindow
} from 'lucide-react'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend} from 'recharts';
import axios from 'axios'; 
import { API_URL } from '../config';

export default function MachineDetails({ machine: initialMachineData, onBack, socket }) {

  const [machine, setMachine] = useState(initialMachineData);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const [activeTab, setActiveTab] = useState('monitoring'); 

  const [telemetryData, setTelemetryData] = useState([]);
  const [currentTemp, setCurrentTemp] = useState(0);
  const [currentDiskFree, setCurrentDiskFree] = useState(0);
  const [currentSmartStatus, setCurrentSmartStatus] = useState('N/A');

  const [logs, setLogs] = useState([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [newLog, setNewLog] = useState({ description: '', log_date: '' });

  const [softwareSearch, setSoftwareSearch] = useState('');

  const PIE_COLORS = ['#10b981', '#1e293b'];


  useEffect(() => {
    const fetchFullDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            
            const encodedUuid = encodeURIComponent(initialMachineData.uuid);

            const res = await axios.get(`${API_URL}/api/machines/${encodedUuid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setMachine(prev => ({ ...prev, ...res.data }));
        } catch (error) {
            console.error("Erro ao buscar detalhes completos:", error);
        } finally {
            setLoadingDetails(false);
        }
    };

    if (initialMachineData.uuid) {
        fetchFullDetails();
        fetchMaintenanceLogs();
    }
  }, [initialMachineData.uuid]);

  const fetchMaintenanceLogs = async () => {
    try {
        const token = localStorage.getItem('token'); 
        const res = await axios.get(`${API_URL}/api/machines/${initialMachineData.id}/logs`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setLogs(res.data);
    } catch (error) {
        console.error("Erro ao buscar logs:", error);
    }
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    try {
        const token = localStorage.getItem('token'); 
        await axios.post(`${API_URL}/api/machines/${machine.id}/logs`, {
            description: newLog.description,
            log_date: newLog.log_date || new Date()
        }, {
            headers: { Authorization: `Bearer ${token}` } 
        });
        
        fetchMaintenanceLogs(); 
        setIsLogModalOpen(false); 
        setNewLog({ description: '', log_date: '' }); 
    } catch (error) {
        console.error(error); 
        alert("Erro ao registrar manutenção.");
    }
  };

  // 3. SOCKET DE TELEMETRIA EM TEMPO REAL
  useEffect(() => {
    if (!socket) return;

    setTelemetryData(prev => {
        if (prev.length > 0) return prev;
        return Array(10).fill({ time: '--:--', cpu: 0, ram: 0, temp: 0 });
    });

    if (machine.last_telemetry) {
        setCurrentDiskFree(Number(machine.last_telemetry.disk_free_percent || 0));
        setCurrentSmartStatus(machine.last_telemetry.disk_smart_status || 'OK');
        setCurrentTemp(Number(machine.last_telemetry.temperature_celsius || 0));
    }

    const handleNewTelemetry = (newData) => {
        if (newData.machine_uuid === machine.uuid) {
            const timeNow = new Date().toLocaleTimeString();
            const tempValue = Math.round(Number(newData.temperature_celsius || 0));
            const cpuValue = Math.round(Number(newData.cpu_usage_percent || 0));
            const ramValue = Math.round(Number(newData.ram_usage_percent || 0));
            const diskFreeValue = newData.disk_free_percent ? Number(newData.disk_free_percent) : 0;
            const smartStatus = newData.disk_smart_status || 'OK';

            setCurrentTemp(tempValue);
            setCurrentDiskFree(diskFreeValue);
            setCurrentSmartStatus(smartStatus);
            
            setTelemetryData(prev => {
                const newHistory = [...prev, { 
                    time: timeNow, cpu: cpuValue, ram: ramValue, temp: tempValue 
                }];
                return newHistory.slice(-20); 
            });
        }
    };

    socket.on('new_telemetry', handleNewTelemetry);
    return () => { socket.off('new_telemetry', handleNewTelemetry); };
  }, [machine.uuid, socket, machine.last_telemetry]);

  const diskUsageData = [
    { name: 'Livre', value: currentDiskFree },
    { name: 'Usado', value: 100 - currentDiskFree }
  ];


  // --- RENDERIZAÇÃO DAS ABAS (COMPONENTES INTERNOS) ---

  const renderMonitoringTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Activity className="h-3 w-3" /> Sistema</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0"><div className="text-sm font-bold text-slate-800 truncate" title={machine.os_name}>{machine.os_name}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-600">Processador</CardTitle><Cpu className="h-4 w-4 text-blue-500" /></CardHeader>
                <CardContent><div className="text-sm font-bold text-slate-800 truncate" title={machine.cpu_model}>{machine.cpu_model}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-600">RAM Total</CardTitle><HardDrive className="h-4 w-4 text-blue-500" /></CardHeader>
                <CardContent><div className="text-lg font-bold text-slate-800">{machine.ram_total_gb} GB</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-600">Temperatura</CardTitle><Thermometer className="h-4 w-4 text-orange-500" /></CardHeader>
                <CardContent><div className={`text-2xl font-bold ${currentTemp > 80 ? 'text-red-600' : 'text-emerald-600'}`}>{currentTemp}°C</div><p className="text-xs text-slate-500">Tempo real</p></CardContent>
            </Card>
            <Card className={`border-l-4 shadow-sm ${currentSmartStatus !== 'OK' || currentDiskFree < 10 ? 'border-l-red-600 bg-red-50' : 'border-l-emerald-500'}`}>
                <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Database className="h-3 w-3" /> Disco</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0 flex items-center gap-2">
                    {currentSmartStatus !== 'OK' ? <><AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" /><div><div className="text-lg font-bold text-red-600">Erro S.M.A.R.T</div></div></> : 
                    currentDiskFree < 10 ? <><AlertTriangle className="h-6 w-6 text-orange-600 animate-pulse" /><div><div className="text-lg font-bold text-orange-700">Espaço Crítico</div></div></> : 
                    <><CheckCircle className="h-6 w-6 text-emerald-500" /><div className="text-lg font-bold text-emerald-700">Saudável</div></>}
                </CardContent>
            </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Card className="p-4">
                <CardHeader className="p-0 mb-4"><CardTitle className="text-md font-semibold text-slate-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Uso de CPU (%)</CardTitle></CardHeader>
                <div className="h-[200px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={telemetryData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="time" hide /><YAxis domain={[0, 100]} tick={{fontSize: 12}} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: '8px' }} /><Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
            </Card>
            <Card className="p-4">
                <CardHeader className="p-0 mb-4"><CardTitle className="text-md font-semibold text-slate-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div>Uso de Memória (%)</CardTitle></CardHeader>
                <div className="h-[200px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={telemetryData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="time" hide /><YAxis domain={[0, 100]} tick={{fontSize: 12}} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: '8px' }} /><Line type="monotone" dataKey="ram" stroke="#a855f7" strokeWidth={3} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
            </Card>
            <Card className="p-1 shadow-sm border-slate-200 flex flex-col md:col-span-2 xl:col-span-1">
                <CardHeader className="pb-0"><CardTitle className="text-sm font-semibold text-slate-700 flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Disco (C:)</div><Badge variant="outline" className="font-mono text-xs">{machine.disk_total_gb ? `${machine.disk_total_gb} GB` : 'N/A'}</Badge></CardTitle></CardHeader>
                <div className="h-[220px] w-full relative flex items-center justify-center">
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-3xl font-bold text-slate-700">{currentDiskFree.toFixed(1)}%</span><span className="text-xs text-slate-400 uppercase font-semibold">Livre</span></div>
                    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={diskUsageData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">{diskUsageData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><Tooltip formatter={(value) => `${value.toFixed(1)}%`} contentStyle={{ borderRadius: '8px' }} /><Legend verticalAlign="bottom" height={36} iconType="circle" /></PieChart></ResponsiveContainer>
                </div>
            </Card>
        </div>
    </div>
  );

  const renderHardwareTab = () => (
    <div className="grid gap-6 md:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="border-slate-200">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center gap-3"><CircuitBoard className="h-5 w-5 text-blue-600"/><CardTitle className="text-base text-slate-800">Placa-mãe & BIOS</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-slate-500 font-bold uppercase">Fabricante</p><p className="text-sm text-slate-700">{machine.mb_manufacturer || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-500 font-bold uppercase">Modelo</p><p className="text-sm text-slate-700">{machine.mb_model || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-500 font-bold uppercase">Versão</p><p className="text-sm text-slate-700">{machine.mb_version || 'N/A'}</p></div>
                    <div><p className="text-xs text-slate-500 font-bold uppercase">Serial</p><p className="text-sm font-mono text-slate-600 bg-slate-100 w-fit px-2 py-0.5 rounded">{machine.serial_number || 'N/A'}</p></div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-slate-200">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center gap-3"><MemoryStick className="h-5 w-5 text-purple-600"/><CardTitle className="text-base text-slate-800">Memória RAM</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <div><p className="text-xs text-slate-500 font-bold uppercase">Total Instalado</p><p className="text-xl font-bold text-slate-800">{machine.ram_total_gb} GB</p></div>
                    <div className="text-right"><p className="text-xs text-slate-500 font-bold uppercase">Slots Usados</p><p className="text-xl font-bold text-blue-600">{machine.mem_slots_used} <span className="text-sm text-slate-400 font-normal">/ {machine.mem_slots_total}</span></p></div>
                </div>
                <div>
                   <div className="w-full bg-slate-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(machine.mem_slots_used / machine.mem_slots_total) * 100}%` }}></div></div>
                   <p className="text-xs text-center text-slate-500 mt-1">Ocupação física dos slots de memória</p>
                </div>
            </CardContent>
        </Card>

        <Card className="border-slate-200">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center gap-3"><MonitorIcon className="h-5 w-5 text-orange-600"/><CardTitle className="text-base text-slate-800">Vídeo & Gráficos</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
                <div><p className="text-xs text-slate-500 font-bold uppercase">GPU</p><p className="text-sm font-bold text-slate-700">{machine.gpu_model || 'N/A'}</p></div>
                <div><p className="text-xs text-slate-500 font-bold uppercase">VRAM</p><p className="text-sm text-slate-700">{machine.gpu_vram_mb ? `${machine.gpu_vram_mb} MB` : 'Compartilhada / N/A'}</p></div>
            </CardContent>
        </Card>

        <Card className="border-slate-200 md:col-span-2">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center gap-3"><Network className="h-5 w-5 text-emerald-600"/><CardTitle className="text-base text-slate-800">Rede</CardTitle></CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow><TableHead>Interface</TableHead><TableHead>MAC</TableHead><TableHead>Status</TableHead><TableHead>Velocidade</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {machine.network_interfaces && machine.network_interfaces.length > 0 ? (
                             machine.network_interfaces.map((nic, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium text-xs">{nic.interface_name}</TableCell>
                                    <TableCell className="font-mono text-xs text-slate-500">{nic.mac_address}</TableCell>
                                    <TableCell><Badge variant={nic.is_up ? "default" : "secondary"} className={nic.is_up ? "bg-emerald-500" : ""}>{nic.is_up ? "Ativa" : "Inativa"}</Badge></TableCell>
                                    <TableCell className="text-xs text-slate-500">{nic.speed_mbps > 0 ? `${nic.speed_mbps} Mbps` : 'N/A'}</TableCell>
                                </TableRow>
                             ))
                        ) : (<TableRow><TableCell colSpan={4} className="text-center text-slate-400">Nenhuma interface de rede encontrada.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );

  const filteredSoftware = (machine.installed_software || []).filter(sw => 
      sw.software_name.toLowerCase().includes(softwareSearch.toLowerCase())
  );

  const renderSoftwareTab = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Buscar software..." className="w-full pl-8 p-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500" value={softwareSearch} onChange={(e) => setSoftwareSearch(e.target.value)} />
            </div>
            <Badge variant="outline" className="ml-2">{filteredSoftware.length} programas</Badge>
        </div>
        <Card className="border-slate-200 overflow-hidden">
            <div className="max-h-[500px] overflow-auto">
                <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10"><TableRow><TableHead className="w-[60%]">Nome</TableHead><TableHead>Versão</TableHead><TableHead>Instalação</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {filteredSoftware.length > 0 ? (
                            filteredSoftware.map((sw, i) => (
                                <TableRow key={i} className="hover:bg-slate-50">
                                    <TableCell className="font-medium text-slate-700 py-2"><AppWindow className="h-3 w-3 inline mr-2 text-blue-500"/>{sw.software_name}</TableCell>
                                    <TableCell className="text-slate-500 text-xs py-2">{sw.version || '-'}</TableCell>
                                    <TableCell className="text-slate-500 text-xs py-2">{sw.install_date ? new Date(sw.install_date).toLocaleDateString() : '-'}</TableCell>
                                </TableRow>
                            ))
                        ) : (<TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-400">Nenhum software encontrado.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </div>
        </Card>
    </div>
  );

  const renderLogsTab = () => (
    <Card className="border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Wrench className="h-5 w-5 text-orange-600" /></div><div><CardTitle className="text-lg font-bold text-slate-800">Histórico de Manutenções</CardTitle><p className="text-sm text-slate-500">Logbook de serviços realizados.</p></div></div>
            <Button onClick={() => setIsLogModalOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-sm"><Plus className="h-4 w-4" /> Registrar</Button>
        </CardHeader>
        <CardContent className="p-0">
            {logs.length === 0 ? (
                <div className="text-center py-10 text-slate-400"><Wrench className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>Nenhum registro encontrado.</p></div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {logs.map((log) => (
                        <div key={log.id} className="p-4 flex flex-col md:flex-row gap-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-start gap-3 min-w-[180px]">
                                <div className="mt-1"><Calendar className="h-4 w-4 text-slate-400" /></div>
                                <div><p className="text-sm font-bold text-slate-700">{new Date(log.log_date).toLocaleDateString()}</p><p className="text-xs text-slate-500">{new Date(log.log_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div>
                            </div>
                            <div className="flex-1"><p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{log.description}</p></div>
                            <div className="flex items-center gap-2 min-w-[150px] justify-end"><Badge variant="outline" className="flex items-center gap-1 text-slate-600 bg-white border-slate-200"><User className="h-3 w-3" />{log.technician_name || 'Técnico Excluído'}</Badge></div>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Cabeçalho Fixo */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ArrowLeft className="h-6 w-6 text-slate-600" /></button>
            <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {machine.hostname}
                {loadingDetails && <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 rounded animate-pulse">Carregando detalhes...</span>}
            </h2>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
                <span>{machine.ip_address}</span>
                <span>•</span>
                <span className="font-mono text-xs bg-slate-100 px-1 rounded">UUID: {machine.uuid ? machine.uuid.split('-')[0] : '...'}...</span>
                <span>•</span>
                <Badge variant={machine.status === 'online' ? 'default' : 'secondary'} className={machine.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}>{machine.status}</Badge>
            </div>
            </div>
        </div>
        
        {/* Navegação de Abas */}
        <div className="flex bg-slate-100 p-1 rounded-lg self-start md:self-auto overflow-x-auto">
            <button onClick={() => setActiveTab('monitoring')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'monitoring' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Activity className="w-4 h-4" /> Monitoramento
            </button>
            <button onClick={() => setActiveTab('hardware')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'hardware' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <CircuitBoard className="w-4 h-4" /> Hardware
            </button>
            <button onClick={() => setActiveTab('software')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'software' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Layers className="w-4 h-4" /> Softwares
            </button>
            <button onClick={() => setActiveTab('logs')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'logs' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Wrench className="w-4 h-4" /> Manutenção
            </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="min-h-[400px]">
        {activeTab === 'monitoring' && renderMonitoringTab()}
        {activeTab === 'hardware' && renderHardwareTab()}
        {activeTab === 'software' && renderSoftwareTab()}
        {activeTab === 'logs' && renderLogsTab()}
      </div>

      {/* MODAL DE LOGS (Portal) */}
      {isLogModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLogModalOpen(false)} />
            <Card className="relative z-10 w-full max-w-lg animate-in zoom-in-95 bg-white shadow-2xl">
                <CardHeader className="border-b pb-4 bg-white rounded-t-lg flex flex-row justify-between items-center">
                    <CardTitle className="text-slate-800 flex items-center gap-2"><Wrench className="h-5 w-5 text-orange-600" /> Registrar Manutenção</CardTitle>
                    <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                </CardHeader>
                <CardContent className="pt-6 bg-white rounded-b-lg">
                    <form onSubmit={handleSaveLog} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Data do Serviço</label>
                            <input type="datetime-local" className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-orange-500" value={newLog.log_date} onChange={(e) => setNewLog({...newLog, log_date: e.target.value})} />
                            <p className="text-xs text-slate-400 mt-1">Deixe em branco para usar a data/hora atual.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição do Serviço</label>
                            <textarea required placeholder="Ex: Limpeza interna, troca de pasta térmica..." className="w-full border border-slate-300 rounded-md p-3 outline-none focus:ring-2 focus:ring-orange-500 h-32 resize-none" value={newLog.description} onChange={(e) => setNewLog({...newLog, description: e.target.value})} />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                            <Button type="button" variant="outline" onClick={() => setIsLogModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-sm"><Save className="h-4 w-4" /> Salvar</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>, document.body
      )}
    </div>
  );
}