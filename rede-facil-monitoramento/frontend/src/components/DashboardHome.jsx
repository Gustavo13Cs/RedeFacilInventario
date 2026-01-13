import React from 'react';
import { Server, Activity, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function DashboardHome({ stats, searchTerm, machinesBySector, handleMachineClick, getStatusBadgeVariant, getStatusBadgeClass }) {
  
  if (Object.keys(machinesBySector).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Server className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg">Nenhuma máquina encontrada.</p>
        {searchTerm && <p className="text-sm">Tente buscar por outro termo.</p>}
      </div>
    );
  }

  return (
    <>
      {!searchTerm && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in slide-in-from-top-4 duration-500">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total de Máquinas</CardTitle>
              <Server className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              <p className="text-xs text-slate-500">Registradas na base</p>
            </CardContent>
          </Card>
          
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Online Agora</CardTitle>
                  <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">{stats.online}</div>
                  <p className="text-xs text-emerald-600/80">Ativas em tempo real</p>
              </CardContent>
          </Card>
        </div>
      )}
      
      <div className="space-y-8 mt-6">
        {Object.entries(machinesBySector).map(([sector, sectorMachines]) => (
          <div key={sector} className="animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <Building2 className="w-5 h-5 text-blue-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">{sector}</h3>
                <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600">
                  {sectorMachines.length} Ativos
                </Badge>
            </div>

            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Hostname</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Sistema Operacional</TableHead>
                      <TableHead>Hardware (CPU)</TableHead>
                      <TableHead className="text-right">Memória</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectorMachines.map((machine) => (
                      <TableRow 
                          key={machine.uuid} 
                          className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                          onClick={() => handleMachineClick(machine)} 
                      >
                        <TableCell>
                          <Badge 
                            variant={getStatusBadgeVariant(machine.status)} 
                            className={`${getStatusBadgeClass(machine.status)} font-bold border shadow-none`}
                          >
                            {machine.status === 'critical' ? 'CRÍTICO' : 
                              machine.status === 'warning' ? 'ALERTA' : 
                              machine.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700">{machine.hostname}</TableCell>
                        <TableCell className="text-slate-500 font-mono text-xs">{machine.ip_address}</TableCell>
                        <TableCell className="text-slate-600">{machine.os_name}</TableCell>
                        <TableCell className="text-slate-500 text-xs max-w-[200px] truncate" title={machine.cpu_model}>
                          {machine.cpu_model}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-600">
                          {machine.ram_total_gb ? `${machine.ram_total_gb} GB` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}