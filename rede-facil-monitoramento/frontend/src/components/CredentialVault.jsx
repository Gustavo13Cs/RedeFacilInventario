import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Eye, EyeOff, Copy, Plus, Lock, Smartphone, Mail, Server, Trash2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config'; 

// --- COMPONENTE: MODAL DE SUCESSO ---
const SuccessModal = ({ isOpen, title, message }) => {
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center px-4 py-6 sm:p-0">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
            <div className="relative z-10 transform overflow-hidden rounded-lg bg-white text-left shadow-2xl transition-all sm:w-full sm:max-w-sm animate-in fade-in zoom-in-95 duration-300">
                <div className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0">
                            <CheckCircle className="h-6 w-6 text-green-600 animate-pulse" />
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="text-lg font-bold text-slate-900 leading-6">{title}</h3>
                            <div className="mt-1"><p className="text-sm text-slate-500">{message}</p></div>
                        </div>
                    </div>
                </div>
                <div className="h-1 w-full bg-slate-100">
                    <div className="h-full bg-green-500 animate-[progress_3s_linear_forwards]" style={{width: '100%'}}></div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- COMPONENTE: MODAL DE CONFIRMAÇÃO ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <Trash2 className="h-6 w-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-500 mt-2 mb-6">{message}</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium">Cancelar</button>
                        <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-bold shadow-sm">Sim, excluir</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Lock className="text-blue-600" size={20}/> Nova Credencial</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
            <select 
              className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              <option value="EMAIL">E-mail Corporativo</option>
              <option value="DEVICE_PIN">PIN / Celular</option>
              <option value="SERVER">Servidor / Sistema</option>
              <option value="OTHER">Outros</option>
            </select>
          </div>


          {formData.category === 'DEVICE_PIN' && (
             <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 animate-in fade-in">
                <label className="block text-xs font-bold text-orange-700 uppercase mb-1 flex items-center gap-1">
                    <Smartphone size={14}/> Vincular a Celular (Opcional)
                </label>
                <select 
                    className="w-full border border-orange-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                    onChange={e => {
                        const id = e.target.value;
                        const asset = assets.find(a => a.id == id);
                        setFormData({
                            ...formData, 
                            related_asset_id: id,
                            name_identifier: asset ? `${asset.model} - ${asset.name}` : formData.name_identifier
                        })
                    }}
                >
                    <option value="">Selecione um aparelho do inventário...</option>
                    {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.model} ({a.name})</option>
                    ))}
                </select>
                <p className="text-[10px] text-orange-600 mt-1 ml-1">*Preenche automaticamente o identificador</p>
             </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Identificador (Nome/Dono)</label>
            <input required type="text" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Ex: joao@redefacil.com ou Samsung A10"
              value={formData.name_identifier}
              onChange={e => setFormData({...formData, name_identifier: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuário/Login (Opcional)</label>
            <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.login_user}
              onChange={e => setFormData({...formData, login_user: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha Real</label>
            <div className="relative">
                <input required type="text" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-slate-700" 
                placeholder="Digite a senha..."
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                />
                <Lock className="absolute right-3 top-2.5 text-slate-400" size={16}/>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><CheckCircle size={10}/> Criptografia AES-256 aplicada ao salvar.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm transition-colors">Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm shadow-md transition-all hover:shadow-lg">Salvar no Cofre</button>
          </div>
        </form>
      </div>
    </div>,
    document.body 
  );
};

export default function CredentialVault() {
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [assets, setAssets] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Modais States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '' });

  const [visiblePasswordId, setVisiblePasswordId] = useState(null);
  const [decryptedPassword, setDecryptedPassword] = useState('');

  useEffect(() => {
    fetchCredentials();
    fetchDevices(); 
  }, []);

  const fetchDevices = async () => {
    try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/devices`, {
             headers: { Authorization: `Bearer ${token}` }
        });
        setAssets(res.data);
    } catch (error) {
        console.error("Erro ao buscar devices para vinculo", error);
    }
  };

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
        
        // Alerta Bonito
        setSuccessModal({
            isOpen: true,
            title: 'Senha Protegida!',
            message: 'A credencial foi criptografada e salva no cofre com sucesso.'
        });
        setTimeout(() => setSuccessModal({ isOpen: false, title: '', message: '' }), 3000);

    } catch (error) {
        alert("Erro ao salvar."); // Fallback
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

  const confirmDelete = async () => {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/credentials/${deleteModal.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setDeleteModal({ isOpen: false, id: null });
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
      
      {/* HEADER */}
      <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Lock className="text-blue-600"/> Cofre Digital
            </h1>
            <p className="text-slate-500 text-sm mt-1">Gerenciamento seguro de senhas, PINs e acessos da unidade.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-all hover:shadow-md active:scale-95"
          >
            <Plus size={18} /> Adicionar Senha
          </button>
      </div>

      <hr className="border-slate-200"/>

      {/* FILTROS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
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

      {/* TABELA */}
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
                            <div className="flex items-center gap-2 animate-in fade-in">
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200 select-all font-bold">
                                    {decryptedPassword}
                                </span>
                            </div>
                        ) : (
                            <span className="text-slate-400 tracking-widest text-xs">●●●●●●●●●●</span>
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
                                onClick={() => {
                                    navigator.clipboard.writeText(decryptedPassword);
                                    setSuccessModal({isOpen: true, title: 'Copiado!', message: 'Senha copiada para a área de transferência.'});
                                    setTimeout(() => setSuccessModal({isOpen: false, title: '', message: ''}), 2000);
                                }}
                                className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-md"
                                title="Copiar Senha"
                            >
                                <Copy size={18}/>
                            </button>
                        )}
                        
                        <button 
                            onClick={() => setDeleteModal({ isOpen: true, id: cred.id })}
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

      <ConfirmModal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Excluir Credencial?"
        message="Esta ação é irreversível. A senha será apagada permanentemente do cofre."
      />

      <SuccessModal 
        isOpen={successModal.isOpen}
        title={successModal.title}
        message={successModal.message}
      />
    </div>
  );
}