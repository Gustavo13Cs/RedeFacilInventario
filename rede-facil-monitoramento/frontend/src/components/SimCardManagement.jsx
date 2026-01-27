import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, Smartphone, CheckCircle, Save, X, Search, Filter, AlertTriangle, User, Paperclip } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from 'axios';
import { API_URL } from '../config';

// Função auxiliar para formatar o telefone no padrão (XX) XXXXX-XXXX
const formatPhoneNumber = (value) => {
  if (!value) return "";
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 10) {
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
};

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

  // Filtra chips que estão "livres" para serem vinculados
  const availableChipsForLink = chips.filter(c => 
    c.status === 'livre' || c.id === editingItem?.id
  );

  const handleOpenModal = (type, item = null) => {
    setEditingItem(item);
    if (item) {
        setFormData({ ...item });
    } else {
        setFormData({});
        if (type === 'general' || type === 'chips_inventory') {
            setFormData({ carrier: 'Vivo', status: 'livre', whatsapp_type: 'Normal' });
        } else if (type === 'devices') {
            setFormData({ status: 'ativo' });
        }
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const config = getAuthHeaders();
    try {
        const dataToSave = { ...formData };
        if (dataToSave.phone_number) {
            dataToSave.phone_number = dataToSave.phone_number.replace(/\D/g, "");
        }

        if (activeTab === 'general' || activeTab === 'chips_inventory') {
            const payload = { 
                ...dataToSave, 
                device_link_id: (dataToSave.device_link_id && dataToSave.device_link_id !== "0") ? dataToSave.device_link_id : null,
                employee_link_id: (dataToSave.employee_link_id && dataToSave.employee_link_id !== "0") ? dataToSave.employee_link_id : null
            };
            if (editingItem) await axios.put(`${CHIPS_API}/${editingItem.id}`, payload, config);
            else await axios.post(CHIPS_API, payload, config);
        } else if (activeTab === 'devices') {
            if (editingItem) await axios.put(`${CHIPS_API}/devices/${editingItem.id}`, dataToSave, config);
            else await axios.post(`${CHIPS_API}/devices`, dataToSave, config);
        } else if (activeTab === 'people') {
            if (editingItem) await axios.put(`${CHIPS_API}/employees/${editingItem.id}`, dataToSave, config);
            else await axios.post(`${CHIPS_API}/employees`, dataToSave, config);
        }
        fetchData();
        setIsModalOpen(false);
    } catch (error) {
        alert(`Erro ao salvar: ${error.response?.data?.error || error.message}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteData) return;
    const config = getAuthHeaders(); 
    try {
        if (deleteData.type === 'general' || deleteData.type === 'chips_inventory') {
            await axios.delete(`${CHIPS_API}/${deleteData.id}`, config);
        } else if (deleteData.type === 'devices') {
            await axios.delete(`${CHIPS_API}/devices/${deleteData.id}`, config);
        } else if (deleteData.type === 'people') {
            await axios.delete(`${CHIPS_API}/employees/${deleteData.id}`, config);
        }
        fetchData();
        setDeleteData(null);
    } catch (error) { alert("Erro ao deletar."); }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'livre': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Livre</Badge>;
      case 'uso': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Em Uso</Badge>;
      case 'banido': return <Badge className="bg-red-100 text-red-700 border-red-200">Banido</Badge>;
      case 'ativo': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex w-fit gap-1"><CheckCircle className="w-3 h-3"/> Ativo</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWhatsappBadge = (type) => {
      if (type === 'Business') return <Badge className="bg-green-100 text-green-800 border-green-200">Business</Badge>;
      if (type === 'Duplicado') return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Duplicado</Badge>;
      return <Badge variant="secondary" className="bg-slate-100 text-slate-600">Normal</Badge>;
  };

  const renderChipsInventoryTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-700">Inventário de Chips</h3>
        </div>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead>Número</TableHead>
                        <TableHead>Operadora</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {chips.map(chip => (
                        <TableRow key={chip.id}>
                            <TableCell className="font-mono font-medium">{formatPhoneNumber(chip.phone_number)}</TableCell>
                            <TableCell>{chip.carrier}</TableCell>
                            <TableCell>{getWhatsappBadge(chip.whatsapp_type)}</TableCell>
                            <TableCell>{getStatusBadge(chip.status)}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenModal('chips_inventory', chip)}>
                                        <Edit2 className="h-4 w-4 text-blue-600"/>
                                    </Button>
                                    {userRole === 'admin' && (
                                        <Button variant="ghost" size="sm" onClick={() => setDeleteData({id: chip.id, type: 'chips_inventory'})}>
                                            <Trash2 className="h-4 w-4 text-red-600"/>
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );

 const renderGeneralTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <div className="p-4 border-b bg-slate-50/50 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                <input 
                    className="w-full pl-8 p-1.5 text-sm border rounded outline-none" 
                    placeholder="Buscar vínculo..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                />
            </div>
        </div>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead>Número</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aparelho</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {chips
                        .filter(chip => {
                            // REGRA: Só aparece nesta aba se tiver Aparelho E Responsável vinculados
                            const temVinculoCompleto = chip.device_link_id && chip.employee_link_id;
                            
                            const matchesSearch = 
                                chip.phone_number.includes(searchTerm) || 
                                (chip.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (chip.device_name || '').toLowerCase().includes(searchTerm.toLowerCase());

                            return temVinculoCompleto && matchesSearch;
                        })
                        .map(chip => (
                            <TableRow key={chip.id}>
                                <TableCell className="font-mono font-medium">{formatPhoneNumber(chip.phone_number)}</TableCell>
                                <TableCell>{getStatusBadge(chip.status)}</TableCell>
                                <TableCell className="text-slate-600">
                                    {chip.device_name ? <div className="flex items-center gap-1"><Smartphone className="h-3 w-3"/> {chip.device_name}</div> : '-'}
                                </TableCell>
                                <TableCell className="text-slate-600">
                                    {chip.employee_name ? <div className="flex items-center gap-1"><User className="h-3 w-3"/> {chip.employee_name}</div> : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                    {userRole === 'admin' && (
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal('general', chip)}><Edit2 className="h-4 w-4 text-blue-600"/></Button>
                                            <Button variant="ghost" size="sm" onClick={() => setDeleteData({id: chip.id, type: 'general'})}><Trash2 className="h-4 w-4 text-red-600"/></Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    {/* Mensagem caso a tabela esteja vazia após o filtro */}
                    {chips.filter(chip => chip.device_link_id && chip.employee_link_id).length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                                Nenhum chip configurado com aparelho e responsável.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

  const renderDevicesTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <CardContent className="p-0">
            <Table>
                <TableHeader><TableRow className="bg-slate-50"><TableHead>Aparelho</TableHead><TableHead>Modelo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                    {devices.map(dev => (
                        <TableRow key={dev.id}>
                            <TableCell className="font-bold">{dev.name}</TableCell>
                            <TableCell>{dev.model}</TableCell>
                            <TableCell>{getStatusBadge(dev.status)}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => handleOpenModal('devices', dev)}><Edit2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );

  const renderPeopleTab = () => (
    <Card className="border-slate-200 shadow-sm mt-6">
        <CardContent className="p-0">
            <Table>
                <TableHeader><TableRow className="bg-slate-50"><TableHead>Nome</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                    {employees.map(emp => (
                        <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell>{emp.department}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => handleOpenModal('people', emp)}><Edit2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            <button onClick={() => setActiveTab('general')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'general' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}><Paperclip className="w-4 h-4 mr-2"/> Vínculos</button>
            <button onClick={() => setActiveTab('chips_inventory')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'chips_inventory' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}><Smartphone className="w-4 h-4 mr-2"/> Chips</button>
            <button onClick={() => setActiveTab('devices')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'devices' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}><Smartphone className="w-4 h-4 mr-2"/> Celulares</button>
            <button onClick={() => setActiveTab('people')} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'people' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}><User className="w-4 h-4 mr-2"/> Pessoas</button>
        </div>
        
        {userRole === 'admin' && (
            <Button onClick={() => handleOpenModal(activeTab)} className="bg-blue-600 text-white gap-2">
                <Plus className="h-4 w-4" /> 
                {activeTab === 'general' ? 'Novo Vínculo' : activeTab === 'chips_inventory' ? 'Cadastrar Chip' : 'Novo Cadastro'}
            </Button>
        )}
      </div>

      {activeTab === 'general' && renderGeneralTab()}
      {activeTab === 'chips_inventory' && renderChipsInventoryTab()}
      {activeTab === 'devices' && renderDevicesTab()}
      {activeTab === 'people' && renderPeopleTab()}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md bg-white p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between mb-4 border-b pb-2">
                    <CardTitle className="text-lg">Configurar</CardTitle>
                    <button onClick={() => setIsModalOpen(false)}><X className="h-5 w-5 text-slate-400"/></button>
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                    {(activeTab === 'general' || activeTab === 'chips_inventory') && (
                        <>
                            {activeTab === 'general' ? (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Chip Disponível</label>
                                    <select 
                                        className="w-full border p-2 rounded bg-white"
                                        value={formData.id || ''}
                                        onChange={e => {
                                            const chip = chips.find(c => c.id == e.target.value);
                                            if(chip) setFormData({...formData, id: chip.id, phone_number: formatPhoneNumber(chip.phone_number), carrier: chip.carrier});
                                        }}
                                        required
                                    >
                                        <option value="">-- Escolha um número --</option>
                                        {availableChipsForLink.map(c => <option key={c.id} value={c.id}>{formatPhoneNumber(c.phone_number)} ({c.carrier})</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs font-bold text-slate-500">NÚMERO</label>
                                    <input 
                                        className="w-full border p-2 rounded font-mono" 
                                        value={formData.phone_number || ''} 
                                        onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                                            setFormData({...formData, phone_number: formatPhoneNumber(raw)});
                                        }} 
                                        placeholder="(79) 99999-9999"
                                        required 
                                    />
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500">OPERADORA</label><select className="w-full border p-2 rounded bg-white" value={formData.carrier || 'Vivo'} onChange={e => setFormData({...formData, carrier: e.target.value})}><option>Vivo</option><option>Tim</option><option>Claro</option></select></div>
                                <div><label className="text-xs font-bold text-slate-500">STATUS</label><select className="w-full border p-2 rounded bg-white" value={formData.status || 'livre'} onChange={e => setFormData({...formData, status: e.target.value})}><option value="livre">Livre</option><option value="uso">Em Uso</option><option value="banido">Banido</option></select></div>
                            </div>

                            {activeTab === 'general' && (
                                <div className="space-y-4 border-t pt-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">TIPO WHATSAPP</label>
                                        <select className="w-full border p-2 rounded bg-white" value={formData.whatsapp_type || 'Normal'} onChange={e => setFormData({...formData, whatsapp_type: e.target.value})}>
                                            <option value="Normal">Normal</option><option value="Business">Business</option><option value="Duplicado">Duplicado</option>
                                        </select>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded space-y-2 border">
                                        <select className="w-full border p-2 rounded bg-white" value={formData.device_link_id || ''} onChange={e => setFormData({...formData, device_link_id: e.target.value})}>
                                            <option value="">-- Aparelho --</option>
                                            {devices.filter(d => d.status === 'ativo').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                        <select className="w-full border p-2 rounded bg-white" value={formData.employee_link_id || ''} onChange={e => setFormData({...formData, employee_link_id: e.target.value})}>
                                            <option value="">-- Pessoa --</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'devices' && (
                        <>
                            <div><label className="text-sm font-bold">Identificação</label><input className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                            <div><label className="text-sm font-bold">Modelo</label><input className="w-full border p-2 rounded" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} /></div>
                        </>
                    )}

                    {activeTab === 'people' && (
                        <div><label className="text-sm font-bold">Nome</label><input className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                    )}

                    <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="bg-blue-600 text-white">Salvar</Button>
                    </div>
                </form>
            </Card>
        </div>, document.body
      )}

      {deleteData && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm bg-white p-6 text-center shadow-xl">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
              <h3 className="text-lg font-bold mb-2">Excluir?</h3>
              <p className="text-sm text-slate-500 mb-6">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2 justify-center"><Button variant="outline" onClick={() => setDeleteData(null)}>Cancelar</Button><Button onClick={confirmDelete} variant="destructive">Excluir</Button></div>
          </Card>
        </div>, document.body
      )}
    </div>
  );
}