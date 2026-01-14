import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const PageWrapper = ({ children, borderColor, typeTitle, typeIcon }) => (
    <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-[#0f172a] pt-8 pb-20 px-6 rounded-b-[30px] shadow-lg relative z-0">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-blue-900/50 shadow-lg">
                        RF
                     </div>
                     <span className="text-white font-bold tracking-wide">REDE FÁCIL</span>
                </div>
                <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm text-white border border-white/10">
                    {typeIcon}
                </div>
            </div>
            
            <h2 className="text-white/60 text-sm font-semibold uppercase tracking-wider pl-1">
                Detalhes do Ativo
            </h2>
            <h1 className="text-white text-2xl font-bold pl-1 mt-1">
                {typeTitle}
            </h1>
        </div>

        <div className="px-4 -mt-12 relative z-10 flex-1 pb-6">
            <Card className={`border-0 border-t-4 ${borderColor} shadow-xl rounded-xl bg-white overflow-hidden`}>
                {children}
            </Card>
            
            <p className="text-center text-slate-300 text-xs mt-6">
                Rede Fácil • Monitoramento de Ativos
            </p>
        </div>
    </div>
);

export const InfoRow = ({ icon, label, value, valueClass = "text-slate-800 text-base" }) => (
    <div className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
        <div className="flex-shrink-0 h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
            {icon}
        </div>
        <div className="flex-1 min-w-0"> 
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{label}</p>
            <p className={`font-semibold leading-tight truncate ${valueClass}`}>{value || "N/A"}</p>
        </div>
    </div>
);

export { CardHeader, CardContent };