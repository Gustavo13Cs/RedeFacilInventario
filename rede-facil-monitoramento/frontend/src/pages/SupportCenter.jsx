import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function SupportCenter() {
    const [requests, setRequests] = useState([]);

    const fetchRequests = async () => {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/support`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setRequests(res.data);
    };

    const handleResolve = async (id) => {
        const token = localStorage.getItem('token');
        await axios.put(`${API_URL}/support/${id}/resolve`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        fetchRequests();
    };

    useEffect(() => {
        fetchRequests();
        const interval = setInterval(fetchRequests, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="text-red-500" /> Central de Chamados (Help Desk)
            </h1>

            <div className="grid gap-4">
                {requests.map(req => (
                    <Card key={req.id} className={`border-l-4 ${req.status === 'pending' ? 'border-l-red-500 bg-red-50' : 'border-l-green-500 bg-white'}`}>
                        <CardContent className="p-4 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-lg">{req.hostname}</span>
                                    <Badge variant="outline">{req.ip_address}</Badge>
                                    <Badge className="bg-slate-200 text-slate-700">{req.sector || 'Sem Setor'}</Badge>
                                </div>
                                <p className="text-sm text-slate-500 flex items-center gap-1">
                                    <Clock size={14} /> Aberto em: {new Date(req.created_at).toLocaleString()}
                                </p>
                            </div>

                            {req.status === 'pending' ? (
                                <Button onClick={() => handleResolve(req.id)} className="bg-red-600 hover:bg-red-700 text-white">
                                    Finalizar Atendimento
                                </Button>
                            ) : (
                                <div className="flex items-center text-green-600 gap-1 font-medium">
                                    <CheckCircle size={20} /> Resolvido
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
                
                {requests.length === 0 && (
                    <div className="text-center text-slate-400 py-10">Nenhum chamado aberto. Tudo tranquilo! ☕</div>
                )}
            </div>
        </div>
    );
}