import React, { useState, useEffect } from 'react';
import { Search, Eye, EyeOff, Copy, Plus, Lock, Smartphone, Mail, Server, Trash2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config'; 

const AddCredentialModal = ({ isOpen, onClose, onSave, assets }) => {
  const [formData, setFormData] = useState({
    category: 'EMAIL',
    name_identifier: '',
    login_user: '',
    password: '',
    related_asset_id: '',
    notes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    setFormData({ category: 'EMAIL', name_identifier: '', login_user: '', password: '', related_asset_id: '', notes: '' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lock size={20}/> Nova Credencial</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          
          <div>
            <label className="block text-sm font-medium">Categoria</label>
            <select 
              className="w-full border p-2 rounded"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              <option value="EMAIL">E-mail Corporativo</option>
              <option value="DEVICE_PIN">PIN / Celular</option>
              <option value="SERVER">Servidor / Sistema</option>
              <option value="OTHER">Outros</option>
            </select>
          </div>

          {/* Lógica de Vínculo com Celular existente */}
          {formData.category === 'DEVICE_PIN' && (
             <div>
                <label className="block text-sm font-medium text-orange-600">Vincular a Celular (Opcional)</label>
                <select 
                    className="w-full border p-2 rounded border-orange-200"
                    onChange={e => {
                        const id = e.target.value;
                        const asset = assets.find(a => a.id == id);
                        setFormData({
                            ...formData, 
                            related_asset_id: id,
                            name_identifier: asset ? `${asset.modelo} - ${asset.numero}` : formData.name_identifier
                        })
                    }}
                >
                    <option value="">Selecione um aparelho...</option>
                    {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.modelo} ({a.responsavel})</option>
                    ))}
                </select>
             </div>
          )}

          <div>
            <label className="block text-sm font-medium">Identificador (Nome/Dono)</label>
            <input required type="text" className="w-full border p-2 rounded" 
              placeholder="Ex: joao@redefacil.com ou Samsung A10"
              value={formData.name_identifier}
              onChange={e => setFormData({...formData, name_identifier: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Usuário/Login (Opcional)</label>
            <input type="text" className="w-full border p-2 rounded" 
              value={formData.login_user}
              onChange={e => setFormData({...formData, login_user: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Senha</label>
            <input required type="text" className="w-full border p-2 rounded bg-slate-50" 
              placeholder="Digite a senha real..."
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
            <p className="text-xs text-slate-400 mt-1">Será criptografada antes de salvar.</p>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar no Cofre</button>
          </div>
        </form>
      </div>
    </div>
  );
};


export default function CredentialVault() {
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [visiblePasswordId, setVisiblePasswordId] = useState(null);
  const [decryptedPassword, setDecryptedPassword] = useState('');

  const [assets, setAssets] = useState([
     {id: 1, modelo: 'Samsung S20', numero: '9999-8888', responsavel: 'Diretoria'},
     {id: 2, modelo: 'iPhone 11', numero: '7777-6666', responsavel: 'Comercial'}
  ]);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/credentials`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setCredentials(res.data);
        setLoading(false);
    } catch (error) {
        console.error("Erro ao buscar credenciais", error);
        setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
        const token = localStorage.getItem('token');
        await axios.post(`${API_URL}/credentials`, data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setIsModalOpen(false);
        fetchCredentials(); 
        alert("Senha salva com sucesso!");
    } catch (error) {
        alert("Erro ao salvar.");
    }
  };

  const handleReveal = async (id) => {
      if (visiblePasswordId === id) {
          setVisiblePasswordId(null);
          setDecryptedPassword('');
          return;
      }

      try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_URL}/credentials/${id}/reveal`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setDecryptedPassword(res.data.password);
          setVisiblePasswordId(id);
      } catch (error) {
          alert("Erro ao descriptografar ou permissão negada.");
      }
  };

  const handleDelete = async (id) => {
      if(!window.confirm("Tem certeza? Essa ação não pode ser desfeita.")) return;
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/credentials/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        fetchCredentials();
      } catch (e) { alert("Erro ao deletar"); }
  };

  const filteredData = credentials.filter(cred => {
    const typeMatch = filterType === 'ALL' || cred.category === filterType;
    const searchMatch = cred.name_identifier.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (cred.login_user && cred.login_user.toLowerCase().includes(searchTerm.toLowerCase()));
    return typeMatch && searchMatch;
  });

  const getIcon = (cat) => {
      if (cat === 'EMAIL') return <Mail size={16} />;
      if (cat === 'DEVICE_PIN') return <Smartphone size={16} />;
      if (cat === 'SERVER') return <Server size={16} />;
      return <Lock size={16} />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* --- HEADER --- */}
      <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Lock className="text-blue-600"/> Cofre Digital
            </h1>
            <p className="text-slate-500 text-sm mt-1">Gerenciamento seguro de senhas, PINs e acessos da unidade.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            <Plus size={18} /> Adicionar Senha
          </button>
      </div>

      <hr className="border-slate-200"/>

      {/* --- FILTROS --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
        
        {/* Abas */}
        <div className="flex bg-slate-200/50 p-1 rounded-lg">
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'EMAIL', label: 'E-mails' },
            { id: 'DEVICE_PIN', label: 'Celulares/PINs' },
            { id: 'SERVER', label: 'Servidores' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                filterType === tab.id 
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome..." 
              className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-full shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* --- TABELA --- */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Identificação</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuário</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Senha</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">Carregando cofre...</td></tr>
            ) : filteredData.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
            ) : (
                filteredData.map(cred => (
                <tr key={cred.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            cred.category === 'EMAIL' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            cred.category === 'DEVICE_PIN' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                            {getIcon(cred.category)} {cred.category === 'DEVICE_PIN' ? 'Celular' : cred.category}
                        </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                        {cred.name_identifier}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                        {cred.login_user || '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">
                        {visiblePasswordId === cred.id ? (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200 select-all">
                                {decryptedPassword}
                            </span>
                        ) : (
                            <span className="text-slate-400 tracking-widest">•••••••••</span>
                        )}
                    </td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                        <button 
                            onClick={() => handleReveal(cred.id)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title={visiblePasswordId === cred.id ? "Ocultar" : "Revelar Senha"}
                        >
                            {visiblePasswordId === cred.id ? <EyeOff size={18}/> : <Eye size={18}/>}
                        </button>
                        
                        {visiblePasswordId === cred.id && (
                            <button 
                                onClick={() => navigator.clipboard.writeText(decryptedPassword)}
                                className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-md"
                                title="Copiar Senha"
                            >
                                <Copy size={18}/>
                            </button>
                        )}
                        
                        <button 
                            onClick={() => handleDelete(cred.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md ml-2"
                            title="Excluir"
                        >
                            <Trash2 size={18}/>
                        </button>
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      <AddCredentialModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleCreate} 
        assets={assets}
      />
    </div>
  );
}