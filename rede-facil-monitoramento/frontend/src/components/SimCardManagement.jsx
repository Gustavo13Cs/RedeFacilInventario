import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, Smartphone, CheckCircle, Save, X, Search, Filter, AlertTriangle, User, Paperclip } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from 'axios';
import { API_URL } from '../config';

export default function SimCardManagement({ userRole }) {
  const [activeTab, setActiveTab] = useState('general'); 
  const [chips, setChips] = useState([]);
  const [devices, setDevices] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({}); 
  const [deleteData, setDeleteData] = useState(null); 

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [deviceLogs, setDeviceLogs] = useState([]);
  const [viewingDeviceName, setViewingDeviceName] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCarrier, setFilterCarrier] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');

  const [searchDevice, setSearchDevice] = useState('');
  const [filterDeviceStatus, setFilterDeviceStatus] = useState('Todos');

  const [searchEmployee, setSearchEmployee] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const CHIPS_API = `${API_URL}/chips`;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
        const config = getAuthHeaders(); 
        const [resChips, resDevices, resEmp] = await Promise.all([
            axios.get(CHIPS_API, config),               
            axios.get(`${CHIPS_API}/devices`, config), 
            axios.get(`${CHIPS_API}/employees`, config) 
        ]);
        setChips(Array.isArray(resChips.data) ? resChips.data : []);
        setDevices(Array.isArray(resDevices.data) ? resDevices.data : []);
        setEmployees(Array.isArray(resEmp.data) ? resEmp.data : []);
    } catch (error) { 
        console.error("Erro ao carregar dados", error);
        if (error.response?.status === 401) window.location.reload();
    }
  };

  const handleOpenModal = (type, item = null) => {
    setEditingItem(item);
    if (item) {
        setFormData({ ...item });
    } else {
        setFormData({});
        if (type === 'general') {
            setFormData({ carrier: 'Vivo', status: 'livre', whatsapp_type: 'Normal' });
        } else if (type === 'devices') {
            setFormData({ status: 'ativo' });
        }
    }
    if (['general', 'devices', 'people'].includes(type)) {
        setActiveTab(type);
    }
    setIsModalOpen(true);
  };

  const requestDelete = (id, type) => {
    setDeleteData({ id, type });
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const config = getAuthHeaders();

    try {
        if (activeTab === 'general') {
            if (formData.device_link_id && formData.device_link_id !== "0" && formData.device_link_id !== "") {
                
                const targetDeviceId = String(formData.device_link_id);
                const targetType = formData.whatsapp_type;

                const conflito = chips.find(c => 
                    String(c.device_link_id) === targetDeviceId && 
                    c.whatsapp_type === targetType && 
                    c.id !== editingItem?.id 
                );

                if (conflito) {
                    alert(`⚠️ CONFLITO DETECTADO:\n\nO aparelho selecionado já possui um WhatsApp do tipo "${targetType}".\n\nPor favor, altere o tipo para "Duplicado" ou escolha outro aparelho.`);
                    return; 
                }
            }
            const payload = { 
                ...formData, 
                device_link_id: (formData.device_link_id && formData.device_link_id !== "0") ? formData.device_link_id : null,
                employee_link_id: (formData.employee_link_id && formData.employee_link_id !== "0") ? formData.employee_link_id : null
            };

            if (editingItem) {
                await axios.put(`${CHIPS_API}/${editingItem.id}`, payload, config);
            } else {
                await axios.post(CHIPS_API, payload, config);
            }

        } else if (activeTab === 'devices') {
            if (editingItem) await axios.put(`${CHIPS_API}/devices/${editingItem.id}`, formData, config);
            else await axios.post(`${CHIPS_API}/devices`, formData, config);
            
        } else if (activeTab === 'people') {
            if (editingItem) await axios.put(`${CHIPS_API}/employees/${editingItem.id}`, formData, config);
            else await axios.post(`${CHIPS_API}/employees`, formData, config);
        }

        fetchData();
        setIsModalOpen(false);

    } catch (error) {
        console.error("❌ ERRO AO SALVAR:", error);
        const msg = error.response?.data?.error || error.message || "Erro desconhecido ao salvar.";
        alert(`Erro ao salvar: ${msg}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteData) return;
    const config = getAuthHeaders(); 
    try {
        if (deleteData.type === 'general') await axios.delete(`${CHIPS_API}/${deleteData.id}`, config);
        if (deleteData.type === 'devices') await axios.delete(`${CHIPS_API}/devices/${deleteData.id}`, config);
        if (deleteData.type === 'people') await axios.delete(`${CHIPS_API}/employees/${deleteData.id}`, config);
        fetchData();
        setDeleteData(null);
    } catch (error) { alert("Erro ao deletar."); }
  };

  const handleViewLogs = async (device) => {
      try {
          const res = await axios.get(`${CHIPS_API}/devices/${device.id}/logs`, getAuthHeaders());
          setDeviceLogs(res.data || []);
          setViewingDeviceName(device.name);
          setIsLogModalOpen(true);
      } catch (error) { console.error(error); alert("Erro ao buscar histórico."); }
  };

  const getAvailableOptions = () => {
      const safeChips = chips || []; 
      const usedDeviceIds = safeChips.filter(c => c.id !== editingItem?.id).map(c => c.device_link_id).filter(Boolean);
      const usedEmployeeIds = safeChips.filter(c => c.id !== editingItem?.id).map(c => c.employee_link_id).filter(Boolean);
      
      const availableDevices = (devices || []).filter(d => d.status === 'ativo');

      const availableEmployees = (employees || []).filter(e => !usedEmployeeIds.includes(e.id));
      return { availableDevices, availableEmployees };
  };

  const { availableDevices, availableEmployees } = getAvailableOptions();

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

      case 'livre': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Livre</Badge>;
      case 'uso': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Em Uso</Badge>;
      case 'banido': return <Badge className="bg-red-100 text-red-700 border-red-200">Banido</Badge>;

      case 'ativo': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex w-fit gap-1"><CheckCircle className="w-3 h-3"/> Ativo</Badge>;
      case 'manutencao': return <Badge className="bg-orange-50 text-orange-700 border-orange-200 flex w-fit gap-1"><AlertTriangle className="w-3 h-3"/> Manut.</Badge>;
      case 'quebrado': return <Badge className="bg-red-50 text-red-700 border-red-200 flex w-fit gap-1"><X className="w-3 h-3"/> Quebrado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWhatsappBadge = (type) => {
      if (type === 'Business') return <Badge className="bg-green-100 text-green-800 border-green-200">Business</Badge>;
      if (type === 'Duplicado') return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Duplicado</Badge>;
      return <Badge variant="secondary" className="bg-slate-100 text-slate-600">Normal</Badge>;
  };

  const renderGeneralTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50 flex flex-col md:flex-row gap-4">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="overflow-x-auto w-full">
                <Table className="min-w-[800px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="whitespace-nowrap">Número</TableHead>
                            <TableHead>Operadora</TableHead>
                            <TableHead>WhatsApp</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="whitespace-nowrap">Aparelho</TableHead>
                            <TableHead className="whitespace-nowrap">Responsável</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredChips.map(chip => (
                            <TableRow key={chip.id}>
                                <TableCell className="font-mono font-medium whitespace-nowrap">{chip.phone_number}</TableCell>
                                <TableCell>{chip.carrier}</TableCell>
                                <TableCell>{getWhatsappBadge(chip.whatsapp_type)}</TableCell>
                                <TableCell>{getStatusBadge(chip.status)}</TableCell>
                                <TableCell className="text-slate-600 flex items-center gap-2 whitespace-nowrap">
                                    {chip.device_name ? <><Smartphone className="h-3 w-3"/> {chip.device_name}</> : '-'}
                                </TableCell>
                                <TableCell className="text-slate-600 whitespace-nowrap">
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
                        {filteredChips.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Nenhum registro encontrado.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );

  const renderDevicesTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50 flex flex-col md:flex-row gap-4">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="overflow-x-auto w-full">
                <Table className="min-w-[600px]">
                    <TableHeader><TableRow className="bg-slate-50"><TableHead>Identificação</TableHead><TableHead>Modelo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {filteredDevices.map(dev => (
                            <TableRow key={dev.id}>
                                <TableCell className="font-bold flex items-center gap-2 whitespace-nowrap"><Smartphone className="h-4 w-4 text-slate-400"/> {dev.name}</TableCell>
                                <TableCell className="whitespace-nowrap">{dev.model}</TableCell>
                                <TableCell>{getStatusBadge(dev.status)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleViewLogs(dev)} className="h-8 text-slate-600 border-slate-300 gap-1 text-xs whitespace-nowrap">
                                            <Search className="h-3 w-3"/> Histórico
                                        </Button>
                                        {userRole === 'admin' && (
                                            <>
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenModal('devices', dev)}><Edit2 className="h-4 w-4 text-blue-600"/></Button>
                                                <Button variant="ghost" size="sm" onClick={() => requestDelete(dev.id, 'devices')}><Trash2 className="h-4 w-4 text-red-600"/></Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredDevices.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Nenhum aparelho encontrado.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );

  const renderPeopleTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50">
            <div className="relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                <input className="w-full pl-8 p-1.5 text-sm border rounded outline-none" placeholder="Buscar pessoa..." value={searchEmployee} onChange={e => setSearchEmployee(e.target.value)} />
            </div>
        </div>
        <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
                <Table className="min-w-[500px]">
                    <TableHeader><TableRow className="bg-slate-50"><TableHead>Nome</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {filteredEmployees.map(emp => (
                            <TableRow key={emp.id}>
                                <TableCell className="font-medium flex items-center gap-2 whitespace-nowrap"><User className="h-4 w-4 text-slate-400"/> {emp.name}</TableCell>
                                <TableCell><Badge variant="secondary">{emp.department}</Badge></TableCell>
                                <TableCell className="text-right">
                                    {userRole === 'admin' && <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => handleOpenModal('people', emp)}><Edit2 className="h-4 w-4 text-blue-600"/></Button><Button variant="ghost" size="sm" onClick={() => requestDelete(emp.id, 'people')}><Trash2 className="h-4 w-4 text-red-600"/></Button></div>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );

const renderChipsInventoryTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700">Inventário de Chips</h3>
        </div>
        <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
                <Table className="min-w-[600px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead>Número</TableHead>
                            <TableHead>Operadora</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(chips || []).map(chip => (
                            <TableRow key={chip.id}>
                                <TableCell className="font-mono font-medium">{chip.phone_number}</TableCell>
                                <TableCell>{chip.carrier}</TableCell>
                                <TableCell>{getWhatsappBadge(chip.whatsapp_type)}</TableCell>
                                <TableCell>{getStatusBadge(chip.status)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenModal('general', chip)}>
                                        <Edit2 className="h-4 w-4 text-blue-600"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto whitespace-nowrap">
            <button onClick={() => setActiveTab('general')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'general' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Paperclip className="w-4 h-4 mr-2"/> Gestão de Vínculos
            </button>

            <button onClick={() => setActiveTab('chips_inventory')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'chips_inventory' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
        <Smartphone className="w-4 h-4 mr-2"/> Chips
    </button>

            <button onClick={() => setActiveTab('devices')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'devices' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Smartphone className="w-4 h-4 mr-2"/> Celulares
            </button>
            <button onClick={() => setActiveTab('people')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'people' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <User className="w-4 h-4 mr-2"/> Pessoas
            </button>
        </div>
        
        {userRole === 'admin' && (
            <Button onClick={() => handleOpenModal(activeTab === 'chips_inventory' ? 'general' : activeTab)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md">
                <Plus className="h-4 w-4" /> 
                {activeTab === 'general' ? 'Novo Vínculo' : 
                 activeTab === 'chips_inventory' ? 'Cadastrar Chip' :
                 activeTab === 'devices' ? 'Cadastrar Celular' : 'Cadastrar Pessoa'}
            </Button>
        )}
      </div>

      {activeTab === 'general' && renderGeneralTab()}
      {activeTab === 'devices' && renderDevicesTab()}
      {activeTab === 'people' && renderPeopleTab()}
      {activeTab === 'chips_inventory' && renderChipsInventoryTab()}

      {/* MODAL DE CADASTRO */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"> {/* ✅ p-4 */}
            <Card className="w-full max-w-md bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto"> {/* ✅ max-h e overflow */}
                <div className="flex justify-between mb-4 sticky top-0 bg-white z-10 pb-2 border-b">
                    <CardTitle className="text-lg text-slate-800">
                        {activeTab === 'general' ? 'Configurar Vínculo' : activeTab === 'devices' ? 'Gerenciar Celular' : 'Gerenciar Colaborador'}
                    </CardTitle>
                    <button onClick={() => setIsModalOpen(false)}><X className="h-5 w-5 text-slate-400 hover:text-slate-600"/></button>
                </div>
                <form onSubmit={handleSave} className="space-y-4 pt-2">
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
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500">OPERADORA</label><select className="w-full border p-2 rounded bg-white" value={formData.carrier || 'Vivo'} onChange={e => setFormData({...formData, carrier: e.target.value})}><option>Vivo</option><option>Tim</option><option>Claro</option></select></div>
                                <div><label className="text-xs font-bold text-slate-500">STATUS DO CHIP</label><select className="w-full border p-2 rounded bg-white" value={formData.status || 'livre'} onChange={e => setFormData({...formData, status: e.target.value})}><option value="livre">Livre</option><option value="uso">Em Uso</option><option value="banido">Banido</option></select></div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500">TIPO WHATSAPP</label>
                                <select className="w-full border p-2 rounded bg-white" value={formData.whatsapp_type || 'Normal'} onChange={e => setFormData({...formData, whatsapp_type: e.target.value})}>
                                    <option value="Normal">Normal</option>
                                    <option value="Business">Business</option>
                                    <option value="Duplicado">Duplicado</option>
                                </select>
                            </div>

                            <div className="bg-slate-50 p-3 rounded space-y-2 border">
                                <select className="w-full border p-2 rounded bg-white" value={formData.device_link_id || ''} onChange={e => setFormData({...formData, device_link_id: e.target.value})}>
                                    <option value="">-- Aparelho (Nenhum) --</option>
                                    {availableDevices.map(d => {
                                        const emUso = chips
                                            .filter(c => c.device_link_id === d.id && c.id !== editingItem?.id)
                                            .map(c => c.whatsapp_type)
                                            .join(', ');
                                            
                                        const label = emUso ? `${d.name} (Em uso: ${emUso})` : d.name;
                                        
                                        return <option key={d.id} value={d.id}>{label}</option>
                                    })}
                                </select>
                                <select className="w-full border p-2 rounded bg-white" value={formData.employee_link_id || ''} onChange={e => setFormData({...formData, employee_link_id: e.target.value})}>
                                    <option value="">-- Pessoa (Ninguém) --</option>
                                    {availableEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    {editingItem?.employee_link_id && <option value={editingItem.employee_link_id}>{editingItem.employee_name} (Atual)</option>}
                                </select>
                            </div>
                        </>
                    )}
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4 pt-2 border-t">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar</Button>
                    </div>
                </form>
            </Card>
        </div>, document.body
      )}

    {/* MODAL DE LOGS (HISTÓRICO) */}
      {isLogModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg bg-white shadow-2xl h-[500px] flex flex-col max-h-[90vh]">
                <CardHeader className="border-b bg-slate-50 rounded-t-lg flex flex-row justify-between items-center py-4">
                    <div>
                        <CardTitle className="text-lg text-slate-800 flex items-center gap-2"><Smartphone className="h-5 w-5 text-blue-600"/> Histórico do Aparelho</CardTitle>
                        <p className="text-sm text-slate-500">{viewingDeviceName}</p>
                    </div>
                    <button onClick={() => setIsLogModalOpen(false)}><X className="h-5 w-5 text-slate-400"/></button>
                </CardHeader>
                <div className="flex-1 overflow-auto p-0">
                    {deviceLogs.length === 0 ? (
                        <div className="text-center py-10 text-slate-400"><p>Nenhum histórico registrado.</p></div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {deviceLogs.map(log => (
                                <div key={log.id} className="p-4 hover:bg-slate-50 flex gap-4">
                                    <div className="min-w-[40px] pt-1"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><CheckCircle className="h-4 w-4 text-blue-600"/></div></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{log.action_type}</p>
                                        <p className="text-sm text-slate-600">{log.description}</p>
                                        <p className="text-xs text-slate-400 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t bg-slate-50 text-center"><Button variant="outline" onClick={() => setIsLogModalOpen(false)} className="w-full">Fechar</Button></div>
            </Card>
        </div>, document.body
      )}

      {deleteData && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm bg-white shadow-xl p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
              <h3 className="text-lg font-bold mb-2">Excluir?</h3>
              <p className="text-sm text-slate-500 mb-6">Essa ação não pode ser desfeita.</p>
              <div className="flex gap-2 justify-center"><Button variant="outline" onClick={() => setDeleteData(null)}>Cancelar</Button><Button onClick={confirmDelete} variant="destructive">Excluir</Button></div>
          </Card>
        </div>, document.body
      )}
    </div>
  );
}
