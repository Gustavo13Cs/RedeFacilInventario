import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { generateTagsPDF } from '@/utils/exportUtils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Search, Printer, Filter, Monitor, Box, Smartphone, CheckSquare, Square } from 'lucide-react';

export default function TagGenerator() {
    const [activeTab, setActiveTab] = useState('machines'); 
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [sectorFilter, setSectorFilter] = useState('Todos');

    useEffect(() => {
        fetchData();
        setSelectedIds([]); 
        setSearchTerm('');
    }, [activeTab]);

    useEffect(() => {
        let result = data;

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(item => {
                if (activeTab === 'machines') return item.hostname?.toLowerCase().includes(lower);
                if (activeTab === 'inventory') return item.name?.toLowerCase().includes(lower) || item.patrimony_code?.includes(lower);
                if (activeTab === 'chips') return item.identification?.toLowerCase().includes(lower) || item.model?.toLowerCase().includes(lower);
                return false;
            });
        }

        if (sectorFilter !== 'Todos') {
            result = result.filter(item => {
                if (activeTab === 'machines') return item.sector === sectorFilter;
                if (activeTab === 'inventory') return item.location === sectorFilter;
                return true; 
            });
        }

        setFilteredData(result);
    }, [data, searchTerm, sectorFilter, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            let url = '';
            
            if (activeTab === 'machines') url = `${API_URL}/machines`;
            else if (activeTab === 'inventory') url = `${API_URL}/inventory?limit=1000`;
            
            else if (activeTab === 'chips') url = `${API_URL}/devices`; 

            const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            
            let items = res.data.data || res.data;
            setData(items);
            setFilteredData(items);
        } catch (error) {
            console.error("Erro ao buscar dados:", error);
            setData([]); 
            setFilteredData([]);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredData.length) setSelectedIds([]);
        else setSelectedIds(filteredData.map(i => i.id || i.uuid));
    };

    const toggleSelectOne = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id));
        else setSelectedIds(prev => [...prev, id]);
    };

    const handleGenerate = () => {
        if (selectedIds.length === 0) return alert("Selecione pelo menos 1 item.");
        const itemsToPrint = filteredData.filter(i => selectedIds.includes(i.id || i.uuid));
        generateTagsPDF(itemsToPrint, activeTab);
    };

    const uniqueSectors = ['Todos', ...new Set(data.map(i => {
        if (activeTab === 'machines') return i.sector || 'Sem Setor';
        if (activeTab === 'inventory') return i.location || 'Geral';
        return null;
    }).filter(Boolean))].sort();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <QrCode className="h-8 w-8 text-indigo-600"/> Gerador de Etiquetas
                    </h1>
                    <p className="text-slate-500">Selecione os itens e gere etiquetas com QR Code.</p>
                </div>
                <Button onClick={handleGenerate} disabled={selectedIds.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    <Printer className="h-4 w-4" /> 
                    Imprimir ({selectedIds.length})
                </Button>
            </div>

            <div className="flex gap-2 border-b border-slate-200 pb-1">
                <button onClick={() => setActiveTab('machines')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'machines' ? 'bg-white border-x border-t border-slate-200 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Monitor className="h-4 w-4"/> Computadores
                </button>
                <button onClick={() => setActiveTab('inventory')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'inventory' ? 'bg-white border-x border-t border-slate-200 text-emerald-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Box className="h-4 w-4"/> Inventário
                </button>
                <button onClick={() => setActiveTab('chips')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${activeTab === 'chips' ? 'bg-white border-x border-t border-slate-200 text-orange-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Smartphone className="h-4 w-4"/> Celulares
                </button>
            </div>

            <Card className="bg-slate-50 border-none shadow-sm">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                        <input 
                            className="w-full pl-9 p-2 border rounded-md text-sm outline-none focus:border-indigo-500"
                            placeholder={activeTab === 'chips' ? "Buscar ID ou Modelo..." : "Buscar..."}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {activeTab !== 'chips' && (
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Filter className="h-4 w-4 text-slate-500"/>
                            <select className="p-2 border rounded-md text-sm outline-none w-full md:w-48" value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
                                {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="text-sm text-slate-500 whitespace-nowrap">Mostrando <b>{filteredData.length}</b> itens</div>
                </CardContent>
            </Card>

            <Card>
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-10">
                                    <button onClick={toggleSelectAll}>
                                        {selectedIds.length === filteredData.length && filteredData.length > 0 ? <CheckSquare className="h-5 w-5 text-indigo-600"/> : <Square className="h-5 w-5 text-slate-400"/>}
                                    </button>
                                </th>
                                <th className="p-4">Identificação</th>
                                <th className="p-4">Detalhe / Modelo</th>
                                <th className="p-4">Status / Local</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan="4" className="p-8 text-center text-slate-400">Carregando...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="4" className="p-8 text-center text-slate-400">Nenhum item encontrado.</td></tr>
                            ) : (
                                filteredData.map(item => {
                                    const id = item.id || item.uuid;
                                    const isSelected = selectedIds.includes(id);
                                    let col1, col2, col3;

                                    if (activeTab === 'machines') {
                                        col1 = <span className="font-bold text-slate-700">{item.hostname}</span>;
                                        col2 = <span className="font-mono text-xs text-slate-500">{item.ip_address}</span>;
                                        col3 = <Badge variant="outline">{item.sector || 'Sem Setor'}</Badge>;
                                    } else if (activeTab === 'inventory') {
                                        col1 = <span className="font-bold text-slate-700">{item.name}</span>;
                                        col2 = <span className="text-slate-600 font-medium">{item.brand} {item.model}</span>;
                                        col3 = <span className="text-slate-600">{item.location}</span>;
                                    } else {
                                        col1 = <span className="font-bold text-slate-800 text-base">{item.name}</span>; 
                                        col2 = <span className="text-slate-600 font-medium">{item.model}</span>;

                                        col3 = (
                                            <div className="flex flex-col gap-1">
                                                <Badge className={item.status === 'ativo' ? "bg-emerald-100 text-emerald-700 w-fit border-emerald-200" : "bg-slate-100 text-slate-600 w-fit"}>
                                                    {item.status || 'ativo'}
                                                </Badge>
                                            </div>
                                        );
                                    }

                                    return (
                                        <tr key={id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`} onClick={() => toggleSelectOne(id)}>
                                            <td className="p-4">
                                                {isSelected ? <CheckSquare className="h-5 w-5 text-indigo-600"/> : <Square className="h-5 w-5 text-slate-300"/>}
                                            </td>
                                            <td className="p-4">{col1}</td>
                                            <td className="p-4">{col2}</td>
                                            <td className="p-4">{col3}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}