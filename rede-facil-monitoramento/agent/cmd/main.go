package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io" 
	"log"
	"net" 
	"net/http"
	"os"
	"os/user"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

// --- CONFIGURAÇÃO ---
const API_BASE_URL = "http://localhost:3001/api" // Usando a porta mapeada do Docker
const TELEMETRY_INTERVAL = 5 * time.Second 

// NOVAS CONSTANTES PARA RESILIÊNCIA DE REDE
const MAX_RETRIES = 3              // Número máximo de tentativas de envio
const RETRY_DELAY = 10 * time.Second // Atraso entre as tentativas

var GlobalMachineIP string 

type MachineInfo struct {
	UUID string `json:"uuid"`
	Hostname string `json:"hostname"`
	IPAddress string `json:"ip_address"`
	OSName string `json:"os_name"`
	CPUModel string `json:"cpu_model"`
	RAMTotalGB float64 `json:"ram_total_gb"`
	DiskTotalGB float64 `json:"disk_total_gb"`
	MACAddress string `json:"mac_address"` 
	InstalledSoftware []Software `json:"installed_software"`
}

type Software struct {
	Name string `json:"name"`
	Version string `json:"version"`
}

type TelemetryData struct {
	UUID string `json:"uuid"`
	CPUUsagePercent float64 `json:"cpu_usage_percent"`
	RAMUsagePercent float64 `json:"ram_usage_percent"`
	DiskFreePercent float64 `json:"disk_free_percent"`
	DiskSmartStatus string `json:"disk_smart_status"` 
	TemperatureCelsius float64 `json:"temperature_celsius"` 
}

type RegistrationResponse struct {
	Message string `json:"message"`
	MachineIP string `json:"ip_address"`
}

// --- FUNÇÕES DE UTILIDADE E COLETA ---

func getLocalIP() string {
	ifaces, err := net.Interfaces()
	if err != nil { return "N/A" }
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 { continue }
		addrs, err := iface.Addrs()
		if err != nil { continue }
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet: ip = v.IP
			case *net.IPAddr: ip = v.IP
			}
			if ip != nil && ip.To4() != nil && !ip.IsLoopback() { return ip.String() }
		}
	}
	return "N/A"
}

func getMachineUUID() string {
	h, _ := os.Hostname()
	u, err := user.Current()
	username := "unknown"
	if err == nil && u != nil {
		username = u.Username
	}
	return fmt.Sprintf("%s-%s", h, username)
}

func collectStaticInfo() MachineInfo {
	hInfo, _ := host.Info()
	mInfo, _ := mem.VirtualMemory()
	cInfos, _ := cpu.Info()
	dPartitions, _ := disk.Partitions(false)
	
	cpuModel := "N/A"
	if len(cInfos) > 0 { cpuModel = cInfos[0].ModelName }

	var diskTotalGB float64
	rootPath := "/"
	if runtime.GOOS == "windows" { rootPath = "C:\\" }
	
	dUsage, err := disk.Usage(rootPath)
	if err == nil {
		diskTotalGB = float64(dUsage.Total) / (1024 * 1024 * 1024)
	} else if len(dPartitions) > 0 {
		dUsage, _ := disk.Usage(dPartitions[0].Mountpoint)
		diskTotalGB = float64(dUsage.Total) / (1024 * 1024 * 1024)
	}

	return MachineInfo{
		UUID: getMachineUUID(),
		Hostname: hInfo.Hostname,
		IPAddress: getLocalIP(),
		OSName: fmt.Sprintf("%s %s", hInfo.OS, hInfo.Platform),
		CPUModel: cpuModel,
		RAMTotalGB: float64(mInfo.Total) / (1024 * 1024 * 1024),
		DiskTotalGB: diskTotalGB,
		MACAddress: "00:00:00:00:00:00",
		InstalledSoftware: []Software{{Name: "Agente Go", Version: "2.0"}},
	}
}

func collectTelemetryData() TelemetryData {
	// CPU
	cpuPercents, _ := cpu.Percent(0, false) 
	cpuUsage := 0.0
	if len(cpuPercents) > 0 { cpuUsage = cpuPercents[0] }

	// RAM
	mInfo, _ := mem.VirtualMemory()
	ramUsage := mInfo.UsedPercent

	// DISCO (Livre %)
	diskUsageFree := 0.0
	rootPath := "/" 
	if runtime.GOOS == "windows" { rootPath = "C:\\" }
	
	dUsage, err := disk.Usage(rootPath)
	if err == nil {
		diskUsageFree = 100.0 - dUsage.UsedPercent
	} else {
		log.Printf("⚠️ Erro disco: %v", err)
	}
	
	// TEMPERATURA
	temperature := getCPUTemperature() 

	return TelemetryData{
		UUID: getMachineUUID(),
		CPUUsagePercent: cpuUsage,
		RAMUsagePercent: ramUsage,
		DiskFreePercent: diskUsageFree,
		DiskSmartStatus: "OK",
		TemperatureCelsius: temperature,
	}
}

func getCPUTemperature() float64 {
	sensors, err := host.SensorsTemperatures()
	if err != nil { return 0.0 }
	var totalTemp float64
	var count int
	for _, sensor := range sensors {
		if sensor.SensorKey == "coretemp" || sensor.SensorKey == "cpu-fan" || count == 0 {
			totalTemp += sensor.Temperature
			count++
		}
	}
	if count > 0 { return totalTemp / float64(count) }
	return 0.0
}


// --- FUNÇÃO CENTRAL DE ENVIO DE DADOS COM RETRY ---

func postData(endpoint string, data interface{}) {
	jsonValue, err := json.Marshal(data)
	if err != nil {
		log.Printf("Erro ao serializar JSON para %s: %v", endpoint, err)
		return
	}

	url := fmt.Sprintf("%s%s", API_BASE_URL, endpoint)
	client := http.Client{Timeout: 5 * time.Second}
	
	for i := 0; i < MAX_RETRIES; i++ {
		log.Printf("Tentativa %d de %d para %s...", i+1, MAX_RETRIES, endpoint)

		resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))
		
		// 1. Erro de Rede ou Timeout
		if err != nil {
			log.Printf("❌ Erro de rede/conexão na Tentativa %d para %s: %v", i+1, endpoint, err)
			
			if i < MAX_RETRIES-1 {
				time.Sleep(RETRY_DELAY) 
				continue 
			} else {
				log.Printf("❌ FALHA CRÍTICA: Todas as %d tentativas falharam para %s.", MAX_RETRIES, endpoint)
				return // Falha definitiva
			}
		}
		
		defer resp.Body.Close()

		// 2. Resposta de Sucesso da API (Status 2xx)
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			log.Printf("✅ Dados enviados com sucesso para %s (Status: %s).", endpoint, resp.Status)
			return // Sucesso, sai da função
		}

		// 3. Resposta de Erro da API (Status 5xx)
		// Faz retry se for um erro de servidor (5xx)
		if resp.StatusCode >= 500 {
			log.Printf("⚠️ Erro de Servidor na Tentativa %d para %s. Status: %s", i+1, endpoint, resp.Status)
			
			if i < MAX_RETRIES-1 {
				time.Sleep(RETRY_DELAY) 
				continue
			} else {
				log.Printf("❌ FALHA FINAL: Erro de Servidor não recuperável após %d tentativas para %s.", MAX_RETRIES, endpoint)
				return
			}
		}
		
		// 4. Erros 4xx (Como 400 Bad Request ou 404 Not Found)
		// Erros do cliente (4xx) são fatais e não devem ser repetidos
		log.Printf("⚠️ Erro da API não recuperável (Status %s) para %s.", resp.Status, endpoint)
		return 
	}
}


// --- FUNÇÃO DE REGISTRO COM RETRY E CAPTURA DE IP ---
// Esta função é separada do postData apenas para tratar o corpo da resposta de registro.
func registerMachine(info MachineInfo) {
	url := fmt.Sprintf("%s/machines/register", API_BASE_URL)
	client := http.Client{Timeout: 5 * time.Second}
	
	jsonValue, _ := json.Marshal(info)

	for i := 0; i < MAX_RETRIES; i++ {
		log.Printf("Tentativa %d de %d para Registro...", i+1, MAX_RETRIES)

		resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))
		
		if err != nil {
			log.Printf("❌ Erro de rede/conexão: %v", err)
			if i < MAX_RETRIES-1 {
				time.Sleep(RETRY_DELAY)
				continue
			} else {
				log.Printf("❌ FALHA CRÍTICA: Registro falhou após %d tentativas.", MAX_RETRIES)
				return
			}
		}
		
		defer resp.Body.Close()
		
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			body, _ := io.ReadAll(resp.Body)
			var regResponse RegistrationResponse
			json.Unmarshal(body, &regResponse)
			
			GlobalMachineIP = regResponse.MachineIP 
			log.Printf("✅ Máquina registrada! IP: %s (Status: %s)", GlobalMachineIP, resp.Status)
			return // Sucesso
		}
		
		if resp.StatusCode >= 400 {
			log.Printf("⚠️ Erro da API Registro (Não Recuperável): %s", resp.Status)
			return // Erro 4xx/5xx é tratado como falha definitiva aqui.
		}

		// Se não for sucesso e não for 4xx/5xx direto, espera e tenta (caso de redirecionamentos ou 5xx temporários)
		if i < MAX_RETRIES-1 {
			time.Sleep(RETRY_DELAY)
			continue
		} else {
			log.Printf("❌ FALHA CRÍTICA: Registro falhou após %d tentativas.", MAX_RETRIES)
			return
		}
	}
}


// --- MAIN ---

func main() {
	log.Println("🔥 Agente Rede Fácil v2 - Iniciando...")

	// 1. Registro Inicial (com retry)
	info := collectStaticInfo()
	registerMachine(info)

	// 2. Loop de Telemetria Contínua
	ticker := time.NewTicker(TELEMETRY_INTERVAL)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			data := collectTelemetryData()
			
			log.Printf("📤 Stats -> HD Livre: %.1f%% | CPU: %.1f%% | RAM: %.1f%%", 
				data.DiskFreePercent, data.CPUUsagePercent, data.RAMUsagePercent)
			// Envia dados para o endpoint /api/telemetry (com retry)
			postData("/telemetry", data)
		}
	}
}