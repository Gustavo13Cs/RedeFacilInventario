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
	"os/exec" // Importação necessária para executar comandos do sistema
	"runtime"
	"strings"
	"time"
	"path/filepath"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

const BACKUP_FOLDER_PATH = "C:\\Users\\Windows 10\\Documents\\backup_agente"
const API_BASE_URL = "http://localhost:3001/api"
const TELEMETRY_INTERVAL = 5 * time.Second

const MAX_RETRIES = 3
const RETRY_DELAY = 10 * time.Second

var GlobalMachineIP string

type MachineInfo struct {
	UUID              string     `json:"uuid"`
	Hostname          string     `json:"hostname"`
	IPAddress         string     `json:"ip_address"`
	OSName            string     `json:"os_name"`
	CPUModel          string     `json:"cpu_model"`
	RAMTotalGB        float64    `json:"ram_total_gb"`
	DiskTotalGB       float64    `json:"disk_total_gb"`
	MACAddress        string     `json:"mac_address"`
	// 🚨 CAMPOS DE INVENTÁRIO DE HARDWARE
	MachineModel      string     `json:"machine_model"`
	SerialNumber      string     `json:"serial_number"`
	InstalledSoftware []Software `json:"installed_software"`
}

type Software struct {
	Name              string `json:"name"`
	Version           string `json:"version"`
}

type TelemetryData struct {
	UUID              string  `json:"uuid"`
	CPUUsagePercent   float64 `json:"cpu_usage_percent"`
	RAMUsagePercent   float64 `json:"ram_usage_percent"`
	DiskFreePercent   float64 `json:"disk_free_percent"`
	DiskSmartStatus   string  `json:"disk_smart_status"`
	TemperatureCelsius float64 `json:"temperature_celsius"`
	LastBackupTimestamp string  `json:"last_backup_timestamp"`
}

type RegistrationResponse struct {
	Message           string `json:"message"`
	MachineIP         string `json:"ip_address"`
}

// 🚨 FUNÇÃO AUXILIAR PARA COLETAR DADOS DE HARDWARE VIA WMIC (Windows)
func execWmic(query string) string {
	if runtime.GOOS != "windows" {
		return "N/A"
	}
	cmd := exec.Command("wmic", strings.Split(query, " ")...)
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return "N/A"
	}
	// Limpa e formata a saída, removendo cabeçalhos e espaços em branco
	result := strings.TrimSpace(out.String())
	lines := strings.Split(result, "\n")
	if len(lines) > 1 {
		// Retorna apenas a segunda linha (o valor)
		return strings.TrimSpace(lines[1])
	}
	return "N/A"
}

func getLocalIP() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "N/A"
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
				return ip.String()
			}
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
	if len(cInfos) > 0 {
		cpuModel = cInfos[0].ModelName
	}
	
	// 🚨 COLETANDO MARCA, MODELO E SERIAL USANDO WMIC (RESOLVENDO ERROS DE COMPILAÇÃO)
	machineModel := execWmic("csproduct get name")
	serialNumber := execWmic("bios get serialnumber")
	
	// Se o WMIC falhar (comum em VMs), usa o HostID como fallback para o Serial
	if serialNumber == "N/A" {
		serialNumber = hInfo.HostID
	}

	var diskTotalGB float64
	rootPath := "/"
	if runtime.GOOS == "windows" {
		rootPath = "C:\\"
	}

	dUsage, err := disk.Usage(rootPath)
	if err == nil {
		diskTotalGB = float64(dUsage.Total) / (1024 * 1024 * 1024)
	} else if len(dPartitions) > 0 {
		dUsage, _ := disk.Usage(dPartitions[0].Mountpoint)
		diskTotalGB = float64(dUsage.Total) / (1024 * 1024 * 1024)
	}

	return MachineInfo{
		UUID:              getMachineUUID(),
		Hostname:          hInfo.Hostname,
		IPAddress:         getLocalIP(),
		OSName:            fmt.Sprintf("%s %s", hInfo.OS, hInfo.Platform),
		CPUModel:          cpuModel,
		RAMTotalGB:        float64(mInfo.Total) / (1024 * 1024 * 1024),
		DiskTotalGB:       diskTotalGB,
		MACAddress:        "00:00:00:00:00:00",
		// 🚨 DADOS DE INVENTÁRIO ENVIADOS
		MachineModel:      machineModel,
		SerialNumber:      serialNumber,
		InstalledSoftware: []Software{{Name: "Agente Go", Version: "2.1"}},
	}
}

func ensureBackupFolderExists(folderPath string) {
	err := os.MkdirAll(folderPath, 0755)
	if err != nil {
		if os.IsExist(err) {
			return
		}
		log.Printf("Erro ao criar pasta de backup '%s': %v", folderPath, err)
	} else {
		log.Printf("Pasta de backup '%s' verificada/criada.", folderPath)
	}
}

func getLastBackupTimestamp(dir string) string {
	var latestTime time.Time

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			if os.IsNotExist(err) || os.IsPermission(err) {
				return err
			}
			return nil
		}

		if !info.IsDir() {
			modTime := info.ModTime()
			if modTime.After(latestTime) {
				latestTime = modTime
			}
		}
		return nil
	})

	if err != nil {
		log.Printf("Erro ao verificar pasta de backup '%s': %v.", dir, err)
		return ""
	}

	if !latestTime.IsZero() {
		return latestTime.Format("2006-01-02 15:04:05")
	}

	return ""
}

func collectTelemetryData() TelemetryData {
	cpuPercents, _ := cpu.Percent(0, false)
	cpuUsage := 0.0
	if len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}

	mInfo, _ := mem.VirtualMemory()
	ramUsage := mInfo.UsedPercent

	diskUsageFree := 0.0
	rootPath := "/"
	if runtime.GOOS == "windows" {
		rootPath = "C:\\"
	}

	dUsage, err := disk.Usage(rootPath)
	if err == nil {
		diskUsageFree = 100.0 - dUsage.UsedPercent
	}

	temperature := getCPUTemperature()
	lastBackup := getLastBackupTimestamp(BACKUP_FOLDER_PATH)

	return TelemetryData{
		UUID:              getMachineUUID(),
		CPUUsagePercent:   cpuUsage,
		RAMUsagePercent:   ramUsage,
		DiskFreePercent:   diskUsageFree,
		DiskSmartStatus:   "OK",
		TemperatureCelsius: temperature,
		LastBackupTimestamp: lastBackup,
	}
}

func getCPUTemperature() float64 {
	sensors, err := host.SensorsTemperatures()
	if err != nil {
		return 0.0
	}

	var cpuTemps []float64
	cpuKeywords := []string{"core", "package", "die", "cpu"}
	genericKeywords := []string{"thermal zone", "acpitz"}

	for _, sensor := range sensors {
		key := strings.ToLower(sensor.SensorKey)
		for _, keyword := range cpuKeywords {
			if strings.Contains(key, keyword) && sensor.Temperature > 0 {
				cpuTemps = append(cpuTemps, sensor.Temperature)
				break
			}
		}
	}

	if len(cpuTemps) > 0 {
		var total float64
		for _, t := range cpuTemps {
			total += t
		}
		return total / float64(len(cpuTemps))
	}

	for _, sensor := range sensors {
		key := strings.ToLower(sensor.SensorKey)
		for _, keyword := range genericKeywords {
			if strings.Contains(key, keyword) && sensor.Temperature > 0 {
				return sensor.Temperature
			}
		}
	}

	for _, sensor := range sensors {
		if sensor.Temperature > 0 {
			return sensor.Temperature
		}
	}

	return 0.0
}

func postData(endpoint string, data interface{}) {
	jsonValue, err := json.Marshal(data)
	if err != nil {
		log.Printf("Erro ao serializar JSON para %s: %v", endpoint, err)
		return
	}

	url := fmt.Sprintf("%s%s", API_BASE_URL, endpoint)
	client := http.Client{Timeout: 5 * time.Second}

	for i := 0; i < MAX_RETRIES; i++ {
		resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))
		if err != nil {
			log.Printf("Erro de rede na tentativa %d para %s: %v", i+1, endpoint, err)
			if i < MAX_RETRIES-1 {
				time.Sleep(RETRY_DELAY)
			}
			continue
		}

		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return
		}

		if resp.StatusCode >= 500 {
			log.Printf("Erro do servidor (tentativa %d): %s", i+1, resp.Status)
			if i < MAX_RETRIES-1 {
				time.Sleep(RETRY_DELAY)
				continue
			}
			return
		}

		log.Printf("Erro da API (não recuperável): %s", resp.Status)
		return
	}
}

func registerMachine(info MachineInfo) {
	// Rota corrigida para /api/register
	url := fmt.Sprintf("%s/register", API_BASE_URL) 
	client := http.Client{Timeout: 5 * time.Second}

	jsonValue, _ := json.Marshal(info)
	
	for i := 0; i < MAX_RETRIES; i++ {
		resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))

		if err != nil {
			log.Printf("Erro ao registrar máquina: %v", err)
			if i < MAX_RETRIES-1 {
				time.Sleep(RETRY_DELAY)
			}
			continue
		}

		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			body, _ := io.ReadAll(resp.Body)
			var regResp RegistrationResponse
			json.Unmarshal(body, &regResp)
			GlobalMachineIP = regResp.MachineIP
			log.Printf("Máquina registrada! IP: %s", GlobalMachineIP)
			return
		}

		log.Printf("Erro no registro (Status %s)", resp.Status)
		return
	}
}

func main() {
	log.Println("Agente Rede Fácil v2 iniciando...")

	ensureBackupFolderExists(BACKUP_FOLDER_PATH)

	info := collectStaticInfo()
	registerMachine(info)

	ticker := time.NewTicker(TELEMETRY_INTERVAL)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			data := collectTelemetryData()
			log.Printf("Stats -> Temp: %.1f°C | CPU: %.1f%% | RAM: %.1f%% | Backup: %s",
				data.TemperatureCelsius,
				data.CPUUsagePercent,
				data.RAMUsagePercent,
				data.LastBackupTimestamp)
			postData("/telemetry", data)
		}
	}
}