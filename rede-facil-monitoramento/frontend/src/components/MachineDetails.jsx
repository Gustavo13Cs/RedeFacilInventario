import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Cpu, HardDrive, Activity, Thermometer } from 'lucide-react'; // Adicionado Thermometer
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MachineDetails({ machine, onBack, socket }) {
  const [telemetryData, setTelemetryData] = useState([
    { time: '00:00', cpu: 0, ram: 0, temp: 0 },
    { time: '00:05', cpu: 0, ram: 0, temp: 0 },
    { time: '00:10', cpu: 0, ram: 0, temp: 0 },
  ]);

  const [currentTemp, setCurrentTemp] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const handleNewTelemetry = (newData) => {
        if (newData.machine_uuid === machine.uuid) {
            
            const timeNow = new Date().toLocaleTimeString();
            const tempValue = Number(newData.temperature_celsius || 0);

            setCurrentTemp(tempValue);
            
            setTelemetryData(prev => {
                const newHistory = [...prev, { 
                    time: timeNow, 
                    cpu: Number(newData.cpu_usage_percent), 
                    ram: Number(newData.ram_usage_percent),
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
        >
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

      {/* Cards de Info Rápida - Atualizado com Temperatura */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Sistema Operacional</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-slate-800">{machine.os_name}</div>
            <p className="text-xs text-slate-500">Versão/Build atual</p>
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
            <p className="text-xs text-slate-500">Arquitetura</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Memória Total</CardTitle>
            <HardDrive className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-slate-800">{machine.ram_total_gb} GB</div>
            <p className="text-xs text-slate-500">DDR4 / DDR5</p>
          </CardContent>
        </Card>

        {/* Novo Card de Temperatura Atual */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Temp. Atual</CardTitle>
            <Thermometer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-bold ${currentTemp > 80 ? 'text-red-600' : 'text-slate-800'}`}>
                {currentTemp}°C
            </div>
            <p className="text-xs text-slate-500">Monitoramento em tempo real</p>
          </CardContent>
        </Card>
      </div>

      {/* Área dos Gráficos */}
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
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} animationDuration={500} />
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
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="ram" stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6 }} animationDuration={500} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>

        {/* NOVO: Gráfico Temperatura */}
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
                        {/* Domínio ajustado para 0 a 100 graus (ou mais se necessário) */}
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 6 }} animationDuration={500} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>

      </div>
    </div>
  );
}