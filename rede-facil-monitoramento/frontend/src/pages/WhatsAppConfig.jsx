import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config'; // Sua URL da API
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function WhatsAppConfig() {
    const [status, setStatus] = useState('LOADING');
    const [qrCode, setQrCode] = useState(null);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/whatsapp/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatus(res.data.status);
            setQrCode(res.data.qrCode);
        } catch (error) {
            console.error("Erro ao buscar status do WhatsApp", error);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Atualiza a cada 5s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Smartphone className="text-green-600"/> Notificações WhatsApp
            </h1>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Status da Conexão</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-10 min-h-[300px]">
                        {status === 'CONNECTED' ? (
                            <div className="text-center">
                                <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-700">Conectado!</h3>
                                <p className="text-slate-500">O sistema está pronto para enviar alertas.</p>
                            </div>
                        ) : status === 'SCAN_QR' && qrCode ? (
                            <div className="text-center">
                                <p className="mb-4 text-slate-600 font-medium">Abra o WhatsApp  Aparelhos Conectados  Conectar Aparelho</p>
                                <img src={qrCode} alt="QR Code" className="w-64 h-64 mx-auto border-4 border-slate-200 rounded-lg" />
                                <p className="mt-4 text-sm text-slate-400 animate-pulse">Aguardando leitura...</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500">Iniciando serviço ou desconectado...</p>
                                <Button onClick={fetchStatus} variant="outline" className="mt-4">
                                    <RefreshCw className="mr-2 h-4 w-4"/> Atualizar
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Teste de Envio</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-500 mb-4">
                            Envie uma mensagem de teste para verificar se a integração está funcionando.
                        </p>
                        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 text-sm text-yellow-800">
                            <strong>Nota:</strong> Para configurar o grupo oficial de alertas, edite o ID do grupo diretamente no arquivo <code>monitorServices.js</code> no servidor.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}