import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, Box, CheckCircle, AlertOctagon, Monitor, Save, X, Filter, Search, FileSpreadsheet, FileText, AlertTriangle, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from 'axios';
import { generateExcel, generatePDF } from '@/utils/exportUtils';
import { API_URL } from '../config';

export default function Inventory({ userRole }) {
  const [items, setItems] = useState([]);
  
  const [filterType, setFilterType] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [itemToDelete, setItemToDelete] = useState(null); 

  const [formData, setFormData] = useState({
    type: 'Monitor', model: '', serial: '', status: 'disponivel', assigned_to: '', quantity: 1
  });

  // --- AUTENTICAÇÃO E CONFIG ---
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const INVENTORY_API = `${API_URL}/inventory`;

  // --- BUSCA DADOS ---
  useEffect(() => { fetchInventory(); }, []);
  
  const fetchInventory = async () => {
    try {
      const res = await axios.get(INVENTORY_API, getAuthHeaders()); 
      setItems(res.data);
    } catch (error) { 
        console.error("Erro ao buscar inventário:", error);
        if (error.response?.status === 401) {
            // Opcional: Redirecionar para login ou avisar
        }
    }
  };

  // --- FILTROS E ESTATÍSTICAS (RECUPERADOS) ---
  const filteredItems = items.filter(item => {
    const matchesType = filterType === 'Todos' || item.type === filterType;
    const matchesStatus = filterStatus === 'Todos' || item.status === filterStatus;
    const matchesSearch = item.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.serial && item.serial.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesStatus && matchesSearch;
  });

  const stats = {
    total: items.length,
    disponivel: items.filter(i => i.status === 'disponivel').length,
    em_uso: items.filter(i => i.status === 'em_uso').length,
    falta: items.filter(i => i.status === 'falta').length,
  };

  // --- EXPORTAÇÃO (RECUPERADOS) ---
  const handleExportExcel = () => {
    const dataToExport = filteredItems.map(item => ({
      'ID': item.id,
      'Tipo': item.type,
      'Modelo': item.model,
      'Serial': item.serial || 'N/A',
      'Status': item.status === 'disponivel' ? 'Disponível' : item.status === 'em_uso' ? 'Em Uso' : 'Defeito/Falta',
      'Local': item.assigned_to || 'Não atribuído',
      'Data Cadastro': new Date(item.created_at).toLocaleDateString('pt-BR')
    }));
    generateExcel(dataToExport, "Inventário Rede Fácil", `Inventario_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  };

  const handleExportPDF = () => {
    const tableColumns = ["Tipo", "Modelo", "Serial", "Status", "Local"];
    const tableRows = filteredItems.map(item => [
        item.type, item.model, item.serial || '-',
        item.status === 'disponivel' ? 'Disponível' : item.status === 'em_uso' ? 'Em Uso' : 'Defeito/Falta',
        item.assigned_to || '-'
    ]);
    generatePDF({
        title: "Rede Fácil - Relatório de Inventário",
        details: [`Gerado em: ${new Date().toLocaleDateString()}`, `Total de itens: ${filteredItems.length}`],
        columns: tableColumns, rows: tableRows,
        fileName: `Relatorio_Inventario_${new Date().toLocaleDateString().replace(/\//g, '-')}`,
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
                const text = data.cell.raw;
                if (text === 'Disponível') { data.cell.styles.textColor = [5, 150, 105]; data.cell.styles.fontStyle = 'bold'; } 
                else if (text === 'Defeito/Falta') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; } 
                else { data.cell.styles.textColor = [37, 99, 235]; }
            }
        }
    });
  };

  // --- AÇÕES DO FORMULÁRIO ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const startEdit = (item) => {
    setFormData({ 
        type: item.type, model: item.model, serial: item.serial, 
        status: item.status, assigned_to: item.assigned_to,
        quantity: 1 
    });
    setEditingId(item.id);
    setIsFormOpen(true);
  };

  const requestDelete = (id) => { setItemToDelete(id); };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ type: 'Monitor', model: '', serial: '', status: 'disponivel', assigned_to: '', quantity: 1 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
          ...formData, 
          assigned_to: formData.assigned_to || '',
          quantity: parseInt(formData.quantity) 
      };

      if (editingId) {
        await axios.put(`${INVENTORY_API}/${editingId}`, payload, getAuthHeaders());
      } else {
        await axios.post(INVENTORY_API, payload, getAuthHeaders());
      }
      fetchInventory(); 
      closeForm();
    } catch (error) { alert("Erro ao salvar."); console.error(error); }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try { 
          await axios.delete(`${INVENTORY_API}/${itemToDelete}`, getAuthHeaders()); 
          fetchInventory(); 
          setItemToDelete(null); 
      } 
      catch (error) { console.error("Erro ao deletar:", error); alert("Erro ao excluir item."); }
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'disponivel': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Disponível</Badge>;
      case 'em_uso': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Em Uso</Badge>;
      case 'falta': return <Badge className="bg-red-100 text-red-700 border-red-200">Defeito/Falta</Badge>;
      default: return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* STATS CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Itens</CardTitle>
            <Box className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-slate-800">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">Disponíveis</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-700">{stats.disponivel}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Em Uso</CardTitle>
            <Monitor className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-700">{stats.em_uso}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Faltando/Defeito</CardTitle>
            <AlertOctagon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-700">{stats.falta}</div></CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-slate-800">Inventário de Equipamentos</CardTitle>
            
            <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" onClick={handleExportExcel} className="flex-1 md:flex-none gap-2 text-green-700 border-green-200 hover:bg-green-50">
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
                <Button variant="outline" onClick={handleExportPDF} className="flex-1 md:flex-none gap-2 text-red-700 border-red-200 hover:bg-red-50">
                    <FileText className="h-4 w-4" /> PDF
                </Button>
                {userRole === 'admin' && (
                  <Button onClick={() => setIsFormOpen(true)} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-md gap-2">
                      <Plus className="h-4 w-4" /> Novo
                  </Button>
                )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
             <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Tipo:</span>
                <select className="bg-white border border-slate-300 text-slate-700 text-sm rounded-md p-2 outline-none" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Monitor">Monitor</option><option value="Mouse">Mouse</option><option value="Teclado">Teclado</option><option value="Computador">Computador</option><option value="Mousepad">Mousepad</option><option value="Câmera">Câmera</option><option value="Headset">Headset</option><option value="Outro">Outro</option>
                </select>
             </div>

             <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Status:</span>
                <select className="bg-white border border-slate-300 text-slate-700 text-sm rounded-md p-2 outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="Todos">Todos</option><option value="disponivel">Disponível</option><option value="em_uso">Em Uso</option><option value="falta">Defeito/Falta</option>
                </select>
             </div>

             <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Search className="w-4 h-4 text-slate-400" /></div>
                <input type="text" className="block w-full p-2 pl-10 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white outline-none" placeholder="Buscar modelo ou serial..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
          </div>
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[150px] font-semibold text-slate-700">Tipo</TableHead>
                <TableHead className="font-semibold text-slate-700">Modelo/Marca</TableHead>
                <TableHead className="font-semibold text-slate-700">Serial</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700">Local / Usuário</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-medium text-slate-900">{item.type}</TableCell>
                  <TableCell className="text-slate-700">{item.model}</TableCell>
                  <TableCell className="text-slate-500 font-mono text-xs">{item.serial || '-'}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-slate-700">{item.assigned_to || '-'}</TableCell>
                  <TableCell className="text-right">
                    {userRole === 'admin' ? (
                      <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(item)} className="h-8 w-8 p-0 text-blue-600 border-blue-200"><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => requestDelete(item.id)} className="h-8 w-8 p-0 text-red-600 border-red-200"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ) : (<span className="text-xs text-slate-400 italic">Visualizar</span>)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500"><p>Nenhum item encontrado.</p></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* --- MODAL DE CADASTRO/EDIÇÃO --- */}
      {isFormOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          
          <Card className="relative z-10 w-full max-w-md animate-in zoom-in-95 duration-200 shadow-2xl bg-white border-none">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 bg-white rounded-t-lg">
                <CardTitle className="text-slate-800 text-xl">{editingId ? 'Editar' : 'Cadastrar'}</CardTitle>
                <button onClick={closeForm} className="text-slate-400 hover:text-slate-600 p-1 rounded-full"><X className="h-5 w-5" /></button>
            </CardHeader>
            <CardContent className="pt-6 bg-white rounded-b-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!editingId && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-4">
                        <label className="block text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
                           <Layers className="h-4 w-4" /> Quantidade
                        </label>
                        <input 
                          type="number" 
                          name="quantity" 
                          min="1" 
                          value={formData.quantity} 
                          onChange={handleInputChange} 
                          className="w-full rounded-md border border-blue-200 bg-white text-slate-900 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                        <p className="text-[11px] text-blue-600 mt-1">Cria várias cópias deste item de uma vez.</p>
                      </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo</label>
                        <select name="type" value={formData.type} onChange={handleInputChange} className="w-full rounded-md border border-slate-300 bg-white text-slate-900 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="Monitor">Monitor</option><option value="Mouse">Mouse</option><option value="Teclado">Teclado</option><option value="Computador">Computador</option><option value="Mousepad">Mousepad</option><option value="Câmera">Câmera</option><option value="Headset">Headset</option><option value="Outro">Outro</option>
                        </select>
                    </div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Modelo</label><input type="text" name="model" value={formData.model} onChange={handleInputChange} required className="w-full rounded-md border border-slate-300 bg-white text-slate-900 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Serial</label>
                          <input 
                            type="text" 
                            name="serial" 
                            value={formData.serial} 
                            onChange={handleInputChange} 
                            disabled={formData.quantity > 1} 
                            placeholder={formData.quantity > 1 ? "Bloqueado (Lote)" : ""}
                            className="w-full rounded-md border border-slate-300 bg-white text-slate-900 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400" 
                          />
                        </div>
                        <div><label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                        <select name="status" value={formData.status} onChange={handleInputChange} className="w-full rounded-md border border-slate-300 bg-white text-slate-900 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="disponivel">Disponível</option><option value="em_uso">Em Uso</option><option value="falta">Defeito/Falta</option>
                        </select></div>
                    </div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Local</label><input type="text" name="assigned_to" value={formData.assigned_to} onChange={handleInputChange} className="w-full rounded-md border border-slate-300 bg-white text-slate-900 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                      <Button type="button" variant="outline" onClick={closeForm} className="bg-white text-slate-700 border-slate-300">Cancelar</Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm">
                        <Save className="mr-2 h-4 w-4" /> 
                        {formData.quantity > 1 ? `Criar ${formData.quantity} Itens` : 'Salvar'}
                      </Button>
                    </div>
                </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {itemToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setItemToDelete(null)} />
          <Card className="relative z-10 w-full max-w-sm bg-white shadow-2xl animate-in zoom-in-95 duration-200 border-none p-0 overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja remover este item permanentemente? <br/>Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setItemToDelete(null)} className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50">Cancelar</Button>
                <Button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-sm">Sim, Excluir</Button>
              </div>
            </div>
            <div className="h-1 w-full bg-red-100"><div className="h-full w-full bg-red-500/20" /></div>
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}