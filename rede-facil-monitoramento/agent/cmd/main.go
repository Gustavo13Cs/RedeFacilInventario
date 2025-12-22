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
	gonet "github.com/shirou/gopsutil/v3/net"
)

const BACKUP_FOLDER_PATH = "C:\\Users\\Windows 10\\Documents\\backup_agente"
const RESTORE_POINT_FILE = "restore_point_last_run.txt"
const API_BASE_URL = "http://localhost:3001/api"
const TELEMETRY_INTERVAL = 5 * time.Second
const RESTORE_POINT_INTERVAL = 120 * time.Hour 

const MAX_RETRIES = 3
const RETRY_DELAY = 10 * time.Second

var GlobalMachineIP string


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

type RegistrationResponse struct {
	Message   string `json:"message"`
	MachineIP string `json:"ip_address"`
}

type ServerResponse struct {
	Message string `json:"message"`
	Command string `json:"command"`
}

// --- FUNÇÕES DE SISTEMA (WMIC/CMD) ---

func execWmic(args ...string) string {
	if runtime.GOOS != "windows" {
		return "N/A"
	}

	var cmdArgs []string
	if len(args) == 1 {
		// Se passar uma string só com espaços, divide ela (compatibilidade)
		cmdArgs = strings.Fields(args[0])
	} else {
		cmdArgs = args
	}

	cmd := exec.Command("wmic", cmdArgs...)
	var out bytes.Buffer
	cmd.Stdout = &out
	// Ignora erro do run, tenta pegar output mesmo assim ou retorna N/A
	if err := cmd.Run(); err != nil {
		return "N/A"
	}

	result := strings.TrimSpace(out.String())
	lines := strings.Split(result, "\n")

	if len(lines) > 1 {
		val := strings.TrimSpace(lines[1])
		if val != "" {
			return val
		}
	}
	return "N/A"
}

func getMemorySlotsInfo() (total int, used int) {
	if runtime.GOOS != "windows" {
		return 0, 0
	}

	totalOutput := execWmic("memphysical get MemoryDevices")
	totalString := strings.TrimSpace(totalOutput)
	totalValue, err := strconv.Atoi(totalString)
	if err == nil && totalValue > 0 {
		total = totalValue
	}

	cmd := exec.Command("wmic", "memorychip", "get", "banklabel")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return total, 0
	}

	lines := strings.Split(out.String(), "\n")
	used = 0
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if i == 0 || line == "" || line == "BankLabel" {
			continue
		}
		used++
	}
	return total, used
}

func getGPUInfo() (model string, vramMB int) {
	if runtime.GOOS != "windows" {
		return "N/A", 0
	}

	model = execWmic("path Win32_VideoController get Name")
	vramBytesOutput := execWmic("path Win32_VideoController get AdapterRAM")
	vramBytesString := strings.TrimSpace(vramBytesOutput)
	vramBytes, err := strconv.ParseInt(vramBytesString, 10, 64)
	if err != nil {
		return model, 0
	}

	vramMB = int(vramBytes / (1024 * 1024))
	if vramMB < 0 {
		vramMB *= -1
	} // Correção para valores negativos ocasionais

	if model == "" || strings.Contains(strings.ToLower(model), "basic render driver") {
		if vramMB > 0 {
			return "Integrada / Onboard", vramMB
		}
		return "N/A", 0
	}
	return model, vramMB
}

func getMachineType() string {
	if runtime.GOOS != "windows" {
		return "Indefinido"
	}
	chassisTypeOutput := execWmic("csenclosure get chassistypes")
	chassisType := strings.TrimSpace(chassisTypeOutput)
	switch chassisType {
	case "8", "9", "10", "14":
		return "Notebook/Laptop"
	case "1", "2", "3", "4", "5", "6", "7", "13", "15", "16":
		return "Desktop/Workstation"
	case "17", "21", "22", "23":
		return "Servidor"
	default:
		return "Hardware Genérico"
	}
}

// --- COLETA DE DADOS ---

func collectInstalledSoftware() []Software {
	if runtime.GOOS != "windows" {
		return nil
	}

	// Nota: wmic product é lento, mas funcional para este exemplo
	cmd := exec.Command("wmic", "product", "get", "Name,Version")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return nil
	}

	output := out.String()
	lines := strings.Split(output, "\n")
	if len(lines) < 2 {
		return nil
	}

	headerLine := lines[0]
	nameIndex := strings.Index(headerLine, "Name")
	versionIndex := strings.Index(headerLine, "Version")

	var softwareList []Software
	if nameIndex == -1 || versionIndex == -1 {
		return nil
	}

	for i := 1; i < len(lines); i++ {
		line := lines[i]
		if len(line) < versionIndex {
			continue
		}

		name := ""
		version := ""

		// Lógica simples de corte de string baseada no header
		if len(line) > nameIndex {
			if versionIndex < nameIndex {
				version = strings.TrimSpace(line[versionIndex:nameIndex])
				name = strings.TrimSpace(line[nameIndex:])
			} else {
				name = strings.TrimSpace(line[nameIndex:versionIndex])
				if len(line) > versionIndex {
					version = strings.TrimSpace(line[versionIndex:])
				}
			}
		}

		if name != "" && !strings.Contains(name, "Agente Go") && !strings.Contains(name, "Update") && !strings.Contains(name, "KB") {
			softwareList = append(softwareList, Software{Name: name, Version: version})
		}
	}
	return softwareList
}

func collectNetworkInterfaces() []NetworkInterface {
	interfaces, err := gonet.Interfaces()
	if err != nil {
		return nil
	}

	var nics []NetworkInterface
	for _, iface := range interfaces {
		flags := strings.Join(iface.Flags, ",")
		isLoopback := strings.Contains(flags, "loopback")
		isUp := strings.Contains(flags, "up")
		// Filtra interfaces inativas ou sem MAC
		if isLoopback || !isUp || iface.HardwareAddr == "" {
			continue
		}

		nics = append(nics, NetworkInterface{
			InterfaceName: iface.Name,
			MACAddress:    iface.HardwareAddr,
			IsUp:          isUp,
			SpeedMbps:     0, // Go não pega velocidade do link facilmente sem CGO/WMI complexo
		})
	}
	return nics
}

func getLocalIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "127.0.0.1"
	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP.String()
}

func getMachineUUID() string {
	h, _ := os.Hostname()
	u, err := user.Current()
	username := "unknown"
	if err == nil && u != nil {
		parts := strings.Split(u.Username, "\\")
		username = parts[len(parts)-1]
	}
	rawUUID := fmt.Sprintf("%s-%s", h, username)
	// Sanitização para evitar problemas em URLs
	safeUUID := strings.ReplaceAll(rawUUID, "\\", "-")
	safeUUID = strings.ReplaceAll(safeUUID, "/", "-")
	return safeUUID
}

func collectStaticInfo() MachineInfo {
	hInfo, _ := host.Info()
	mInfo, _ := mem.VirtualMemory()
	cInfos, _ := cpu.Info()
	dPartitions, _ := disk.Partitions(false)

	cpuModel := "N/A"
	var cpuSpeed float64
	if len(cInfos) > 0 {
		cpuModel = cInfos[0].ModelName
		cpuSpeed = cInfos[0].Mhz
	}

	cpuCoresPhysical, _ := cpu.Counts(false)
	cpuCoresLogical, _ := cpu.Counts(true)

	machineModel := execWmic("csproduct get name")
	serialNumber := execWmic("bios get serialnumber")
	if serialNumber == "N/A" || serialNumber == "" {
		serialNumber = hInfo.HostID
	}

	machineType := getMachineType()
	mbManufacturer := execWmic("baseboard get manufacturer")
	mbModel := execWmic("baseboard get product")
	mbVersion := execWmic("baseboard get version")
	gpuModel, gpuVRAM := getGPUInfo()

	bootTime, err := host.BootTime()
	var lastBootTime string
	if err == nil {
		lastBootTime = time.Unix(int64(bootTime), 0).Format("2006-01-02 15:04:05")
	} else {
		lastBootTime = "N/A"
	}

	memSlotsTotal, memSlotsUsed := getMemorySlotsInfo()
	networkInterfaces := collectNetworkInterfaces()
	installedSoftware := collectInstalledSoftware() // Cuidado: pode ser lento

	var diskTotalGB float64
	rootPath := "/"
	if runtime.GOOS == "windows" {
		rootPath = "C:\\"
	}
	dUsage, err := disk.Usage(rootPath)
	if err == nil {
		diskTotalGB = float64(dUsage.Total) / (1024 * 1024 * 1024)
	} else if len(dPartitions) > 0 {
		// Fallback para primeira partição encontrada
		dUsage, _ := disk.Usage(dPartitions[0].Mountpoint)
		diskTotalGB = float64(dUsage.Total) / (1024 * 1024 * 1024)
	}

	return MachineInfo{
		UUID:                    getMachineUUID(),
		Hostname:                hInfo.Hostname,
		IPAddress:               getLocalIP(),
		OSName:                  fmt.Sprintf("%s %s", hInfo.OS, hInfo.Platform),
		CPUModel:                cpuModel,
		CPUSpeedMhz:             cpuSpeed,
		CPUCoresPhysical:        cpuCoresPhysical,
		CPUCoresLogical:         cpuCoresLogical,
		RAMTotalGB:              float64(mInfo.Total) / (1024 * 1024 * 1024),
		DiskTotalGB:             diskTotalGB,
		MACAddress:              "00:00:00:00:00:00", // Preenchido nas interfaces de rede
		MachineModel:            machineModel,
		SerialNumber:            serialNumber,
		MachineType:             machineType,
		MotherboardManufacturer: mbManufacturer,
		MotherboardModel:        mbModel,
		MotherboardVersion:      mbVersion,
		GPUModel:                gpuModel,
		GPUVRAMMB:               gpuVRAM,
		LastBootTime:            lastBootTime,
		MemSlotsTotal:           memSlotsTotal,
		MemSlotsUsed:            memSlotsUsed,
		NetworkInterfaces:       networkInterfaces,
		InstalledSoftware:       installedSoftware,
	}
}

// --- TELEMETRIA E MANUTENÇÃO ---

func ensureBackupFolderExists(folderPath string) {
	err := os.MkdirAll(folderPath, 0755)
	if err != nil {
		if os.IsExist(err) {
			return
		}
		log.Printf("Erro ao criar pasta de backup '%s': %v", folderPath, err)
	}
}

func getLastBackupTimestamp(dir string) string {
	var latestTime time.Time
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
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
		return ""
	}
	if !latestTime.IsZero() {
		return latestTime.Format("2006-01-02 15:04:05")
	}
	return ""
}

func getCPUTemperature() float64 {
	if runtime.GOOS != "windows" {
		sensors, err := host.SensorsTemperatures()
		if err != nil || len(sensors) == 0 {
			return 0.0
		}
		return sensors[0].Temperature
	}
	// WMI para temperatura (pode precisar de permissões de admin)
	output := execWmic("/namespace:\\\\root\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature")
	output = strings.TrimSpace(output)
	if output == "" || output == "N/A" {
		return 0.0
	}

	kelvinDeci, err := strconv.ParseFloat(output, 64)
	if err != nil {
		return 0.0
	}

	celsius := (kelvinDeci / 10.0) - 273.15
	if celsius < 0 || celsius > 150 {
		return 0.0
	}
	return celsius
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
		UUID:                getMachineUUID(),
		CPUUsagePercent:     cpuUsage,
		RAMUsagePercent:     ramUsage,
		DiskFreePercent:     diskUsageFree,
		DiskSmartStatus:     "OK", // Simplificado
		TemperatureCelsius:  temperature,
		LastBackupTimestamp: lastBackup,
	}
}

// --- COMANDOS REMOTOS ---

func handleRemoteCommand(command string) {
	if command == "" {
		return
	}
	log.Printf("⚠️ COMANDO REMOTO RECEBIDO: %s", command)

	var cmd *exec.Cmd
	switch command {
	case "shutdown":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("shutdown", "/s", "/t", "0", "/f")
		} else {
			cmd = exec.Command("shutdown", "-h", "now")
		}
	case "restart":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("shutdown", "/r", "/t", "0", "/f")
		} else {
			cmd = exec.Command("reboot")
		}
	case "clean_temp":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("cmd", "/C", "del /q /f /s %TEMP%\\*")
		}
	default:
		log.Printf("Comando desconhecido: %s", command)
		return
	}

	if cmd != nil {
		err := cmd.Start()
		if err != nil {
			log.Printf("Erro ao executar comando: %v", err)
		} else {
			log.Println("Comando enviado ao sistema operacional com sucesso.")
		}
	}
}

// --- API E LÓGICA DE BACKUP ---

func createRestorePoint() {
	if runtime.GOOS != "windows" {
		return
	}

	ensureBackupFolderExists(BACKUP_FOLDER_PATH)
	restoreFile := filepath.Join(BACKUP_FOLDER_PATH, RESTORE_POINT_FILE)

	// Verifica a última execução para não floodar
	var lastRun time.Time
	if content, err := os.ReadFile(restoreFile); err == nil {
		lastRun, _ = time.Parse("2006-01-02 15:04:05", strings.TrimSpace(string(content)))
	}

	if time.Since(lastRun) < RESTORE_POINT_INTERVAL {
		// Ainda está no período de "cooldown", não cria outro ponto
		return
	}

	log.Println("🛠️ Iniciando criação de Ponto de Restauração agendado...")
	// Comando PowerShell que requer Admin
	cmd := exec.Command("powershell.exe", "-ExecutionPolicy", "Bypass", "-Command", "Checkpoint-Computer -Description 'Agente Rede Facil' -RestorePointType 'MODIFY_SETTINGS'")

	err := cmd.Run()
	if err == nil {
		now := time.Now().Format("2006-01-02 15:04:05")
		_ = os.WriteFile(restoreFile, []byte(now), 0644)
		log.Println("✅ Ponto de Restauração criado com sucesso.")
	} else {
		log.Printf("⚠️ Falha ao criar ponto de restauração (Requer Admin?): %v", err)
	}
}

func postData(endpoint string, data interface{}) {
	jsonValue, err := json.Marshal(data)
	if err != nil {
		log.Printf("Erro JSON: %v", err)
		return
	}

	url := fmt.Sprintf("%s%s", API_BASE_URL, endpoint)
	client := http.Client{Timeout: 10 * time.Second}

	for i := 0; i < MAX_RETRIES; i++ {
		resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))
		if err != nil {
			if i < MAX_RETRIES-1 {
				time.Sleep(RETRY_DELAY)
			}
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			// Lê resposta para ver se tem comando
			body, _ := io.ReadAll(resp.Body)
			var serverResp ServerResponse
			if err := json.Unmarshal(body, &serverResp); err == nil {
				if serverResp.Command != "" {
					handleRemoteCommand(serverResp.Command)
				}
			}
			return
		}

		if i < MAX_RETRIES-1 {
			time.Sleep(RETRY_DELAY)
		}
	}
}

func registerMachine() {
	// Usa a função de coleta unificada para não duplicar lógica
	info := collectStaticInfo()

	url := fmt.Sprintf("%s/register", API_BASE_URL)
	client := http.Client{Timeout: 15 * time.Second} // Aumentado timeout pois coleta de soft é pesada

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

// --- MAIN ---

func main() {
	log.Println("Agente Rede Fácil v3 (Monitoramento) iniciando...")

	// 1. Tenta registrar a máquina
	registerMachine()

	// 2. Loop principal de monitoramento
	ticker := time.NewTicker(TELEMETRY_INTERVAL)
	restoreCheck := time.NewTicker(1 * time.Hour) // Checa se precisa criar ponto a cada hora

	for {
		select {
		case <-ticker.C:
			data := collectTelemetryData()
			log.Printf("Stats -> Temp: %.1f°C | CPU: %.1f%% | RAM: %.1f%%",
				data.TemperatureCelsius,
				data.CPUUsagePercent,
				data.RAMUsagePercent)
			postData("/telemetry", data)

		case <-restoreCheck.C:
			createRestorePoint()
		}
	}
}
