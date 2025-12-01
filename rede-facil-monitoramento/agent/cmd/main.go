package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/user"
	"runtime"
	"strconv"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

// --- CONFIGURAÇÃO ---
// *ATENÇÃO: Substitua pelo endereço IP real do seu servidor Node.js/API*
const API_BASE_URL = "http://localhost:3000/api" // Exemplo: "http://192.168.1.100:3000/api"
const TELEMETRY_INTERVAL = 60 * time.Second // Envio de telemetria a cada 60 segundos

// --- ESTRUTURAS DE DADOS ---

// MachineInfo representa os dados estáticos de inventário para registro (POST /api/machines/register)
type MachineInfo struct {
	UUID              string `json:"uuid"`
	Hostname          string `json:"hostname"`
	IPAddress         string `json:"ip_address"` // Simplificado: IP local, pode requerer lógica de rede mais complexa
	OSName            string `json:"os_name"`
	CPUModel          string `json:"cpu_model"`
	RAMTotalGB        float64 `json:"ram_total_gb"`
	DiskTotalGB       float64 `json:"disk_total_gb"`
	MACAddress        string `json:"mac_address"` // Simplificado
	InstalledSoftware []Software `json:"installed_software"`
}

// Software representa um item da lista de software instalado
type Software struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// TelemetryData representa as métricas dinâmicas para monitoramento (POST /api/telemetry)
type TelemetryData struct {
	UUID              string  `json:"uuid"`
	CPUUsagePercent   float64 `json:"cpu_usage_percent"`
	RAMUsagePercent   float64 `json:"ram_usage_percent"`
	DiskFreePercent   float64 `json:"disk_free_percent"`
	TemperatureCelsius float64 `json:"temperature_celsius"` // Opcional
}

// --- FUNÇÕES DE COLETA DE DADOS ---

// getMachineUUID simula a obtenção de um UUID persistente.
// Em um agente real, você deve salvar este UUID em um arquivo local e carregá-lo.
func getMachineUUID() string {
	// Usamos o hostname + nome do usuário como um "UUID" simples para esta demonstração.
	// Em produção, use uma biblioteca UUID real e persista o valor.
	h, _ := os.Hostname()
	u, _ := user.Current()
	return fmt.Sprintf("%s-%s", h, u.Username)
}

// collectStaticInfo coleta dados de hardware e inventário para o registro.
func collectStaticInfo() MachineInfo {
	hInfo, _ := host.Info()
	mInfo, _ := mem.VirtualMemory()
	cInfos, _ := cpu.Info()
	dPartitions, _ := disk.Partitions(false)
	
	// Coleta dados da primeira CPU (simples)
	cpuModel := "N/A"
	if len(cInfos) > 0 {
		cpuModel = cInfos[0].ModelName
	}

	// Coleta dados do disco primário (simples, assume a primeira partição)
	var diskTotalGB float64
	if len(dPartitions) > 0 {
		dUsage, _ := disk.Usage(dPartitions[0].Mountpoint)
		diskTotalGB = float64(dUsage.Total) / (1024 * 1024 * 1024)
	}

	// OBS: A coleta de IP, MAC e Software requer bibliotecas mais complexas ou APIs específicas do OS.
	// Aqui estão simuladas/simplificadas.
	return MachineInfo{
		UUID:              getMachineUUID(),
		Hostname:          hInfo.Hostname,
		IPAddress:         "192.168.x.x", // Simulado
		OSName:            fmt.Sprintf("%s %s", hInfo.OS, hInfo.Platform),
		CPUModel:          cpuModel,
		RAMTotalGB:        float64(mInfo.Total) / (1024 * 1024 * 1024),
		DiskTotalGB:       diskTotalGB,
		MACAddress:        "00:1A:2B:3C:4D:5E", // Simulado
		InstalledSoftware: []Software{
			{Name: "MS Office", Version: "2019"},
			{Name: "Antivirus Pro", Version: "5.2"},
		},
	}
}

// collectTelemetryData coleta as métricas de performance em tempo real.
func collectTelemetryData() TelemetryData {
	// 1. Uso de CPU
	cpuPercents, _ := cpu.Percent(0, false) // 0s intervalo, false para uso agregado
	cpuUsage := 0.0
	if len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}

	// 2. Uso de RAM
	mInfo, _ := mem.VirtualMemory()
	ramUsage := mInfo.UsedPercent

	// 3. Espaço Livre em Disco (Assumindo C: ou / como primário)
	diskUsage := 0.0
	// Detecta a raiz do sistema operacional
	rootPath := "/" 
	if runtime.GOOS == "windows" {
		rootPath = "C:\\"
	}
	
	dUsage, err := disk.Usage(rootPath)
	if err == nil {
		diskUsage = 100.0 - dUsage.UsedPercent
	} else {
		log.Printf("Erro ao coletar uso do disco em %s: %v", rootPath, err)
	}
	
	// 4. Temperatura (Não suportado nativamente pelo gopsutil, simulado)
	temperature := 45.5

	return TelemetryData{
		UUID:              getMachineUUID(),
		CPUUsagePercent:   cpuUsage,
		RAMUsagePercent:   ramUsage,
		DiskFreePercent:   diskUsage,
		TemperatureCelsius: temperature,
	}
}

// --- FUNÇÃO DE COMUNICAÇÃO HTTP ---

// postData envia dados via HTTP POST para a API.
func postData(endpoint string, data interface{}) {
	jsonValue, err := json.Marshal(data)
	if err != nil {
		log.Printf("Erro ao serializar JSON para %s: %v", endpoint, err)
		return
	}

	url := fmt.Sprintf("%s%s", API_BASE_URL, endpoint)
	
	// Timeout curto para não travar o Agente
	client := http.Client{Timeout: 5 * time.Second}
	
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))
	if err != nil {
		log.Printf("❌ Erro ao enviar POST para %s: %v", url, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("⚠️ Erro da API em %s. Status: %s", endpoint, resp.Status)
	} else {
		log.Printf("✅ Dados enviados com sucesso para %s.", endpoint)
	}
}

// --- MAIN ---

func main() {
	log.Println("🔥 Agente Cliente Rede Fácil Financeira - Inicializando...")

	// 1. REGISTRO INICIAL (Se for a primeira vez)
	machineInfo := collectStaticInfo()
	log.Println("Tentando registrar/atualizar máquina com UUID:", machineInfo.UUID)
	postData("/machines/register", machineInfo)

	// 2. LOOP DE TELEMETRIA CONTÍNUA
	ticker := time.NewTicker(TELEMETRY_INTERVAL)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			telemetry := collectTelemetryData()
			log.Println("Enviando telemetria:", 
				strconv.FormatFloat(telemetry.CPUUsagePercent, 'f', 2, 64), 
				"% CPU")
			postData("/telemetry", telemetry)
		}
	}
}