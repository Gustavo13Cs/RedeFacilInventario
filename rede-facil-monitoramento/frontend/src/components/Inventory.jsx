import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Plus, Edit2, Trash2, Box, Save, X, Filter, Search, 
    FileSpreadsheet, FileText, AlertTriangle, Layers, ChevronLeft, ChevronRight, 
    MapPin, Settings2, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from 'axios';
import { generateExcel, generatePDF } from '@/utils/exportUtils';
import { API_URL } from '../config';

// --- SUB-COMPONENTE: MODAL DE CATEGORIAS ---
const CategoryModal = ({ isOpen, onClose, onSave, onDelete, categories }) => {
    const [newCat, setNewCat] = useState('');
    if (!isOpen) return null;
  
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Card className="w-full max-w-sm bg-white shadow-xl p-6 animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-4">
            <CardTitle className="text-lg">Gerenciar Tipos</CardTitle>
            <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-red-500"/></button>
          </div>
          
          <div className="flex gap-2 mb-6">
            <input 
              className="flex-1 border p-2 rounded text-sm outline-none focus:border-blue-500" 
              placeholder="Novo Tipo (ex: Projetor)..." 
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newCat.trim() && onSave(newCat) && setNewCat('')}
            />
            <Button size="sm" onClick={() => { onSave(newCat); setNewCat(''); }} disabled={!newCat.trim()}>
              <Plus className="h-4 w-4"/>
            </Button>
          </div>
  
          <div className="max-h-60 overflow-y-auto border rounded divide-y">
              {categories.map(cat => (
                  <div key={cat.id} className="p-2 text-sm flex justify-between items-center hover:bg-slate-50">
                      <span className="pl-2">{cat.name}</span>
                      <button onClick={() => onDelete(cat.id)} className="text-slate-400 hover:text-red-600 p-1">
                          <Trash2 className="h-3 w-3"/>
                      </button>
                  </div>
              ))}
              {categories.length === 0 && <p className="text-xs text-center p-4 text-slate-400">Nenhum tipo cadastrado.</p>}
          </div>
        </Card>
      </div>,
      document.body
    );
};

export default function Inventory({ userRole }) {
  // --- ESTADOS ---
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]); 
  const [loadingExport, setLoadingExport] = useState(false); // Loading do PDF
  
  // Paginação e Filtros
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({
      type: 'Todos',
      status: 'Todos',
      search: '',
      location: '' // Novo filtro de localização
  });

  // Debounce (atraso na busca para não travar enquanto digita)
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');

  // Modais
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null); 

  // Formulário Completo
  const [formData, setFormData] = useState({
    type: '', name: '', model: '', serial_number: '', patrimony_code: '', brand: '', 
    status: 'disponivel', condition: 'novo', location: '', assigned_to: '', quantity: 1
  });

  const INVENTORY_API = `${API_URL}/inventory`;

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // --- EFEITOS ---
  
  // 1. Debounce: Espera 500ms após parar de digitar para atualizar a busca
  useEffect(() => {
      const timer = setTimeout(() => {
          setDebouncedSearch(filters.search);
          setDebouncedLocation(filters.location);
      }, 500);
      return () => clearTimeout(timer);
  }, [filters.search, filters.location]);

  // 2. Busca dados quando paginação ou filtros mudam
  useEffect(() => { fetchInventory(); }, [pagination.page, filters.type, filters.status, debouncedSearch, debouncedLocation]);
  
  // 3. Busca categorias ao iniciar
  useEffect(() => { fetchCategories(); }, []);

  // --- API ---

  const fetchCategories = async () => {
      try {
          const res = await axios.get(`${INVENTORY_API}/settings/categories`, getAuthHeaders());
          setCategories(res.data || []);
      } catch (e) { console.error("Erro categorias:", e); }
  };

  const fetchInventory = async () => {
    try {
      const params = {
          page: pagination.page,
          limit: 10, // Itens por página
          type: filters.type,
          status: filters.status,
          search: debouncedSearch,
          location: debouncedLocation
      };

      const res = await axios.get(INVENTORY_API, { ...getAuthHeaders(), params });
      
      // Suporte para resposta paginada { data, meta } ou lista simples (legado)
      if (res.data.meta) {
          setItems(res.data.data);
          setPagination(prev => ({
              ...prev,
              totalPages: res.data.meta.totalPages,
              total: res.data.meta.total
          }));
      } else {
          setItems(res.data);
      }
    } catch (error) { console.error("Erro ao buscar inventário:", error); }
  };

  // --- GERENCIAMENTO DE CATEGORIAS ---
  const handleAddCategory = async (name) => {
    try {
        await axios.post(`${INVENTORY_API}/settings/categories`, { name }, getAuthHeaders());
        fetchCategories();
    } catch (error) { alert("Erro ao criar categoria"); }
  };

  const handleDeleteCategory = async (id) => {
      if(!window.confirm("Remover este tipo da lista?")) return;
      try {
          await axios.delete(`${INVENTORY_API}/settings/categories/${id}`, getAuthHeaders());
          fetchCategories();
      } catch (error) { alert("Erro ao deletar"); }
  };

  // --- FORMULÁRIO ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const startEdit = (item) => {
    setFormData({ 
        ...item, 
        quantity: 1, 
        serial_number: item.serial || item.serial_number || '' 
    });
    setEditingId(item.id);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ 
        type: '', name: '', model: '', serial_number: '', patrimony_code: '', brand: '', 
        status: 'disponivel', condition: 'novo', location: '', assigned_to: '', quantity: 1 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, quantity: parseInt(formData.quantity) };
      const config = getAuthHeaders();

      if (editingId) await axios.put(`${INVENTORY_API}/${editingId}`, payload, config);
      else await axios.post(INVENTORY_API, payload, config);
      
      fetchInventory(); 
      closeForm();
    } catch (error) { alert("Erro ao salvar."); }
  };

  const requestDelete = (id) => { setItemToDelete(id); };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try { 
          await axios.delete(`${INVENTORY_API}/${itemToDelete}`, getAuthHeaders()); 
          fetchInventory(); 
          setItemToDelete(null); 
      } catch (error) { alert("Erro ao excluir item."); }
    }
  };

  // --- FILTROS E PAGINAÇÃO ---
  const handleFilterChange = (key, value) => {
      setFilters(prev => ({ ...prev, [key]: value }));
      setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
      if (newPage >= 1 && newPage <= pagination.totalPages) {
          setPagination(prev => ({ ...prev, page: newPage }));
      }
  };

  // --- EXPORTAÇÃO PDF INTELIGENTE ---
  const handleExportPDF = async () => {
    try {
        setLoadingExport(true);
        // 1. Busca TODOS os itens do banco com os filtros atuais (limit alto para ignorar paginação)
        const params = {
            page: 1,
            limit: 100000, 
            type: filters.type,
            status: filters.status,
            search: debouncedSearch,
            location: debouncedLocation
        };

        const res = await axios.get(INVENTORY_API, { ...getAuthHeaders(), params });
        const allData = res.data.meta ? res.data.data : res.data;

        // 2. Formata para o PDF
        const tableColumns = ["Patrimônio", "Equipamento", "Tipo", "Serial", "Status", "Local"];
        const tableRows = allData.map(item => [
            item.patrimony_code || '-', 
            `${item.name} (${item.model})`, 
            item.type, 
            item.serial || item.serial_number || '-',
            item.status === 'disponivel' ? 'Disponível' : item.status === 'em_uso' ? 'Em Uso' : 'Defeito/Falta',
            item.location || '-'
        ]);

        // 3. Gera o arquivo
        generatePDF({
            title: "Relatório de Inventário Completo",
            details: [
                `Gerado em: ${new Date().toLocaleDateString()}`, 
                `Filtros: ${filters.type !== 'Todos' ? filters.type : 'Todos'} | Local: ${filters.location || 'Geral'}`,
                `Total de Itens: ${allData.length}`
            ],
            columns: tableColumns, 
            rows: tableRows, 
            fileName: `Inventario_${new Date().toLocaleDateString().replace(/\//g, '-')}`
        });

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar relatório. Tente novamente.");
    } finally {
        setLoadingExport(false);
    }
  };

  // Exportação Excel (Exporta página atual)
  const handleExportExcel = () => {
    generateExcel(items, "Inventário", `Inventario_Pagina_${pagination.page}`);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'disponivel': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Disponível</Badge>;
      case 'uso': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Em Uso</Badge>;
      case 'manutencao': return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Manutenção</Badge>;
      case 'defeito': return <Badge className="bg-red-100 text-red-700 border-red-200">Defeito/Falta</Badge>;
      default: return <Badge variant="outline">Outro</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Box className="h-6 w-6 text-blue-600"/> Gestão de Patrimônio
            </h1>
            <p className="text-slate-500 text-sm mt-1">
                Total Geral: <b className="text-blue-700 text-lg">{pagination.total}</b> itens cadastrados.
            </p>
        </div>
        
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel} className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
                <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={loadingExport} className="gap-2 text-red-700 border-red-200 hover:bg-red-50">
                {loadingExport ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4" />}
                {loadingExport ? "Gerando..." : "PDF Completo"}
            </Button>
            {userRole === 'admin' && (
                <Button onClick={() => setIsFormOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md">
                    <Plus className="h-4 w-4" /> Novo Item
                </Button>
            )}
        </div>
      </div>

      {/* ÁREA DE FILTROS ROBUSTA */}
      <Card className="border-slate-200 shadow-sm bg-slate-50">
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Busca Geral */}
            <div className="relative md:col-span-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                    className="w-full pl-8 p-2 text-sm border rounded outline-none focus:border-blue-300 transition-all" 
                    placeholder="Nome, Serial ou Tag..." 
                    value={filters.search} 
                    onChange={e => handleFilterChange('search', e.target.value)} 
                />
            </div>

            {/* Filtro Localização (NOVO) */}
            <div className="relative md:col-span-1">
                <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                    className="w-full pl-8 p-2 text-sm border rounded outline-none focus:border-blue-300 transition-all" 
                    placeholder="Filtrar Localização..." 
                    value={filters.location} 
                    onChange={e => handleFilterChange('location', e.target.value)} 
                />
            </div>

            {/* Filtro Tipo (Dinâmico) */}
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <select 
                    className="w-full bg-white border rounded text-sm p-2 outline-none" 
                    value={filters.type} 
                    onChange={e => handleFilterChange('type', e.target.value)}
                >
                    <option value="Todos">Todos os Tipos</option>
                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
            </div>

            {/* Filtro Status */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Status:</span>
                <select 
                    className="w-full bg-white border rounded text-sm p-2 outline-none" 
                    value={filters.status} 
                    onChange={e => handleFilterChange('status', e.target.value)}
                >
                    <option value="Todos">Todos</option>
                    <option value="disponivel">Disponível</option>
                    <option value="uso">Em Uso</option>
                    <option value="manutencao">Manutenção</option>
                    <option value="defeito">Defeito</option>
                </select>
            </div>
        </div>
      </Card>

      {/* TABELA DE ITENS */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <Table>
            <TableHeader>
                <TableRow className="bg-slate-100">
                    <TableHead>Patrimônio</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-mono font-medium text-slate-700">{item.patrimony_code || '-'}</TableCell>
                        <TableCell>
                            <div className="font-medium text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-500 flex gap-1">
                                {item.brand} {item.model} 
                                {item.serial && <span className="font-mono ml-1 text-slate-400">({item.serial})</span>}
                            </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-normal text-slate-600">{item.type}</Badge></TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-slate-600 text-sm">
                            <div className="flex items-center gap-1">
                                {item.location && <MapPin className="h-3 w-3 text-slate-400"/>}
                                {item.location || '-'}
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            {userRole === 'admin' ? (
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)} className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"><Edit2 className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => requestDelete(item.id)} className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ) : (<span className="text-xs text-slate-400 italic">Visualizar</span>)}
                        </TableCell>
                    </TableRow>
                ))}
                {items.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400"><p>Nenhum item encontrado.</p></TableCell></TableRow>
                )}
            </TableBody>
        </Table>

        {/* RODAPÉ COM PAGINAÇÃO */}
        <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
            <span className="text-sm text-slate-500">
                Página <b>{pagination.page}</b> de <b>{pagination.totalPages}</b>
            </span>
            <div className="flex gap-2">
                <Button 
                    variant="outline" size="sm" 
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                >
                    <ChevronLeft className="h-4 w-4 mr-1"/> Anterior
                </Button>
                <Button 
                    variant="outline" size="sm" 
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                >
                    Próximo <ChevronRight className="h-4 w-4 ml-1"/>
                </Button>
            </div>
        </div>
      </Card>

      {/* --- MODAL DE CADASTRO/EDIÇÃO --- */}
      {isFormOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          
          <Card className="relative z-10 w-full max-w-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 bg-white sticky top-0 z-20">
                <CardTitle className="text-slate-800 text-xl">{editingId ? 'Editar Item' : 'Novo Item'}</CardTitle>
                <button onClick={closeForm} className="text-slate-400 hover:text-slate-600"><X className="h-6 w-6" /></button>
            </CardHeader>
            <CardContent className="pt-6 bg-white">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Campo de Quantidade (Só se for novo) */}
                    {!editingId && (
                      <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-sm font-bold text-blue-800 flex items-center gap-2">
                               <Layers className="h-4 w-4" /> Quantidade de Itens
                            </label>
                            <p className="text-xs text-blue-600">Cria várias cópias idênticas deste cadastro.</p>
                        </div>
                        <input type="number" name="quantity" min="1" value={formData.quantity} onChange={handleInputChange} 
                          className="w-20 rounded-md border border-blue-200 p-2 text-center font-bold text-blue-900 outline-none" 
                        />
                      </div>
                    )}

                    <div className="md:col-span-2">
                        <label className="text-sm font-bold text-slate-700">Nome do Equipamento *</label>
                        <input name="name" value={formData.name || ''} onChange={handleInputChange} required placeholder="Ex: Notebook Dell Latitude 3420" 
                            className="w-full border p-2 rounded outline-none focus:border-blue-500" />
                    </div>

                    {/* Seleção de Tipo Dinâmico */}
                    <div>
                        <label className="text-sm font-bold text-slate-700 flex justify-between items-center">
                            Tipo *
                            <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="text-blue-600 text-xs hover:underline flex items-center gap-1 font-normal">
                                <Settings2 className="h-3 w-3"/> Gerenciar
                            </button>
                        </label>
                        <select name="type" value={formData.type || ''} onChange={handleInputChange} required className="w-full border p-2 rounded bg-white outline-none">
                            <option value="">Selecione...</option>
                            {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                        </select>
                    </div>

                    <div><label className="text-sm font-bold text-slate-700">Patrimônio (Tag)</label><input name="patrimony_code" value={formData.patrimony_code || ''} onChange={handleInputChange} className="w-full border p-2 rounded font-mono" placeholder="001234" /></div>
                    
                    <div><label className="text-sm font-bold text-slate-700">Marca</label><input name="brand" value={formData.brand || ''} onChange={handleInputChange} className="w-full border p-2 rounded" /></div>
                    <div><label className="text-sm font-bold text-slate-700">Modelo</label><input name="model" value={formData.model || ''} onChange={handleInputChange} className="w-full border p-2 rounded" /></div>
                    
                    <div>
                        <label className="text-sm font-bold text-slate-700">Serial</label>
                        <input name="serial_number" value={formData.serial_number || ''} onChange={handleInputChange} disabled={formData.quantity > 1} 
                            placeholder={formData.quantity > 1 ? "Bloqueado (Lote)" : ""} className="w-full border p-2 rounded disabled:bg-slate-100" />
                    </div>
                    
                    <div>
                        <label className="text-sm font-bold text-slate-700">Localização</label>
                        <input name="location" value={formData.location || ''} onChange={handleInputChange} placeholder="Ex: Sala 101, Recepção..." className="w-full border p-2 rounded" />
                    </div>

                    <div><label className="text-sm font-bold text-slate-700">Usuário / Responsável</label><input name="assigned_to" value={formData.assigned_to || ''} onChange={handleInputChange} className="w-full border p-2 rounded" /></div>

                    <div>
                        <label className="text-sm font-bold text-slate-700">Status</label>
                        <select name="status" value={formData.status} onChange={handleInputChange} className="w-full border p-2 rounded bg-white">
                            <option value="disponivel">Disponível</option><option value="uso">Em Uso</option><option value="manutencao">Manutenção</option><option value="defeito">Defeito</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-slate-700">Condição</label>
                        <select name="condition" value={formData.condition || 'novo'} onChange={handleInputChange} className="w-full border p-2 rounded bg-white">
                            <option value="novo">Novo</option><option value="bom">Bom</option><option value="ruim">Ruim</option>
                        </select>
                    </div>

                    <div className="md:col-span-2 pt-4 flex justify-end gap-3 border-t mt-2">
                      <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                        <Save className="mr-2 h-4 w-4" /> {editingId ? 'Salvar Alterações' : 'Criar Item'}
                      </Button>
                    </div>
                </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* MODAL DE CATEGORIAS */}
      <CategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
        onSave={handleAddCategory}
        onDelete={handleDeleteCategory}
        categories={categories}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {itemToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setItemToDelete(null)} />
          <Card className="relative z-10 w-full max-w-sm bg-white shadow-2xl animate-in zoom-in-95 border-none p-0 overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500 mb-6">Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setItemToDelete(null)} className="flex-1">Cancelar</Button>
                <Button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Sim, Excluir</Button>
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