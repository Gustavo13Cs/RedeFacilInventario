import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Mail, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const baseUrl = API_URL.endsWith('/api') ? API_URL.replace('/api', '') : API_URL;
      
      const res = await axios.post(`${baseUrl}/auth/login`, { 
        email, 
        password 
      });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user_name', res.data.user.name);
      localStorage.setItem('user_role', res.data.user.role);
      
      onLoginSuccess(res.data.user);
      
    } catch (err) {
      console.error("Erro de Login:", err);
      const msg = err.response?.data?.message || 'Erro ao conectar ao servidor. Verifique se o backend está rodando.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-slate-800 bg-white relative z-10">
        <CardHeader className="space-y-1 items-center pb-2">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-2 shadow-lg shadow-blue-900/20">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-slate-800">Rede Fácil</CardTitle>
          <p className="text-sm text-slate-500 text-center">Gestão de Ativos & Segurança</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4 pt-4">
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input 
                  type="email" 
                  required
                  placeholder="seu.nome@redefacil.com"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 transition-colors"
              disabled={loading}
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando Credenciais...</> : 'Acessar Painel'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t bg-slate-50 p-4 rounded-b-xl">
            <div className="flex items-center gap-2 justify-center text-xs text-slate-500">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                <span>Ambiente Monitorado e Seguro</span>
            </div>
            <p className="text-[10px] text-slate-400 text-center leading-tight">
                Este sistema coleta logs de acesso para auditoria e conformidade com a LGPD. 
                O uso indevido é passível de sanções administrativas.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}