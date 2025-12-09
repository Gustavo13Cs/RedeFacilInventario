import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
// IMPORTAÇÃO 100% SEGURA (Apenas ícones básicos)
import { Plus, Trash2, Edit2, Smartphone, Save, X, Search, Filter, AlertTriangle, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from 'axios';

export default function SimCardManagement({ userRole }) {
  const [activeTab, setActiveTab] = useState('general'); 
  const [chips, setChips] = useState([]);
  const [devices, setDevices] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({}); 

  const [deleteData, setDeleteData] = useState(null); 

  // --- FILTROS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');

  const [searchDevice, setSearchDevice] = useState('');
  const [filterDeviceStatus, setFilterDeviceStatus] = useState('Todos');

  const [searchEmployee, setSearchEmployee] = useState('');

  const API_URL = "http://localhost:3001/api/chips";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
        const [resChips, resDevices, resEmp] = await Promise.all([
            axios.get(API_URL),
            axios.get(`${API_URL}/devices`),
            axios.get(`${API_URL}/employees`)
        ]);
        setChips(Array.isArray(resChips.data) ? resChips.data : []);
        setDevices(Array.isArray(resDevices.data) ? resDevices.data : []);
        setEmployees(Array.isArray(resEmp.data) ? resEmp.data : []);
    } catch (error) { 
        console.error("Erro ao carregar dados", error);
        setChips([]); setDevices([]); setEmployees([]);
    }
  };

  const handleOpenModal = (type, item = null) => {
    setEditingItem(item);
    if (type === 'general') {
        setFormData(item || { phone_number: '', carrier: 'Vivo', status: 'livre', device_link_id: '', employee_link_id: '', notes: '' });
    } else if (type === 'devices') {
        setFormData(item || { name: '', model: '', status: 'ativo' });
    } else if (type === 'people') {
        setFormData(item || { name: '', department: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
        if (activeTab === 'general') {
            const payload = {
                ...formData,
                device_link_id: formData.device_link_id || null,
                employee_link_id: formData.employee_link_id || null
            };
            if (editingItem) await axios.put(`${API_URL}/${editingItem.id}`, payload);
            else await axios.post(API_URL, payload);
        } else if (activeTab === 'devices') {
            if (!editingItem) await axios.post(`${API_URL}/devices`, formData);
        } else if (activeTab === 'people') {
            if (editingItem) await axios.put(`${API_URL}/employees/${editingItem.id}`, formData);
            else await axios.post(`${API_URL}/employees`, formData);
        }
        fetchData();
        setIsModalOpen(false);
    } catch (error) { 
        alert("Erro ao salvar. Verifique os dados."); 
        console.error(error);
    }
  };

  const requestDelete = (id, type) => {
      setDeleteData({ id, type });
  };

  const confirmDelete = async () => {
    if (!deleteData) return;
    try {
        if (deleteData.type === 'general') await axios.delete(`${API_URL}/${deleteData.id}`);
        if (deleteData.type === 'devices') await axios.delete(`${API_URL}/devices/${deleteData.id}`);
        if (deleteData.type === 'people') await axios.delete(`${API_URL}/employees/${deleteData.id}`);
        fetchData();
        setDeleteData(null);
    } catch (error) { alert("Erro ao deletar (Pode estar em uso)."); }
  };

  const getAvailableOptions = () => {
      const safeChips = chips || []; 
      const usedDeviceIds = safeChips.filter(c => c.id !== editingItem?.id).map(c => c.device_link_id).filter(Boolean);
      const usedEmployeeIds = safeChips.filter(c => c.id !== editingItem?.id).map(c => c.employee_link_id).filter(Boolean);
      const availableDevices = (devices || []).filter(d => !usedDeviceIds.includes(d.id));
      const availableEmployees = (employees || []).filter(e => !usedEmployeeIds.includes(e.id));
      return { availableDevices, availableEmployees };
  };

  const { availableDevices, availableEmployees } = getAvailableOptions();

  // --- FILTROS ---
  
  const filteredChips = (chips || []).filter(c => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
        (c.phone_number || '').toLowerCase().includes(search) || 
        (c.device_name || '').toLowerCase().includes(search) ||
        (c.employee_name || '').toLowerCase().includes(search) ||
        (c.status || '').toLowerCase().includes(search);
    
    const matchesCarrier = filterCarrier === 'Todas' || c.carrier === filterCarrier;
    const matchesStatus = filterStatus === 'Todos' || c.status === filterStatus;
    return matchesSearch && matchesCarrier && matchesStatus;
  });

  const filteredDevices = (devices || []).filter(d => {
    const search = searchDevice.toLowerCase();
    const matchesSearch = 
        (d.name || '').toLowerCase().includes(search) ||
        (d.model || '').toLowerCase().includes(search);
    const matchesStatus = filterDeviceStatus === 'Todos' || d.status === filterDeviceStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredEmployees = (employees || []).filter(e => 
    (e.name || '').toLowerCase().includes(searchEmployee.toLowerCase()) ||
    (e.department || '').toLowerCase().includes(searchEmployee.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch(status) {
      // Chips
      case 'livre': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Livre</Badge>;
      case 'uso': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Em Uso</Badge>;
      case 'banido': return <Badge className="bg-red-100 text-red-700 border-red-200">Banido</Badge>;
      // Aparelhos (Agora correto!)
      case 'ativo': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Ativo</Badge>;
      case 'manutencao': return <Badge className="bg-orange-50 text-orange-700 border-orange-200">Manutenção</Badge>;
      case 'quebrado': return <Badge className="bg-red-50 text-red-700 border-red-200">Quebrado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // --- RENDERIZADORES ---

  const renderGeneralTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50 flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <select className="bg-white border rounded text-sm p-1 outline-none" value={filterCarrier} onChange={e => setFilterCarrier(e.target.value)}>
                    <option value="Todas">Todas Op.</option><option>Vivo</option><option>Tim</option><option>Claro</option>
                </select>
                <select className="bg-white border rounded text-sm p-1 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="Todos">Todos Status</option><option value="livre">Livre</option><option value="uso">Em Uso</option><option value="banido">Banido</option>
                </select>
            </div>
            <div className="flex-1 relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                <input className="w-full pl-8 p-1.5 text-sm border rounded outline-none" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50"><TableHead>Número</TableHead><TableHead>Operadora</TableHead><TableHead>Status</TableHead><TableHead>Aparelho</TableHead><TableHead>Responsável</TableHead><TableHead className="text-right">Ações</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                    {filteredChips.map(chip => (
                        <TableRow key={chip.id}>
                            <TableCell className="font-mono font-medium">{chip.phone_number}</TableCell>
                            <TableCell>{chip.carrier}</TableCell>
                            <TableCell>{getStatusBadge(chip.status)}</TableCell>
                            <TableCell className="text-slate-600 flex items-center gap-2">
                                {chip.device_name ? <><Smartphone className="h-3 w-3"/> {chip.device_name}</> : '-'}
                            </TableCell>
                            <TableCell className="text-slate-600">
                                {chip.employee_name ? <><User className="h-3 w-3 inline mr-1"/> {chip.employee_name}</> : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                                {userRole === 'admin' && (
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal('general', chip)}><Edit2 className="h-4 w-4 text-blue-600"/></Button>
                                        <Button variant="ghost" size="sm" onClick={() => requestDelete(chip.id, 'general')}><Trash2 className="h-4 w-4 text-red-600"/></Button>
                                    </div>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {filteredChips.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Nenhum registro encontrado.</TableCell></TableRow>}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );

  const renderDevicesTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50 flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Status:</span>
                <select className="bg-white border rounded text-sm p-1 outline-none" value={filterDeviceStatus} onChange={e => setFilterDeviceStatus(e.target.value)}>
                    <option value="Todos">Todos</option>
                    <option value="ativo">Ativo</option>
                    <option value="manutencao">Manutenção</option>
                    <option value="quebrado">Quebrado</option>
                </select>
            </div>
            <div className="flex-1 relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                <input className="w-full pl-8 p-1.5 text-sm border rounded outline-none" placeholder="Buscar celular..." value={searchDevice} onChange={e => setSearchDevice(e.target.value)} />
            </div>
        </div>
        <CardContent className="p-0">
            <Table>
                <TableHeader><TableRow className="bg-slate-50"><TableHead>Identificação</TableHead><TableHead>Modelo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                    {filteredDevices.map(dev => (
                        <TableRow key={dev.id}>
                            <TableCell className="font-bold flex items-center gap-2"><Smartphone className="h-4 w-4 text-slate-400"/> {dev.name}</TableCell>
                            <TableCell>{dev.model}</TableCell>
                            <TableCell>{getStatusBadge(dev.status)}</TableCell>
                            <TableCell className="text-right">
                                {userRole === 'admin' && <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => handleOpenModal('devices', dev)}><Edit2 className="h-4 w-4 text-blue-600"/></Button><Button variant="ghost" size="sm" onClick={() => requestDelete(dev.id, 'devices')}><Trash2 className="h-4 w-4 text-red-600"/></Button></div>}
                            </TableCell>
                        </TableRow>
                    ))}
                    {filteredDevices.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Nenhum aparelho encontrado.</TableCell></TableRow>}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );

  const renderPeopleTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50">
            <div className="relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                <input className="w-full pl-8 p-1.5 text-sm border rounded outline-none bg-white" placeholder="Buscar pessoa..." value={searchEmployee} onChange={e => setSearchEmployee(e.target.value)} />
            </div>
        </div>
        <CardContent className="p-0">
            <Table>
                <TableHeader><TableRow className="bg-slate-50"><TableHead>Nome</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                    {filteredEmployees.map(emp => (
                        <TableRow key={emp.id}>
                            <TableCell className="font-medium flex items-center gap-2"><User className="h-4 w-4 text-slate-400"/> {emp.name}</TableCell>
                            <TableCell><Badge variant="secondary">{emp.department}</Badge></TableCell>
                            <TableCell className="text-right">
                                {userRole === 'admin' && (
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal('people', emp)}><Edit2 className="h-4 w-4 text-blue-600"/></Button>
                                        <Button variant="ghost" size="sm" onClick={() => requestDelete(emp.id, 'people')}><Trash2 className="h-4 w-4 text-red-600"/></Button>
                                    </div>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {filteredEmployees.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-400">Nenhum colaborador encontrado.</TableCell></TableRow>}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('general')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'general' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Smartphone className="w-4 h-4 mr-2"/> Gestão de Vínculos
            </button>
            <button onClick={() => setActiveTab('devices')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'devices' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Smartphone className="w-4 h-4 mr-2"/> Celulares
            </button>
            <button onClick={() => setActiveTab('people')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'people' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <User className="w-4 h-4 mr-2"/> Pessoas
            </button>
        </div>
        
        {userRole === 'admin' && (
            <Button onClick={() => handleOpenModal(activeTab)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md">
                <Plus className="h-4 w-4" /> 
                {activeTab === 'general' ? 'Novo Vínculo' : activeTab === 'devices' ? 'Cadastrar Celular' : 'Cadastrar Pessoa'}
            </Button>
        )}
      </div>

      {activeTab === 'general' && renderGeneralTab()}
      {activeTab === 'devices' && renderDevicesTab()}
      {activeTab === 'people' && renderPeopleTab()}

      {/* MODAL DE CADASTRO */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-md bg-white shadow-2xl p-6">
                <div className="flex justify-between mb-4">
                    <CardTitle className="text-lg text-slate-800">
                        {activeTab === 'general' ? 'Configurar Vínculo' : activeTab === 'devices' ? 'Gerenciar Celular' : 'Gerenciar Colaborador'}
                    </CardTitle>
                    <button onClick={() => setIsModalOpen(false)}><X className="h-5 w-5 text-slate-400 hover:text-slate-600"/></button>
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                    
                    {activeTab === 'devices' && (
                        <>
                            <div><label className="text-sm font-bold">ID (Ex: Celular 101)</label><input className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                            <div><label className="text-sm font-bold">Modelo</label><input className="w-full border p-2 rounded" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} /></div>
                            <div>
                                <label className="text-sm font-bold text-slate-700">Status</label>
                                <select className="w-full border p-2 rounded bg-white" value={formData.status || 'ativo'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                    <option value="ativo">Ativo</option>
                                    <option value="manutencao">Manutenção</option>
                                    <option value="quebrado">Quebrado</option>
                                </select>
                            </div>
                        </>
                    )}

                    {activeTab === 'people' && (
                        <>
                            <div><label className="text-sm font-bold">Nome</label><input className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                            <div><label className="text-sm font-bold">Departamento</label><input className="w-full border p-2 rounded" value={formData.department || ''} onChange={e => setFormData({...formData, department: e.target.value})} /></div>
                        </>
                    )}

                    {activeTab === 'general' && (
                        <>
                            <div><label className="text-xs font-bold text-slate-500">NÚMERO</label><input className="w-full border p-2 rounded font-mono" value={formData.phone_number || ''} onChange={e => setFormData({...formData, phone_number: e.target.value})} required /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500">OPERADORA</label><select className="w-full border p-2 rounded bg-white" value={formData.carrier || 'Vivo'} onChange={e => setFormData({...formData, carrier: e.target.value})}><option>Vivo</option><option>Tim</option><option>Claro</option></select></div>
                                <div><label className="text-xs font-bold text-slate-500">STATUS</label><select className="w-full border p-2 rounded bg-white" value={formData.status || 'livre'} onChange={e => setFormData({...formData, status: e.target.value})}><option value="livre">Livre</option><option value="uso">Em Uso</option><option value="banido">Banido</option></select></div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded border space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500">APARELHO</label>
                                    <select className="w-full border p-2 rounded bg-white" value={formData.device_link_id || ''} onChange={e => setFormData({...formData, device_link_id: e.target.value})}>
                                        <option value="">-- Nenhum --</option>
                                        {availableDevices.map(d => <option key={d.id} value={d.id}>{d.name} - {d.model}</option>)}
                                        {editingItem?.device_link_id && !availableDevices.find(d => d.id === editingItem.device_link_id) && <option value={editingItem.device_link_id}>{editingItem.device_name} (Atual)</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">RESPONSÁVEL</label>
                                    <select className="w-full border p-2 rounded bg-white" value={formData.employee_link_id || ''} onChange={e => setFormData({...formData, employee_link_id: e.target.value})}>
                                        <option value="">-- Ninguém --</option>
                                        {availableEmployees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                                        {editingItem?.employee_link_id && !availableEmployees.find(e => e.id === editingItem.employee_link_id) && <option value={editingItem.employee_link_id}>{editingItem.employee_name} (Atual)</option>}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="bg-blue-600 text-white">Salvar</Button>
                    </div>
                </form>
            </Card>
        </div>, document.body
      )}

      {deleteData && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm bg-white shadow-xl p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
              <h3 className="text-lg font-bold mb-2">Excluir Item?</h3>
              <p className="text-sm text-slate-500 mb-6">Tem certeza? Essa ação não pode ser desfeita.</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setDeleteData(null)}>Cancelar</Button>
                <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Sim, Excluir</Button>
              </div>
          </Card>
        </div>, document.body
      )}
    </div>
  );
}