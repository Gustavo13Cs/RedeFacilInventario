import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_URL } from '../config'; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, RefreshCw, AlertTriangle, CheckCircle, BellRing, Clock } from 'lucide-react';

export default function WhatsAppConfig() {
    const [status, setStatus] = useState('LOADING');
    const [qrCode, setQrCode] = useState(null);
    const [alerts, setAlerts] = useState([]); 

    // ✅ FUNÇÃO 1: Busca apenas o Status do Bot (Conectado/Desconectado)
    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            // AQUI ESTAVA O ERRO: Agora chama a rota certa!
            const res = await axios.get(`${API_URL}/whatsapp/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setStatus(res.data.status);
            setQrCode(res.data.qrCode);
        } catch (error) {
            console.error("Erro ao buscar status do WhatsApp", error);
            // Se der erro, assumimos desconectado para parar o loading infinito
            if (status === 'LOADING') setStatus('DISCONNECTED');
        }
    };

    // ✅ FUNÇÃO 2: Busca o histórico de Alertas
    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/alerts?limit=50`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Proteção para garantir que é uma lista
            if (Array.isArray(res.data)) {
                setAlerts(res.data);
            } else {
                setAlerts([]); 
            }
        } catch (error) {
            console.error("Erro ao buscar histórico de alertas", error);
        }
    };

    useEffect(() => {
        // Chama as duas coisas ao iniciar
        fetchStatus();
        fetchHistory(); 

        const newSocket = io('http://localhost:3001'); 
        
        newSocket.on('new_alert', (alertData) => {
            console.log('🚨 Novo Alerta Socket:', alertData);
            setAlerts(prev => [alertData, ...prev]);
        });

        const interval = setInterval(fetchStatus, 5000);
        return () => {
            clearInterval(interval);
            newSocket.disconnect();
        };
    }, []);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Smartphone className="text-green-600" /> Monitoramento & Alertas
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* CARD DA ESQUERDA: STATUS */}
                <Card>
                    <CardHeader><CardTitle>Status do Bot</CardTitle></CardHeader>
                    <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
                        {status === 'CONNECTED' ? (
                            <div className="text-center">
                                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-medium text-green-700">Sistema Online</p>
                                <p className="text-sm text-slate-500">Monitorando 24h</p>
                            </div>
                        ) : status === 'SCAN_QR' && qrCode ? (
                            <div className="text-center">
                                <img src={qrCode} alt="QR" className="w-48 h-48 mx-auto border-4 border-white shadow-lg" />
                                <p className="mt-2 text-sm">Escaneie para conectar</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-slate-400">Carregando status...</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* CARD DA DIREITA: ALERTAS */}
                <Card className="border-l-4 border-l-red-500 bg-slate-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <BellRing /> Alertas (Últimas 24h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {alerts.length === 0 ? (
                            <div className="text-center text-slate-400 py-10">
                                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p>Tudo tranquilo por aqui.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                {Array.isArray(alerts) && alerts.map((alert, index) => (
                                    <div key={index} className="bg-white p-4 rounded-md shadow-sm border border-red-100 flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-red-600 font-bold uppercase text-xs">
                                            <AlertTriangle className="w-4 h-4" />
                                            {alert.alert_type}
                                        </div>
                                        <p className="text-sm text-slate-700 font-medium">{alert.hostname || 'Máquina'}</p>
                                        <p className="text-sm text-slate-600">{alert.message}</p>
                                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                                            <Clock className="w-3 h-3" />
                                            {new Date(alert.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}