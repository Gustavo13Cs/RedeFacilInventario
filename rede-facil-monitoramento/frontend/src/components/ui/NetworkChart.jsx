import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Wifi, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const NetworkChart = ({ data, loading }) => {

  if (loading) {
      return (
          <div className="h-[250px] flex items-center justify-center text-slate-400 border rounded-lg bg-slate-50">
              <p className="animate-pulse">Carregando dados de rede...</p>
          </div>
      );
  }

  if (!data || data.length === 0) {
      return (
        <Card className="h-[250px] flex items-center justify-center bg-slate-50 border-dashed">
            <div className="text-center text-slate-400">
                <Wifi className="h-10 w-10 mx-auto mb-2 opacity-20"/>
                <p>Sem dados de rede recentes.</p>
            </div>
        </Card>
      );
  }

  const formattedData = data.map(item => ({
      ...item,
      time: new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
  }));

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="p-4 pb-2 border-b border-slate-100 bg-white rounded-t-lg">
        <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Wifi size={18} className="text-blue-500"/> Qualidade de Conexão (Google DNS)
            </CardTitle>
            <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div> Latência (ms)
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div> Perda (%)
                </div>
            </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                    dataKey="time" 
                    tick={{fontSize: 10, fill: '#64748b'}} 
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis 
                    yAxisId="left"
                    tick={{fontSize: 10, fill: '#64748b'}} 
                    axisLine={false}
                    tickLine={false}
                    width={30}
                />
                <YAxis 
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{fontSize: 10, fill: '#ef4444'}} 
                    axisLine={false}
                    tickLine={false}
                    width={30}
                    hide={true} 
                />
                <Tooltip 
                    contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px'}}
                    itemStyle={{padding: 0}}
                />
                
                <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="latency_ms" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: 4 }} 
                    name="Latência (ms)"
                    isAnimationActive={false} 
                />
                <Line 
                    yAxisId="right"
                    type="step" 
                    dataKey="packet_loss" 
                    stroke="#ef4444" 
                    strokeWidth={2} 
                    dot={false} 
                    name="Perda (%)"
                    isAnimationActive={false}
                />
            </LineChart>
            </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkChart;