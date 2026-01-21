import React, { useState, useEffect } from 'react';
import { Layers, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from 'axios';

import { API_URL } from '../config'; 

const SectorManagement = ({ machines, onUpdateMachine }) => {
  const [newSector, setNewSector] = useState('');
  
  const [availableSectors, setAvailableSectors] = useState([
    "Comercial", "Financeiro", "Recepção", "TI", "Suporte"
  ]);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAvailableSectors(prevSectors => {
      const dbSectors = machines.map(m => m.sector).filter(Boolean);
      const combined = new Set([...prevSectors, ...dbSectors]);
      return [...combined].sort();
    });
  }, [machines]);

  const handleAddSector = () => {
    if (newSector && !availableSectors.includes(newSector)) {
      setAvailableSectors(prev => [...prev, newSector].sort());
      setNewSector('');
    }
  };

  const handleUpdateSector = async (machineUuid, sectorName) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
      
      const endpoint = baseUrl.endsWith('/api') 
        ? `${baseUrl}/machines/${machineUuid}/sector`
        : `${baseUrl}/api/machines/${machineUuid}/sector`;

      await axios.put(endpoint, 
        { sector: sectorName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      onUpdateMachine(machineUuid, sectorName);
      
    } catch (error) {
      console.error("Erro ao atualizar setor:", error);
      const msg = error.response?.data?.message || "Erro ao salvar. Verifique o console.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-white border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Layers className="h-5 w-5 text-pink-600" />
            Gerenciamento de Setores e Localização
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Cadastrar Novo Setor</label>
            
            <div className="flex flex-col sm:flex-row gap-3 max-w-md w-full">
              <input 
                type="text" 
                value={newSector}
                onChange={(e) => setNewSector(e.target.value)}
                placeholder="Ex: Marketing"
                className="flex-1 h-10 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm w-full"
              />
              <button 
                onClick={handleAddSector}
                className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Dica: Selecione o setor em uma máquina abaixo para salvar definitivamente no banco.
            </p>
          </div>

          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto w-full">
                <Table className="min-w-[600px]"> 
                <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead className="font-bold text-slate-700 whitespace-nowrap">Máquina (Hostname)</TableHead>
                    <TableHead className="font-bold text-slate-700 whitespace-nowrap">Endereço IP</TableHead>
                    <TableHead className="font-bold text-slate-700 whitespace-nowrap">Setor Atual</TableHead>
                    <TableHead className="font-bold text-slate-700 whitespace-nowrap">Ação</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {machines.map((machine) => (
                    <TableRow key={machine.uuid} className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-800 whitespace-nowrap">{machine.hostname}</TableCell>
                        <TableCell className="text-slate-500 font-mono text-xs whitespace-nowrap">{machine.ip_address}</TableCell>
                        <TableCell className="whitespace-nowrap">
                        {machine.sector ? (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100">
                            {machine.sector}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-slate-400 border-dashed">
                            Sem Setor
                            </Badge>
                        )}
                        </TableCell>
                        <TableCell>
                        <div className="relative">
                            <select 
                            className="h-9 w-full min-w-[160px] max-w-[220px] rounded-md border border-slate-300 text-sm px-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                            value={machine.sector || ""}
                            onChange={(e) => handleUpdateSector(machine.uuid, e.target.value)}
                            disabled={loading}
                            >
                            <option value="" disabled>Selecione o setor...</option>
                            {availableSectors.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                            </select>
                        </div>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SectorManagement;