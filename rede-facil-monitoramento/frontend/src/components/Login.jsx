import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Mail, Loader2 } from 'lucide-react';
import axios from 'axios';

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
      const res = await axios.post('http://localhost:3001/auth/login', { 
        email, 
        password 
      });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user_name', res.data.user.name);
      
      onLoginSuccess(res.data.user);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900">
      <Card className="w-full max-w-md bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        <CardHeader className="space-y-1 flex flex-col items-center pb-2">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg">
             <span className="text-white font-bold text-xl">RF</span>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-slate-800">
            Acesso Restrito
          </CardTitle>
          <p className="text-sm text-slate-500">Rede Fácil - Sistema de Monitoramento</p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* EMAIL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input 
                  type="email" 
                  required
                  placeholder="admin@redefacil.com"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* SENHA */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                ⚠️ {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar no Sistema'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}