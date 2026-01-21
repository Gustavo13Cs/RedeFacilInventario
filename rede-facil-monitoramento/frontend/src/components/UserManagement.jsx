import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Users, Mail, Key, X, Save, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from 'axios';
import { API_URL } from '../config';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'admin'
  });

  const baseUrl = API_URL.replace('/api', '');
  const AUTH_API = `${baseUrl}/auth`;

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(AUTH_API, getAuthHeaders());
      setUsers(res.data);
    } catch (error) { 
        console.error("Erro ao buscar usuários:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${AUTH_API}/register`, formData, getAuthHeaders());
      fetchUsers();
      closeForm();
      setShowSuccessModal(true); 
    } catch (error) {
      const msg = error.response?.data?.message || "Erro desconhecido ao criar usuário.";
      setErrorModal(msg);
    }
  };

  const requestDelete = (user) => { setUserToDelete(user); };

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        await axios.delete(`${AUTH_API}/${userToDelete.id}`, getAuthHeaders());
        fetchUsers(); 
        setUserToDelete(null); 
      } catch (error) { console.error("Erro ao deletar:", error); alert("Erro ao excluir usuário."); }
    }
  };

  const closeForm = () => { setIsFormOpen(false); setFormData({ name: '', email: '', password: '', role: 'admin' }); };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-600" /> Gestão de Acessos
            </h2>
            <p className="text-slate-500 text-sm">Gerencie quem pode acessar o sistema da Rede Fácil.</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md gap-2">
            <Plus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table className="min-w-[800px]">
                <TableHeader>
                <TableRow className="bg-slate-50">
                    <TableHead className="whitespace-nowrap">Nome</TableHead>
                    <TableHead className="whitespace-nowrap">E-mail</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="whitespace-nowrap">Data Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {users.map((user) => (
                    <TableRow key={user.id}>
                    <TableCell className="font-medium text-slate-900 whitespace-nowrap">{user.name}</TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">{user.email}</TableCell>
                    <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                            {user.role}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs whitespace-nowrap">
                        {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => requestDelete(user)} className="text-red-500 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      
      {isFormOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"> 
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <Card className="relative z-10 w-full max-w-md animate-in zoom-in-95 bg-white border-none shadow-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-100 bg-white sticky top-0 z-20 flex flex-row justify-between items-center">
                <CardTitle>Novo Usuário</CardTitle>
                <button onClick={closeForm}><X className="h-5 w-5 text-slate-400" /></button>
            </CardHeader>
            <CardContent className="pt-6 bg-white rounded-b-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Completo</label>
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: João Silva" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail de Acesso</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full border border-slate-300 rounded-md pl-9 p-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="usuario@redefacil.com" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Senha</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input type="password" name="password" value={formData.password} onChange={handleInputChange} required className="w-full border border-slate-300 rounded-md pl-9 p-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Cargo / Permissão</label>
                        <select name="role" value={formData.role} onChange={handleInputChange} className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                            <option value="admin">Administrador (Acesso Total)</option>
                            <option value="suporte">Suporte (Visualização Geral)</option>
                            <option value="viewer">Visualizador (Apenas Máquinas)</option>
                        </select>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <Button type="button" variant="outline" onClick={closeForm} className="w-full sm:w-auto">Cancelar</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"><Save className="mr-2 h-4 w-4" /> Criar Usuário</Button>
                    </div>
                </form>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
      
      {userToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setUserToDelete(null)} />
          <Card className="relative z-10 w-full max-w-sm bg-white shadow-2xl animate-in zoom-in-95 duration-200 border-none p-0 overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Remover Usuário?</h3>
              <p className="text-sm text-slate-500 mb-4">Você está prestes a remover o acesso de: <br/><strong>{userToDelete.name}</strong></p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setUserToDelete(null)} className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50">Cancelar</Button>
                <Button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-sm font-medium">Sim, Remover</Button>
              </div>
            </div>
          </Card>
        </div>,
        document.body
      )}

      {showSuccessModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowSuccessModal(false)} />
          <Card className="relative z-10 w-full max-w-sm bg-white shadow-2xl animate-in zoom-in-95 duration-200 border-none p-0 overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4"><CheckCircle className="h-8 w-8 text-emerald-600" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Sucesso!</h3>
              <Button onClick={() => setShowSuccessModal(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm h-11">Entendido</Button>
            </div>
            <div className="h-1.5 w-full bg-emerald-500" />
          </Card>
        </div>,
        document.body
      )}

      {errorModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setErrorModal(null)} />
          <Card className="relative z-10 w-full max-w-sm bg-white shadow-2xl animate-in zoom-in-95 duration-200 border-none p-0 overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><XCircle className="h-8 w-8 text-red-600" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Atenção</h3>
              <p className="text-sm text-slate-500 mb-6 px-2">{errorModal}</p>
              <Button onClick={() => setErrorModal(null)} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm h-11">Tentar Novamente</Button>
            </div>
            <div className="h-1.5 w-full bg-red-500" />
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}