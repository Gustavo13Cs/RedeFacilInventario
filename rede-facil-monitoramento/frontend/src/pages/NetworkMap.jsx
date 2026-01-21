import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Network, Server, Monitor, Laptop, Wifi, ShieldAlert } from 'lucide-react';
import { API_URL } from '../config';

export default function NetworkMap() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetworkData();
    const interval = setInterval(fetchNetworkData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNetworkData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/machines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMachines(res.data);
      setLoading(false);
    } catch (error) {
      console.error("Erro ao buscar mapa de rede:", error);
      setLoading(false);
    }
  };

  const getSubnet = (ip) => {
      if (!ip) return 'Sem IP Definido';
      const parts = ip.split('.');
      if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.${parts[2]}.x`; 
      }
      return 'Outras Redes';
  };

  const groupedMachines = machines.reduce((acc, machine) => {
      const subnet = getSubnet(machine.ip_address);
      if (!acc[subnet]) {
          acc[subnet] = [];
      }
      acc[subnet].push(machine);
      return acc;
  }, {});

  const sortedSubnets = Object.keys(groupedMachines).sort((a, b) => {
      const extractThird = (s) => parseInt(s.split('.')[2]) || 0;
      return extractThird(a) - extractThird(b);
  });

  const getIcon = (machine) => {
      const name = machine.hostname?.toLowerCase() || '';
      if (name.includes('server') || name.includes('srv')) return <Server size={20} className="text-purple-600"/>;
      if (name.includes('not')) return <Laptop size={20} className="text-blue-600"/>;
      return <Monitor size={20} className="text-slate-600"/>;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6"> 
      
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="p-3 bg-indigo-100 rounded-lg shrink-0">
            <Network className="text-indigo-600 h-6 w-6" />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Mapa de Rede Lógico</h1>
            <p className="text-slate-500 text-sm">Visualização topológica agrupada por Sub-redes (Faixas de IP).</p>
        </div>
      </div>

      {loading ? (
          <div className="text-center p-10 text-slate-400">Carregando topologia...</div>
      ) : (
          <div className="grid grid-cols-1 gap-6 md:gap-8"> 
            
            {sortedSubnets.map(subnet => (
                <div key={subnet} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    
                    <div className="bg-slate-50 px-4 py-3 md:px-6 md:py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded border border-slate-200 shadow-sm shrink-0">
                                <Wifi size={20} className="text-emerald-600"/>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-700 text-sm md:text-base">Rede {subnet}</h3>
                            </div>
                        </div>
                        <span className="bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full font-bold self-start sm:self-auto">
                            {groupedMachines[subnet].length} dispositivos
                        </span>
                    </div>

                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedMachines[subnet].map(machine => (
                            <div key={machine.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group cursor-default">
                                <div className="shrink-0">
                                    {getIcon(machine)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-blue-700">
                                            {machine.hostname}
                                        </p>
                                        <div className={`shrink-0 h-2 w-2 rounded-full ${machine.status === 'online' ? 'bg-emerald-500' : 'bg-red-400'}`}></div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                                        <span className="truncate">{machine.ip_address}</span>
                                        {machine.mac_address && <span className="text-[10px] text-slate-300 hidden sm:inline">| {machine.mac_address}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {sortedSubnets.length === 0 && (
                <div className="text-center p-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <ShieldAlert className="mx-auto h-10 w-10 text-slate-300 mb-2"/>
                    <p className="text-slate-500">Nenhum dispositivo reportando IP no momento.</p>
                </div>
            )}

          </div>
      )}
    </div>
  );
}