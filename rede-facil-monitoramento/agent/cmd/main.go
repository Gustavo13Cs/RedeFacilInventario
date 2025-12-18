package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

// Configurações Globais
const BACKUP_FOLDER_PATH = "C:\\Users\\Windows 10\\Documents\\backup_agente"
const RESTORE_POINT_FILE = "restore_point_last_run.txt"
const API_BASE_URL = "http://localhost:3001/api"
const TELEMETRY_INTERVAL = 5 * time.Second
const RESTORE_POINT_INTERVAL = 120 * time.Hour // Intervalo de 5 dias

const MAX_RETRIES = 3
const RETRY_DELAY = 10 * time.Second

// Estruturas de Dados
type NetworkInterface struct {
	InterfaceName string `json:"interface_name"`
	MACAddress    string `json:"mac_address"`
	IsUp          bool   `json:"is_up"`
	SpeedMbps     int    `json:"speed_mbps"`
}

type Software struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type MachineInfo struct {
	UUID                    string             `json:"uuid"`
	Hostname                string             `json:"hostname"`
	IPAddress               string             `json:"ip_address"`
	OSName                  string             `json:"os_name"`
	CPUModel                string             `json:"cpu_model"`
	CPUSpeedMhz             float64            `json:"cpu_speed_mhz"`
	CPUCoresPhysical        int                `json:"cpu_cores_physical"`
	CPUCoresLogical         int                `json:"cpu_cores_logical"`
	RAMTotalGB              float64            `json:"ram_total_gb"`
	DiskTotalGB             float64            `json:"disk_total_gb"`
	MACAddress              string             `json:"mac_address"`
	MachineModel            string             `json:"machine_model"`
	SerialNumber            string             `json:"serial_number"`
	MachineType             string             `json:"machine_type"`
	MotherboardManufacturer string             `json:"mb_manufacturer"`
	MotherboardModel        string             `json:"mb_model"`
	MotherboardVersion      string             `json:"mb_version"`
	GPUModel                string             `json:"gpu_model"`
	GPUVRAMMB               int                `json:"gpu_vram_mb"`
	LastBootTime            string             `json:"last_boot_time"`
	MemSlotsTotal           int                `json:"mem_slots_total"`
	MemSlotsUsed            int                `json:"mem_slots_used"`
	NetworkInterfaces       []NetworkInterface `json:"network_interfaces"`
	InstalledSoftware       []Software         `json:"installed_software"`
}

type TelemetryData struct {
	UUID                string  `json:"uuid"`
	CPUUsagePercent     float64 `json:"cpu_usage_percent"`
	RAMUsagePercent     float64 `json:"ram_usage_percent"`
	DiskFreePercent     float64 `json:"disk_free_percent"`
	DiskSmartStatus     string  `json:"disk_smart_status"`
	TemperatureCelsius  float64 `json:"temperature_celsius"`
	LastBackupTimestamp string  `json:"last_backup_timestamp"`
}

// --- Funções Auxiliares de Coleta ---

func getMachineUUID() string {
	h, _ := os.Hostname()
	u, err := user.Current()
	username := "unknown"
	if err == nil && u != nil {
		parts := strings.Split(u.Username, "\\")
		username = parts[len(parts)-1]
	}
	return fmt.Sprintf("%s-%s", h, username)
}

func getLocalIP() string {
	addrs, _ := net.InterfaceAddrs()
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return "N/A"
}

func getCPUTemperature() float64 {
	if runtime.GOOS != "windows" {
		return 0.0
	}
	cmd := exec.Command("wmic", "/namespace:\\\\root\\wmi", "PATH", "MSAcpi_ThermalZoneTemperature", "get", "CurrentTemperature")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return 0.0
	}
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	if len(lines) > 1 {
		tempK, _ := strconv.ParseFloat(strings.TrimSpace(lines[1]), 64)
		return (tempK / 10.0) - 273.15
	}
	return 0.0
}

func getLastRestorePointTimestamp() string {
	restoreFile := filepath.Join(BACKUP_FOLDER_PATH, RESTORE_POINT_FILE)
	content, err := os.ReadFile(restoreFile)
	if err != nil {
		return "NÃO EXECUTADO"
	}
	return strings.TrimSpace(string(content))
}

// --- Funções de Hardware ---

func execWmic(query string) string {
	cmd := exec.Command("wmic", strings.Split(query, " ")...)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return "N/A"
	}
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	if len(lines) > 1 {
		return strings.TrimSpace(lines[1])
	}
	return "N/A"
}

func getGPUInfo() (model string, vramMB int) {
	model = execWmic("path Win32_VideoController get Name")
	vramStr := execWmic("path Win32_VideoController get AdapterRAM")
	vramBytes, _ := strconv.ParseInt(strings.TrimSpace(vramStr), 10, 64)
	vramMB = int(vramBytes / (1024 * 1024))
	if vramMB < 0 {
		vramMB *= -1
	}
	return model, vramMB
}

func getMemorySlotsInfo() (total int, used int) {
	totalStr := execWmic("memphysical get MemoryDevices")
	total, _ = strconv.Atoi(strings.TrimSpace(totalStr))
	cmd := exec.Command("wmic", "memorychip", "get", "banklabel")
	var out bytes.Buffer
	cmd.Stdout = &out
	_ = cmd.Run()
	lines := strings.Split(out.String(), "\n")
	for i, line := range lines {
		if i > 0 && strings.TrimSpace(line) != "" {
			used++
		}
	}
	return total, used
}

// --- Funções de API e Automação ---

func postData(endpoint string, data interface{}) {
	jsonValue, _ := json.Marshal(data)
	url := fmt.Sprintf("%s%s", API_BASE_URL, endpoint)
	client := http.Client{Timeout: 10 * time.Second}
	for i := 0; i < MAX_RETRIES; i++ {
		resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))
		if err == nil {
			resp.Body.Close()
			return
		}
		time.Sleep(RETRY_DELAY)
	}
}

func createRestorePoint() {
	if runtime.GOOS != "windows" {
		return
	}
	restoreFile := filepath.Join(BACKUP_FOLDER_PATH, RESTORE_POINT_FILE)

	// Trava de segurança para não criar RP toda hora
	var lastRun time.Time
	if content, err := os.ReadFile(restoreFile); err == nil {
		lastRun, _ = time.Parse("2006-01-02 15:04:05", strings.TrimSpace(string(content)))
	}

	if time.Since(lastRun) < RESTORE_POINT_INTERVAL {
		return
	}

	log.Println("🛠️ Iniciando criação de Ponto de Restauração agendado...")
	cmd := exec.Command("powershell.exe", "-ExecutionPolicy", "Bypass", "-Command", "Checkpoint-Computer -Description 'Agente Rede Facil' -RestorePointType 'MODIFY_SETTINGS'")
	if err := cmd.Run(); err == nil {
		now := time.Now().Format("2006-01-02 15:04:05")
		_ = os.WriteFile(restoreFile, []byte(now), 0644)
		log.Println("✅ Ponto de Restauração atualizado.")
	}
}

func main() {
	log.Println("🔵 Agente Rede Fácil Financeira Ativo")
	_ = os.MkdirAll(BACKUP_FOLDER_PATH, 0755)

	// Registro Inicial
	hInfo, _ := host.Info()
	mInfo, _ := mem.VirtualMemory()
	cInfos, _ := cpu.Info()
	gpuModel, gpuVRAM := getGPUInfo()
	memTotal, memUsed := getMemorySlotsInfo()
	root := "C:\\"
	if runtime.GOOS != "windows" {
		root = "/"
	}
	dUsage, _ := disk.Usage(root)

	machineData := MachineInfo{
		UUID: getMachineUUID(), Hostname: hInfo.Hostname, IPAddress: getLocalIP(),
		OSName:   fmt.Sprintf("%s %s", hInfo.OS, hInfo.Platform),
		CPUModel: cInfos[0].ModelName, CPUSpeedMhz: cInfos[0].Mhz,
		RAMTotalGB:   float64(mInfo.Total) / (1024 * 1024 * 1024),
		DiskTotalGB:  float64(dUsage.Total) / (1024 * 1024 * 1024),
		MachineModel: execWmic("csproduct get name"), SerialNumber: execWmic("bios get serialnumber"),
		GPUModel: gpuModel, GPUVRAMMB: gpuVRAM,
		MemSlotsTotal: memTotal, MemSlotsUsed: memUsed,
	}
	postData("/register", machineData)

	ticker := time.NewTicker(TELEMETRY_INTERVAL)
	restoreCheck := time.NewTicker(1 * time.Hour)

	for {
		select {
		case <-ticker.C:
			cpuP, _ := cpu.Percent(0, false)
			m, _ := mem.VirtualMemory()
			d, _ := disk.Usage(root)

			data := TelemetryData{
				UUID: getMachineUUID(), CPUUsagePercent: cpuP[0],
				RAMUsagePercent: m.UsedPercent, DiskFreePercent: 100.0 - d.UsedPercent,
				DiskSmartStatus: "OK", TemperatureCelsius: getCPUTemperature(),
				LastBackupTimestamp: getLastRestorePointTimestamp(),
			}

			log.Printf("ID: %s | CPU: %.1f%% | RAM: %.1f%% | Temp: %.1f°C",
				data.UUID, data.CPUUsagePercent, data.RAMUsagePercent, data.TemperatureCelsius)

			postData("/telemetry", data)

		case <-restoreCheck.C:
			createRestorePoint()
		}
	}
}
