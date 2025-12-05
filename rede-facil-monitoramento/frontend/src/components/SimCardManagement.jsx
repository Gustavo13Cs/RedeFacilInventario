import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, Smartphone, Signal, Ban, CheckCircle, SmartphoneNfc, Save, X, Search, Filter, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from 'axios';

export default function SimCardManagement({ userRole }) {
  const [chips, setChips] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [chipToDelete, setChipToDelete] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  
  const [formData, setFormData] = useState({
    phone_number: '',
    carrier: 'Vivo',
    status: 'livre',
    device_id: '',
    notes: ''
  });

  const API_URL = "http://localhost:3001/api/chips";

  useEffect(() => { fetchChips(); }, []);

  const fetchChips = async () => {
    try {
      const res = await axios.get(API_URL);
      setChips(res.data);
    } catch (error) { console.error("Erro ao buscar chips:", error); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, formData);
      else await axios.post(API_URL, formData);
      fetchChips();
      closeForm();
    } catch (error) { alert("Erro ao salvar."); }
  };

  const startEdit = (item) => {
    setFormData(item);
    setEditingId(item.id);
    setIsFormOpen(true);
  };

  const requestDelete = (id) => {
    setChipToDelete(id);
  };

  const confirmDelete = async () => {
    if (chipToDelete) {
      try {
        await axios.delete(`${API_URL}/${chipToDelete}`);
        fetchChips();
        setChipToDelete(null); 
      } catch (error) {
        alert("Erro ao deletar chip.");
      }
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ phone_number: '', carrier: 'Vivo', status: 'livre', device_id: '', notes: '' });
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'livre': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Livre / Disponível</Badge>;
      case 'uso': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Em Uso (WhatsApp)</Badge>;
      case 'restrito': return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Restrito (Temp)</Badge>;
      case 'banido': return <Badge className="bg-red-100 text-red-700 border-red-200">Banido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredChips = chips.filter(c => {
    const matchesSearch = c.phone_number.includes(searchTerm) || 
                          (c.device_id && c.device_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCarrier = filterCarrier === 'Todas' || c.carrier === filterCarrier;
    const matchesStatus = filterStatus === 'Todos' || c.status === filterStatus;

    return matchesSearch && matchesCarrier && matchesStatus;
  });

  const stats = {
    total: chips.length,
    uso: chips.filter(c => c.status === 'uso').length,
    banidos: chips.filter(c => c.status === 'banido').length,
    livres: chips.filter(c => c.status === 'livre').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* CARDS DE RESUMO */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-500">Total de Chips</CardTitle>
                <Smartphone className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-slate-800">{stats.total}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-blue-600">Em Operação</CardTitle>
                <Signal className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-700">{stats.uso}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-emerald-600">Disponíveis</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-700">{stats.livres}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-red-600">Banidos/Perdidos</CardTitle>
                <Ban className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-700">{stats.banidos}</div></CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        
        {/* CABEÇALHO + BOTÃO NOVO */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h3 className="text-lg font-bold text-slate-800">Controle de Chips e WhatsApp</h3>
                <p className="text-sm text-slate-500">Gerencie os números do comercial e status de bloqueio.</p>
            </div>
            {userRole === 'admin' && (
                <Button onClick={() => setIsFormOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md">
                    <Plus className="h-4 w-4" /> Novo Chip
                </Button>
            )}
        </div>

        {/* BARRA DE FILTROS */}
        <div className="px-6 pb-6">
            <div className="flex flex-col md:flex-row gap-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100 mt-4">
                
                {/* Filtro Operadora */}
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-600">Operadora:</span>
                    <select 
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                        value={filterCarrier}
                        onChange={(e) => setFilterCarrier(e.target.value)}
                    >
                        <option value="Todas">Todas</option>
                        <option value="Vivo">Vivo</option>
                        <option value="Tim">Tim</option>
                        <option value="Claro">Claro</option>
                        <option value="Oi">Oi</option>
                        <option value="Outra">Outra</option>
                    </select>
                </div>

                {/* Filtro Status */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600">Status:</span>
                    <select 
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="Todos">Todos</option>
                        <option value="livre">Livre / Disp.</option>
                        <option value="uso">Em Uso</option>
                        <option value="restrito">Restrito (Temp)</option>
                        <option value="banido">Banido</option>
                    </select>
                </div>

                {/* Busca Rápida */}
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input 
                        type="text" 
                        className="block w-full p-2 pl-10 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 outline-none" 
                        placeholder="Buscar número ou identificação do celular..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </div>

        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead>Número</TableHead>
                        <TableHead>Operadora</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Celular Identificado</TableHead>
                        <TableHead>Observações</TableHead>
                        {userRole === 'admin' && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredChips.map((chip) => (
                        <TableRow key={chip.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-mono font-medium text-slate-700">{chip.phone_number}</TableCell>
                            <TableCell>{chip.carrier}</TableCell>
                            <TableCell>{getStatusBadge(chip.status)}</TableCell>
                            <TableCell className="font-semibold text-slate-700">
                                {chip.device_id ? (
                                    <div className="flex items-center gap-2">
                                        <SmartphoneNfc className="h-4 w-4 text-slate-400" />
                                        {chip.device_id}
                                    </div>
                                ) : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-[200px] truncate" title={chip.notes}>{chip.notes || '-'}</TableCell>
                            
                            {userRole === 'admin' && (
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => startEdit(chip)} className="h-8 w-8 p-0 text-blue-600 border-blue-200">
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => requestDelete(chip.id)} className="h-8 w-8 p-0 text-red-600 border-red-200">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                    {filteredChips.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                                <Search className="w-8 h-8 text-slate-300" />
                                <p>Nenhum chip encontrado com esses filtros.</p>
                            </div>
                        </TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      {/* MODAL DE CADASTRO */}
      {isFormOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
            <Card className="relative z-10 w-full max-w-md animate-in zoom-in-95 bg-white shadow-2xl">
                <CardHeader className="border-b pb-4 bg-white rounded-t-lg flex flex-row justify-between items-center">
                    <CardTitle className="text-slate-800">{editingId ? 'Editar Chip' : 'Novo Chip'}</CardTitle>
                    <button onClick={closeForm} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                </CardHeader>
                <CardContent className="pt-6 bg-white rounded-b-lg">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Número do Chip</label>
                            <input 
                                type="text" name="phone_number" required placeholder="(XX) 9XXXX-XXXX"
                                value={formData.phone_number} onChange={handleInputChange}
                                className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Operadora</label>
                                <select name="carrier" value={formData.carrier} onChange={handleInputChange} className="w-full border border-slate-300 rounded-md p-2.5 outline-none bg-white">
                                    <option>Vivo</option><option>Tim</option><option>Claro</option><option>Oi</option><option>Outra</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Status Atual</label>
                                <select name="status" value={formData.status} onChange={handleInputChange} className="w-full border border-slate-300 rounded-md p-2.5 outline-none bg-white">
                                    <option value="livre">Livre / Disp.</option>
                                    <option value="uso">Em Uso</option>
                                    <option value="restrito">Restrito (Temp)</option>
                                    <option value="banido">Banido</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Identificação do Celular</label>
                            <input 
                                type="text" name="device_id" placeholder="Ex: Celular 101, Celular Reserva..."
                                value={formData.device_id} onChange={handleInputChange}
                                className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-400 mt-1">Identifique em qual aparelho físico este chip está.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Observações</label>
                            <textarea 
                                name="notes" placeholder="Ex: Banido dia 05/12, aguardando revisão..."
                                value={formData.notes} onChange={handleInputChange}
                                className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                            <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm"><Save className="h-4 w-4" /> Salvar</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>, document.body
      )}

      {/* MODAL */}
      {chipToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setChipToDelete(null)}
          />
          <Card className="relative z-10 w-full max-w-sm bg-white shadow-2xl animate-in zoom-in-95 duration-200 border-none p-0 overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Excluir Chip?
              </h3>
              
              <p className="text-sm text-slate-500 mb-6">
                Tem certeza que deseja remover este chip do sistema? <br/>
                Essa ação não pode ser desfeita.
              </p>

              <div className="flex gap-3 w-full">
                <Button 
                  variant="outline" 
                  onClick={() => setChipToDelete(null)}
                  className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-sm font-medium"
                >
                  Sim, Excluir
                </Button>
              </div>
            </div>
            
            <div className="h-1 w-full bg-red-100">
               <div className="h-full w-full bg-red-500/20" />
            </div>
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}