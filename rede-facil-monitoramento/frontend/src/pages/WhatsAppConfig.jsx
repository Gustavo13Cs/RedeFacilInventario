import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_URL } from '../config'; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Adicionei o Button
import { Smartphone, AlertTriangle, CheckCircle, BellRing, Clock, RefreshCcw, LogOut } from 'lucide-react'; // Novos ícones

const getSocketUrl = (url) => {
    let cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    if (cleanUrl.endsWith('/api')) {
        cleanUrl = cleanUrl.slice(0, -4);
    }
    return cleanUrl;
};

export default function WhatsAppConfig() {
    const [status, setStatus] = useState('LOADING');
    const [qrCode, setQrCode] = useState(null);
    const [alerts, setAlerts] = useState([]); 
    const [isResetting, setIsResetting] = useState(false); // Estado para o loading do botão

    const fetchStatus = async () => {
        // Se estiver resetando, pausa a busca para não piscar a tela
        if (isResetting) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/whatsapp/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setStatus(res.data.status);
            setQrCode(res.data.qrCode);
        } catch (error) {
            console.error("Erro ao buscar status do WhatsApp", error);
            if (status === 'LOADING') setStatus('DISCONNECTED');
        }
    };

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/alerts?limit=50`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (Array.isArray(res.data)) {
                setAlerts(res.data);
            } else {
                setAlerts([]); 
            }
        } catch (error) {
            console.error("Erro ao buscar histórico de alertas", error);
        }
    };

    // --- FUNÇÃO DO BOTÃO ---
    const handleResetSession = async () => {
        if (!window.confirm("Isso irá desconectar o WhatsApp atual e gerar um novo QR Code. Deseja continuar?")) return;
        
        setIsResetting(true);
        setStatus('DISCONNECTED');
        setQrCode(null);

        try {
            const token = localStorage.getItem('token');
            // Chama a nova rota que criamos
            await axios.post(`${API_URL}/whatsapp/logout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Espera 5 segundos antes de voltar a buscar o status (tempo pro backend reiniciar)
            setTimeout(() => {
                setIsResetting(false);
                fetchStatus();
            }, 5000);

        } catch (error) {
            console.error("Erro ao resetar sessão", error);
            setIsResetting(false);
            alert("Erro ao tentar reiniciar a sessão.");
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchHistory(); 

        const socketUrl = getSocketUrl(API_URL);

        const newSocket = io(socketUrl, {
            transports: ['websocket', 'polling']
        }); 
        
        newSocket.on('connect_error', (err) => {
            console.error("Erro de conexão Socket WhatsApp:", err);
        });
        
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
                
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle>Status do Bot</CardTitle>
                        {/* --- AQUI ESTÁ O BOTÃO NOVO --- */}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleResetSession} 
                            disabled={isResetting}
                            className="text-slate-600 hover:text-red-600 hover:bg-red-50 border-slate-200"
                        >
                            {isResetting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                            {isResetting ? "Reiniciando..." : "Novo QR Code"}
                        </Button>
                    </CardHeader>
                    
                    <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
                        {isResetting ? (
                             <div className="text-center animate-in fade-in">
                                <RefreshCcw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                                <p className="text-slate-500">Reiniciando serviços...</p>
                                <p className="text-xs text-slate-400 mt-2">Aguarde...</p>
                             </div>
                        ) : status === 'CONNECTED' ? (
                            <div className="text-center animate-in zoom-in-50">
                                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-medium text-green-700">Sistema Online</p>
                                <p className="text-sm text-slate-500">Monitorando 24h</p>
                            </div>
                        ) : status === 'SCAN_QR' && qrCode ? (
                            <div className="text-center animate-in fade-in">
                                <div className="p-2 bg-white border-2 border-slate-100 rounded-lg shadow-sm inline-block">
                                    <img src={qrCode} alt="QR" className="w-48 h-48" />
                                </div>
                                <p className="mt-4 text-sm font-medium text-slate-600 flex items-center justify-center gap-2">
                                    <Smartphone className="w-4 h-4" /> Abra o WhatsApp e escaneie
                                </p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-slate-400">Carregando status...</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

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
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
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