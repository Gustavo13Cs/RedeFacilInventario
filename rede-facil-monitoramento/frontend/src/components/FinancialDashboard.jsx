import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Save, TrendingUp, Package, RefreshCw, AlertCircle, X } from 'lucide-react';
import axios from 'axios';

import { API_URL as ConfigURL } from '../config';

const API_BASE = ConfigURL || "http://localhost:3001/api";

export default function FinancialDashboard() {
  const [data, setData] = useState({ assets: [], grandTotal: 0, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [editingModel, setEditingModel] = useState(null);
  const [tempPrice, setTempPrice] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const getAuthHeader = () => {
      const token = localStorage.getItem('token');
      return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/financial/report`, getAuthHeader());
      
      if (res.data && Array.isArray(res.data.assets)) {
          setData(res.data);
      } else {
          setData({ assets: [], grandTotal: 0, totalItems: 0 });
      }
    } catch (error) {
      console.error("Erro ao buscar financeiro:", error);
      if (error.response?.status === 404) {
          setError("Erro 404: Rota não encontrada. Verifique se o Back-end está rodando.");
      } else if (error.response?.status === 500) {
          setError("Erro 500: Tabela 'asset_catalog' não criada no banco.");
      } else {
          setError("Não foi possível carregar os dados.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (asset) => {
      setEditingModel(asset.model);
      setTempPrice(asset.unit_price);
  };

  const handleSavePrice = async (asset) => {
      try {
          await axios.post(`${API_BASE}/financial/price`, {
              model: asset.model,
              price: tempPrice,
              category: asset.type
          }, getAuthHeader());
          setEditingModel(null);
          fetchData(); 
      } catch (error) {
          alert("Erro ao salvar preço");
      }
  };

  const formatCurrency = (val) => {
      const number = Number(val) || 0;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
  };

  if (loading) return <div className="p-8 text-center text-slate-500 flex flex-col items-center"><RefreshCw className="h-8 w-8 animate-spin mb-2"/>Carregando patrimônio...</div>;
  
  if (error) return (
    <div className="p-8 flex flex-col items-center justify-center text-red-500">
        <AlertCircle className="h-10 w-10 mb-2" />
        <h3 className="text-lg font-bold">Ocorreu um problema</h3>
        <p className="mb-4">{error}</p>
        <Button onClick={fetchData} variant="outline">Tentar Novamente</Button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* CARDS DE TOTALIZAÇÃO */}
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-emerald-700 text-sm font-bold flex items-center gap-2"><DollarSign className="h-4 w-4"/> Valor Patrimonial Total</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-emerald-800">{formatCurrency(data.grandTotal)}</div>
                    <p className="text-xs text-emerald-600">Soma de todos os ativos</p>
                </CardContent>
            </Card>
            
            <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-slate-600 text-sm font-bold flex items-center gap-2"><Package className="h-4 w-4"/> Total de Itens</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-800">{data.totalItems}</div>
                    <p className="text-xs text-slate-500">Equipamentos contabilizados</p>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-blue-600 text-sm font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4"/> Ticket Médio</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-blue-800">
                        {data.totalItems > 0 ? formatCurrency(data.grandTotal / data.totalItems) : 'R$ 0,00'}
                    </div>
                    <p className="text-xs text-blue-600">Valor médio por item</p>
                </CardContent>
            </Card>
        </div>

        {/* TABELA DE PRECIFICAÇÃO */}
        <Card className="shadow-md border-slate-200">
            <CardHeader className="bg-slate-50 border-b flex flex-row justify-between items-center py-4">
                <div>
                    <CardTitle className="text-lg text-slate-800">Catálogo de Ativos e Preços</CardTitle>
                    <p className="text-sm text-slate-500">Gerencie o valor unitário dos seus equipamentos.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="gap-2"><RefreshCw className="h-4 w-4"/> Atualizar Lista</Button>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead>Modelo / Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead className="text-right">Valor Unit. (R$)</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.assets.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400">Nenhum ativo encontrado no banco de dados.</TableCell></TableRow>
                        ) : (
                            data.assets.map((asset, idx) => (
                                <TableRow key={idx} className={`hover:bg-slate-50 transition-colors ${asset.unit_price === 0 ? "bg-red-50/30" : ""}`}>
                                    <TableCell className="font-medium text-slate-700">
                                        {asset.model || "Desconhecido"}
                                        {asset.unit_price === 0 && <Badge variant="destructive" className="ml-2 text-[10px] h-5 px-1.5">Sem Preço</Badge>}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-slate-500 font-normal">{asset.type}</Badge>
                                        {asset.source && asset.source.includes('Agente') && <span className="text-[9px] text-blue-400 ml-1 block">via Agente</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-slate-700">{asset.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        {editingModel === asset.model ? (
                                            <input 
                                                type="number" 
                                                className="w-24 p-1.5 text-sm border border-blue-400 rounded text-right outline-none focus:ring-2 focus:ring-blue-200" 
                                                value={tempPrice} 
                                                onChange={e => setTempPrice(e.target.value)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className={asset.unit_price > 0 ? "text-slate-700 font-mono" : "text-slate-400 italic"}>
                                                {formatCurrency(asset.unit_price)}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-emerald-700 font-mono">
                                        {asset.unit_price > 0 ? formatCurrency(asset.total_value) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {editingModel === asset.model ? (
                                            <div className="flex gap-1 justify-end">
                                                <Button size="icon" onClick={() => handleSavePrice(asset)} className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white"><Save className="h-4 w-4"/></Button>
                                                <Button size="icon" variant="ghost" onClick={() => setEditingModel(null)} className="h-8 w-8 text-slate-500"><X className="h-4 w-4"/></Button>
                                            </div>
                                        ) : (
                                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(asset)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-xs">
                                                Editar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}