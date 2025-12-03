import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Cpu, HardDrive, Activity, Thermometer } from 'lucide-react'; // Adicionado Thermometer
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MachineDetails({ machine, onBack, socket }) {
  // 1. Estado inicial agora inclui 'temp'
  const [telemetryData, setTelemetryData] = useState([
    { time: '00:00', cpu: 0, ram: 0, temp: 0 },
    { time: '00:05', cpu: 0, ram: 0, temp: 0 },
    { time: '00:10', cpu: 0, ram: 0, temp: 0 },
  ]);

  // Estado para o card de "Temperatura Atual"
  const [currentTemp, setCurrentTemp] = useState(0);

  useEffect(() => {
    // Se o socket não vier por props, não tenta conectar de novo para evitar duplicidade
    if (!socket) {
        console.error("⚠️ Socket não recebido em MachineDetails");
        return;
    }

    const handleNewTelemetry = (newData) => {
        // Verifica se os dados são desta máquina
        if (newData.machine_uuid === machine.uuid) {
            
            const timeNow = new Date().toLocaleTimeString();
            
            // 2. Arredonda os valores (Math.round) para remover as casas decimais
            const tempValue = Math.round(Number(newData.temperature_celsius || 0));
            const cpuValue = Math.round(Number(newData.cpu_usage_percent || 0));
            const ramValue = Math.round(Number(newData.ram_usage_percent || 0));

            setCurrentTemp(tempValue);
            
            setTelemetryData(prev => {
                const newHistory = [...prev, { 
                    time: timeNow, 
                    cpu: cpuValue,
                    ram: ramValue,
                    temp: tempValue // Salva a temperatura no histórico
                }];
                return newHistory.slice(-20); // Mantém apenas os últimos 20 pontos
            });
        }
    };

    // Escuta o evento
    socket.on('new_telemetry', handleNewTelemetry);

    // Limpa ao sair da tela
    return () => {
        socket.off('new_telemetry', handleNewTelemetry);
    };
  }, [machine.uuid, socket]);

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Sistema Operacional</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-slate-800">{machine.os_name}</div>
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

        {/* 3. NOVO CARD: TEMPERATURA */}
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

        {/* 4. NOVO GRÁFICO: TEMPERATURA */}
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
      </div>
    </div>
  );
}