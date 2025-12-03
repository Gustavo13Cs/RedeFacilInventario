import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Box, CheckCircle, AlertOctagon, Monitor, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


import axios from 'axios';

export default function Inventory() {
  const [items, setItems] = useState([]); 
  const API_URL = "http://localhost:3001/api/inventory";

  useEffect(() => {
    fetchInventory();
  }, []);
  
  const fetchInventory = async () => {
    try {
      const res = await axios.get(API_URL);
      setItems(res.data);
    } catch (error) {
      console.error("Erro ao buscar inventário:", error);
    }
  };


  const stats = {
    total: items.length,
    disponivel: items.filter(i => i.status === 'disponivel').length,
    em_uso: items.filter(i => i.status === 'em_uso').length,
    falta: items.filter(i => i.status === 'falta').length,
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, formData);
      } else {
        await axios.post(API_URL, formData);
      }
      fetchInventory(); 
      closeForm();
    } catch (error) {
      alert("Erro ao salvar. Verifique o console.");
      console.error(error);
    }
  };

  const startEdit = (item) => {
    setFormData(item);
    setEditingId(item.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir este equipamento?')) {
      try {
        await axios.delete(`${API_URL}/${id}`);
        fetchInventory(); // Recarrega a lista
      } catch (error) {
        console.error("Erro ao deletar:", error);
      }
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ type: 'Monitor', model: '', serial: '', status: 'disponivel', assignedTo: '' });
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'disponivel': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Disponível</Badge>;
      case 'em_uso': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">Em Uso</Badge>;
      case 'falta': return <Badge variant="destructive">Faltando/Defeito</Badge>;
      default: return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER E ESTATÍSTICAS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Itens</CardTitle>
            <Box className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
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

      {/* AÇÕES E TABELA */}
      <Card className="border-slate-200">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-slate-800">Inventário de Periféricos e Hardware</CardTitle>
          <Button onClick={() => setIsFormOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="h-4 w-4" /> Novo Equipamento
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Tipo</TableHead>
                <TableHead>Modelo/Marca</TableHead>
                <TableHead>Serial / ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Local / Usuário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-slate-700">{item.type}</TableCell>
                  <TableCell>{item.model}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{item.serial}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>{item.assignedTo || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                      <Edit2 className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Nenhum equipamento cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL / FORMULÁRIO (Overlay Simples) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Editar Equipamento' : 'Cadastrar Equipamento'}</h3>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Equipamento</label>
                <select 
                  name="type" 
                  value={formData.type} 
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Monitor">Monitor</option>
                  <option value="Mouse">Mouse</option>
                  <option value="Teclado">Teclado</option>
                  <option value="Computador">Computador / Gabinete</option>
                  <option value="Mousepad">Mousepad</option>
                  <option value="Câmera">Câmera / Webcam</option>
                  <option value="Headset">Headset / Fone</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo / Marca</label>
                <input 
                  type="text" 
                  name="model" 
                  value={formData.model} 
                  onChange={handleInputChange}
                  placeholder="Ex: Dell P2419H"
                  required
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Serial (Opcional)</label>
                  <input 
                    type="text" 
                    name="serial" 
                    value={formData.serial} 
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                   <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="em_uso">Em Uso</option>
                    <option value="falta">Faltando / Quebrado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Local / Quem está usando?</label>
                <input 
                  type="text" 
                  name="assignedTo" 
                  value={formData.assignedTo} 
                  onChange={handleInputChange}
                  placeholder="Ex: Recepção, João, Estoque..."
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}