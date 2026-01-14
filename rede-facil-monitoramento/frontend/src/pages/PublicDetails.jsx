import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

// Importa os visuais que estão na pasta components
import { MachineView, DeviceView, ItemView } from '../components/public-view/Templates';

export default function PublicDetails() {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                
                if (!token) {
                    navigate('/login', { state: { from: location.pathname } });
                    return;
                }

                let url = '';
                if (type === 'machine') url = `${API_URL}/machines`;
                else if (type === 'device') url = `${API_URL}/devices`;
                else if (type === 'item') url = `${API_URL}/inventory?limit=10000`;

                const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
                const list = res.data.data || res.data;
                
                let found = null;
                // Ajuste para comparar IDs numéricos ou strings (UUID)
                const compareId = isNaN(id) ? id : Number(id);

                if (type === 'machine') {
                     found = list.find(m => m.uuid === id || m.hostname === id);
                } else {
                     found = list.find(i => i.id === compareId);
                }

                if (!found) setError("Item não encontrado na base de dados.");
                setData(found);

            } catch (error) {
                console.error("Erro:", error);
                setError("Erro ao carregar informações.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [type, id, navigate, location]);

    if (loading) return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50 p-6">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-600 font-medium animate-pulse">Carregando...</p>
        </div>
    );
    
    if (error || !data) return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-slate-50 p-6 text-center">
            <div className="bg-red-100 p-4 rounded-full mb-4">
                <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">{error || "Item não encontrado"}</h2>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full max-w-xs gap-2 mt-4">
                <ArrowLeft className="w-4 h-4" /> Voltar ao Início
            </Button>
        </div>
    );

    // Seleciona qual template exibir
    if (type === 'machine') return <MachineView data={data} />;
    if (type === 'device') return <DeviceView data={data} />;
    return <ItemView data={data} />;
}