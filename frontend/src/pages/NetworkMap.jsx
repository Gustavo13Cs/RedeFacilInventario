import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, Monitor, Laptop, Server, Router } from 'lucide-react';

export default function NetworkMap() {
    const [topology, setTopology] = useState([]);

    useEffect(() => {
        const fetchTopology = async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await axios.get(`${API_URL}/topology`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTopology(res.data);
            } catch (error) {
                console.error("Erro ao carregar topologia:", error);
            }
        };
        fetchTopology();
    }, []);

    const getIcon = (osName) => {
        if (!osName) return <Monitor className="h-5 w-5 text-slate-500" />;
        if (osName.toLowerCase().includes('server')) return <Server className="h-5 w-5 text-purple-600" />;
        return <Laptop className="h-5 w-5 text-blue-600" />;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-lg">
                    <Network className="h-6 w-6 text-blue-700" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Mapa de Rede</h2>
                    <p className="text-slate-500">Visualização topológica por Gateway.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {topology.map((node, index) => (
                    <Card key={index} className="border-t-4 border-t-blue-500 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="bg-slate-50 border-b pb-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <Router className="h-5 w-5 text-slate-600" />
                                    <div>
                                        <CardTitle className="text-sm font-bold text-slate-700">Gateway: {node.gateway}</CardTitle>
                                        <p className="text-xs text-slate-400">Máscara: {node.subnet}</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="bg-white">{node.machines.length} devices</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="space-y-3">
                                {node.machines.map(machine => (
                                    <div key={machine.uuid} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-md hover:border-blue-200 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {getIcon(machine.os_name)}
                                            <div>
                                                <p className="text-sm font-bold text-slate-700 truncate w-32" title={machine.hostname}>{machine.hostname}</p>
                                                <p className="text-xs text-slate-400 font-mono">{machine.ip_address}</p>
                                            </div>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${machine.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} title={machine.status} />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            {topology.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <Network className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400">Nenhuma rede mapeada ainda.</p>
                </div>
            )}
        </div>
    );
}