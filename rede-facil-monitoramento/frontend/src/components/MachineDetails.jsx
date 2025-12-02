import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; 
import { ArrowLeft, Cpu, HardDrive, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function MachineDetails({ machine, onBack }) {
  const [telemetryData, setTelemetryData] = useState([
    { time: '00:00', cpu: 0, ram: 0 },
    { time: '00:05', cpu: 0, ram: 0 },
    { time: '00:10', cpu: 0, ram: 0 },
  ]);

  useEffect(() => {
    socket.on('new_telemetry', (newData) => {
      if (newData.machine_uuid === machine.uuid) {
        
        const timeNow = new Date().toLocaleTimeString('pt-BR', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
        
        setTelemetryData(prev => {
          const newHistory = [...prev, { 
            time: timeNow, 
            cpu: Number(newData.cpu_usage_percent), 
            ram: Number(newData.ram_usage_percent),
            disk: Number(newData.disk_usage_percent || 0)
          }];
          
          return newHistory.slice(-20); 
        });
      }
    });

    return () => {
      socket.off('new_telemetry');
    };
  }, [machine.uuid]);

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

      {/* Cards de Info Rápida */}
      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico CPU */}
        <Card className="p-4">
            <CardHeader className="p-0 mb-4">
                <CardTitle className="text-md font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    Uso de CPU (%)
                </CardTitle>
            </CardHeader>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetryData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="cpu" 
                            stroke="#3b82f6" 
                            strokeWidth={3} 
                            dot={false} 
                            activeDot={{ r: 6 }} 
                            animationDuration={500}
                        />
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
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetryData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="ram" 
                            stroke="#a855f7" 
                            strokeWidth={3} 
                            dot={false} 
                            activeDot={{ r: 6 }}
                            animationDuration={500}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
      </div>
    </div>
  );
}