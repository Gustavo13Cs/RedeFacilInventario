import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Cpu, HardDrive, Activity, Thermometer, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend} from 'recharts';

export default function MachineDetails({ machine, onBack, socket }) {

  const [telemetryData, setTelemetryData] = useState([]);

  const [currentTemp, setCurrentTemp] = useState(0);
  const [currentDiskFree, setCurrentDiskFree] = useState(0);
  const [currentSmartStatus, setCurrentSmartStatus] = useState('N/A');

  const PIE_COLORS = ['#10b981', '#1e293b'];

  useEffect(() => {
    if (!socket) {
        console.error("⚠️ Socket não recebido em MachineDetails");
        return;
    }

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
                    time: timeNow, 
                    cpu: cpuValue,
                    ram: ramValue,
                    temp: tempValue 
                }];
                return newHistory.slice(-20); 
            });
        }
    };

    socket.on('new_telemetry', handleNewTelemetry);

    return () => {
        socket.off('new_telemetry', handleNewTelemetry);
    };
  }, [machine.uuid, socket]);

  const diskUsageData = [
    { name: 'Livre', value: currentDiskFree },
    { name: 'Usado', value: 100 - currentDiskFree }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <ArrowLeft className="h-6 w-6 text-slate-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{machine.hostname}</h2>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span>{machine.ip_address}</span>
            <span>•</span>
            <Badge variant={machine.status === 'online' ? 'default' : 'secondary'} 
               className={machine.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}>
               {machine.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Cards de Informações */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-3 w-3" /> Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm font-bold text-slate-800 truncate" title={machine.os_name}>{machine.os_name}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Processador</CardTitle>
            <Cpu className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-slate-800 truncate" title={machine.cpu_model}>
                {machine.cpu_model}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Memória Total</CardTitle>
            <HardDrive className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-slate-800">{machine.ram_total_gb} GB</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Temperatura</CardTitle>
            <Thermometer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${currentTemp > 80 ? 'text-red-600' : 'text-emerald-600'}`}>
                {currentTemp}°C
            </div>
            <p className="text-xs text-slate-500">Em tempo real</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 shadow-sm ${currentSmartStatus !== 'OK' || currentDiskFree < 10 ? 'border-l-red-600 bg-red-50' : 'border-l-emerald-500'}`}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Database className="h-3 w-3" /> Status do Disco
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 flex items-center gap-2">
            {currentSmartStatus !== 'OK' ? (
                <>
                    <AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" />
                    <div>
                        <div className="text-lg font-bold text-red-600">Falha Hardware</div>
                        <p className="text-xs text-red-500">Erro S.M.A.R.T</p>
                    </div>
                </>
            ) : currentDiskFree < 10 ? (
                <>
                    <AlertTriangle className="h-6 w-6 text-orange-600 animate-pulse" />
                    <div>
                        <div className="text-lg font-bold text-orange-700">Espaço Crítico</div>
                        <p className="text-xs text-orange-600">HD quase cheio</p>
                    </div>
                </>
            ) : (
                <>
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                    <div className="text-lg font-bold text-emerald-700">Saudável</div>
                </>
            )}
          </CardContent>
        </Card>

      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        
        {/* Gráfico CPU */}
        <Card className="p-4">
            <CardHeader className="p-0 mb-4">
                <CardTitle className="text-md font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    Uso de CPU (%)
                </CardTitle>
            </CardHeader>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetryData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>

        {/* Gráfico RAM */}
        <Card className="p-4">
            <CardHeader className="p-0 mb-4">
                <CardTitle className="text-md font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    Uso de Memória (%)
                </CardTitle>
            </CardHeader>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetryData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="ram" stroke="#a855f7" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>

        {/* TEMPERATURA */}
        <Card className="p-4 md:col-span-2 xl:col-span-1">
            <CardHeader className="p-0 mb-4">
                <CardTitle className="text-md font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    Temperatura (°C)
                </CardTitle>
            </CardHeader>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetryData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>

        <Card className="p-1 shadow-sm border-slate-200 flex flex-col">
            <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        Armazenamento (Disco C:)
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                         {machine.disk_total_gb ? `${machine.disk_total_gb} GB Total` : 'N/A'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <div className="h-[220px] w-full relative flex items-center justify-center">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-700">{currentDiskFree.toFixed(1)}%</span>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Livre</span>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={diskUsageData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60} 
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {diskUsageData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value.toFixed(1)}%`} contentStyle={{ borderRadius: '8px' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>
      </div>

      <div className="text-center pt-8 text-xs text-slate-300 font-mono">
        UUID: {machine.uuid}
      </div>

    </div>
  );
}