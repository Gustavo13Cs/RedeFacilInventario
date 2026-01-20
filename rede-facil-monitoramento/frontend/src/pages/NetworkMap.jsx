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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-100 rounded-lg">
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
          <div className="grid grid-cols-1 gap-8">
            
            {sortedSubnets.map(subnet => (
                <div key={subnet} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    
                    {/* Cabeçalho da Rede (O "Roteador" Virtual) */}
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded border border-slate-200 shadow-sm">
                                <Wifi size={20} className="text-emerald-600"/>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-700">Rede {subnet}</h3>
                            </div>
                        </div>
                        <span className="bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded-full font-bold">
                            {groupedMachines[subnet].length} dispositivos
                        </span>
                    </div>

                    {/* Lista de Dispositivos desta Rede */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedMachines[subnet].map(machine => (
                            <div key={machine.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group">
                                <div className="shrink-0">
                                    {getIcon(machine)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-blue-700">
                                            {machine.hostname}
                                        </p>
                                        <div className={`h-2 w-2 rounded-full ${machine.status === 'online' ? 'bg-emerald-500' : 'bg-red-400'}`}></div>
                                    </div>
                                    <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                        {machine.ip_address}
                                        {machine.mac_address && <span className="text-[10px] text-slate-300">| {machine.mac_address}</span>}
                                    </p>
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