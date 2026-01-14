import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Box, MapPin, User, Cpu, Hash, Wifi, Activity } from 'lucide-react';
import { PageWrapper, InfoRow, CardContent } from './Layout';

export const MachineView = ({ data }) => {
    const isOnline = data.status === 'online';
    
    return (
        <PageWrapper 
            borderColor="border-t-blue-500" 
            typeTitle={data.hostname}
            typeIcon={<Monitor className="w-5 h-5"/>}
        >
            <CardContent className="pt-6 px-5 space-y-6">
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-sm font-medium text-slate-500">Estado Atual</span>
                    <Badge className={`${isOnline ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} px-3 py-1 text-sm`}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </Badge>
                </div>

                <div className="space-y-1">
                    <InfoRow icon={<Hash className="w-5 h-5"/>} label="Endereço IP" value={data.ip_address} valueClass="font-mono text-blue-600" />
                    <InfoRow icon={<Cpu className="w-5 h-5"/>} label="Sistema Operacional" value={data.os_name} />
                    <InfoRow icon={<MapPin className="w-5 h-5"/>} label="Setor / Localização" value={data.sector || "Não definido"} />
                </div>

                {data.ram_usage && (
                    <div className="mt-4">
                         <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                                <Activity className="w-3 h-3" /> Memória RAM
                            </span>
                            <span className="text-sm font-bold text-slate-700">{data.ram_usage}%</span>
                         </div>
                         <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${data.ram_usage > 85 ? 'bg-red-500' : data.ram_usage > 60 ? 'bg-orange-400' : 'bg-blue-500'}`} 
                                style={{ width: `${data.ram_usage}%` }}
                            ></div>
                         </div>
                    </div>
                )}
            </CardContent>
        </PageWrapper>
    );
};

export const DeviceView = ({ data }) => {
    return (
        <PageWrapper 
            borderColor="border-t-orange-500" 
            typeTitle={data.model}
            typeIcon={<Smartphone className="w-5 h-5"/>}
        >
            <CardContent className="pt-6 px-5 space-y-6">
                 <div className="text-center py-4 bg-orange-50/50 rounded-xl border border-orange-100 border-dashed">
                    <p className="text-xs text-orange-400 font-bold uppercase tracking-widest mb-1">Identificação</p>
                    <p className="text-4xl font-black text-orange-500 tracking-tighter">#{data.name}</p>
                </div>

                <div className="space-y-1">
                    <InfoRow icon={<User className="w-5 h-5"/>} label="Status / Responsável" value={data.status?.toUpperCase()} />
                </div>

                <div className="flex justify-center pt-2">
                    <Badge variant="outline" className={`text-sm px-4 py-1.5 ${data.status === 'ativo' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-slate-500'}`}>
                        {data.status === 'ativo' ? '🟢 Dispositivo Ativo' : '⚪ Status Desconhecido'}
                    </Badge>
                </div>

            </CardContent>
        </PageWrapper>
    );
};
export const ItemView = ({ data }) => {
    return (
        <PageWrapper 
            borderColor="border-t-emerald-500" 
            typeTitle={data.name}
            typeIcon={<Box className="w-5 h-5"/>}
        >
            <CardContent className="pt-6 px-5 space-y-6">

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Patrimônio</p>
                        <p className="text-xl font-bold text-slate-800">{data.patrimony_code || "S/N"}</p>
                    </div>
                    {data.serial && (
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Serial</p>
                            <p className="text-sm font-mono text-slate-600">{data.serial}</p>
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <div className="mb-4 pb-4 border-b border-slate-50">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Detalhe do Item</p>
                        <p className="text-lg font-medium text-slate-700">{data.brand} {data.model}</p>
                    </div>

                    <InfoRow icon={<MapPin className="w-5 h-5"/>} label="Localização" value={data.location} />
                    <InfoRow icon={<User className="w-5 h-5"/>} label="Responsável" value={data.assigned_to || "Não atribuído"} />
                </div>

                <div className="pt-2">
                     <Badge className={`w-full justify-center py-1.5 text-sm capitalize ${data.status === 'uso' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-600'}`}>
                        {data.status === 'uso' ? 'Em Uso' : data.status?.replace('_', ' ') || '-'}
                    </Badge>
                </div>

            </CardContent>
        </PageWrapper>
    );
};