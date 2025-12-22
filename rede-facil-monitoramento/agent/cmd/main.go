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
<<<<<<< HEAD
	gonet "github.com/shirou/gopsutil/v3/net"
=======
>>>>>>> 62f7337c1c09f665e0794ef9ac77b44e76df53e3
)

// Configurações Globais
const BACKUP_FOLDER_PATH = "C:\\Users\\Windows 10\\Documents\\backup_agente"
const RESTORE_POINT_FILE = "restore_point_last_run.txt"
const API_BASE_URL = "http://localhost:3001/api"
const TELEMETRY_INTERVAL = 5 * time.Second
const RESTORE_POINT_INTERVAL = 120 * time.Hour // Intervalo de 5 dias

const MAX_RETRIES = 3
const RETRY_DELAY = 10 * time.Second

<<<<<<< HEAD
var GlobalMachineIP string

// --- ESTRUTURAS ---

=======
// Estruturas de Dados
>>>>>>> 62f7337c1c09f665e0794ef9ac77b44e76df53e3
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

<<<<<<< HEAD
type RegistrationResponse struct {
	Message   string `json:"message"`
	MachineIP string `json:"ip_address"`
}

type ServerResponse struct {
	Message string `json:"message"`
	Command string `json:"command"`
}


func execWmic(args ...string) string {
	if runtime.GOOS != "windows" {
		return "N/A"
	}
	
    var cmdArgs []string
    if len(args) == 1 {
        cmdArgs = strings.Fields(args[0]) 
    } else {
        cmdArgs = args
    }

	cmd := exec.Command("wmic", cmdArgs...)
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
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

func collectInstalledSoftware() []Software {
	if runtime.GOOS != "windows" {
		return nil
	}
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
	if nameIndex == -1 || versionIndex == -1 {
		return nil
	}
	var softwareList []Software
	for i := 1; i < len(lines); i++ {
		line := lines[i]
		if len(line) < versionIndex {
			continue
		}
		version := ""
		name := ""
		if versionIndex < nameIndex && len(line) > nameIndex {
			version = strings.TrimSpace(line[:nameIndex])
			name = strings.TrimSpace(line[nameIndex:])
		} else if len(line) > versionIndex {
			version = strings.TrimSpace(line[versionIndex:])
			name = strings.TrimSpace(line[:versionIndex])
		}
		if name == "" {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				version = parts[len(parts)-1]
				name = strings.Join(parts[:len(parts)-1], " ")
			}
		}
		if name != "" && !strings.Contains(name, "Agente Go") && !strings.Contains(name, "Update") && !strings.Contains(name, "KB") {
			softwareList = append(softwareList, Software{Name: name, Version: version})
		}
	}
	return softwareList
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
	if model == "" || strings.Contains(strings.ToLower(model), "basic render driver") {
		if vramMB > 0 {
			return "Integrada / Onboard", vramMB
		}
		return "N/A", 0
	}
	return model, vramMB
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
		if isLoopback || !isUp || iface.HardwareAddr == "" {
			continue
		}
		nics = append(nics, NetworkInterface{
			InterfaceName: iface.Name,
			MACAddress:    iface.HardwareAddr,
			IsUp:          isUp,
			SpeedMbps:     0,
		})
	}
	return nics
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
=======
// --- Funções Auxiliares de Coleta ---
>>>>>>> 62f7337c1c09f665e0794ef9ac77b44e76df53e3

func getMachineUUID() string {
	h, _ := os.Hostname()
	u, err := user.Current()
	username := "unknown"
	if err == nil && u != nil {
		parts := strings.Split(u.Username, "\\")
		username = parts[len(parts)-1]
	}

	rawUUID := fmt.Sprintf("%s-%s", h, username)

	// CORREÇÃO CRÍTICA PARA URL (BARRAS -> TRAÇOS)
	safeUUID := strings.ReplaceAll(rawUUID, "\\", "-")
	safeUUID = strings.ReplaceAll(safeUUID, "/", "-")

	return safeUUID
}

<<<<<<< HEAD
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
	if serialNumber == "N/A" {
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
	installedSoftware := collectInstalledSoftware()
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
		MACAddress:              "00:00:00:00:00:00",
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
		return ""
	}
	if !latestTime.IsZero() {
		return latestTime.Format("2006-01-02 15:04:05")
	}
	return ""
=======
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
>>>>>>> 62f7337c1c09f665e0794ef9ac77b44e76df53e3
}

func getCPUTemperature() float64 {
	if runtime.GOOS != "windows" {
<<<<<<< HEAD
		sensors, err := host.SensorsTemperatures()
		if err != nil || len(sensors) == 0 {
			return 0.0
		}
		return sensors[0].Temperature
	}


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
		DiskSmartStatus:     "OK",
		TemperatureCelsius:  temperature,
		LastBackupTimestamp: lastBackup,
	}
}


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

// ---------------------------------------------------------
// FUNÇÃO CORRIGIDA: LER RESPOSTA DO SERVER
// ---------------------------------------------------------
func postData(endpoint string, data interface{}) {
	jsonValue, err := json.Marshal(data)
	if err != nil {
		log.Printf("Erro JSON: %v", err)
		return
=======
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
>>>>>>> 62f7337c1c09f665e0794ef9ac77b44e76df53e3
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
<<<<<<< HEAD
		if err != nil {
			if i < MAX_RETRIES-1 {
				time.Sleep(RETRY_DELAY)
			}
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			// AQUI ESTAVA FALTANDO: Ler o corpo da resposta para pegar o comando
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

func registerMachine(info MachineInfo) {
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
=======
		if err == nil {
			resp.Body.Close()
			return
		}
		time.Sleep(RETRY_DELAY)
	}
}

func createRestorePoint() {
	if runtime.GOOS != "windows" {
>>>>>>> 62f7337c1c09f665e0794ef9ac77b44e76df53e3
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
<<<<<<< HEAD
	log.Println("Agente Rede Fácil v3 (Controle Remoto) iniciando...")
=======
	log.Println("🔵 Agente Rede Fácil Financeira Ativo")
	_ = os.MkdirAll(BACKUP_FOLDER_PATH, 0755)
>>>>>>> 62f7337c1c09f665e0794ef9ac77b44e76df53e3

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
<<<<<<< HEAD
			data := collectTelemetryData()
			log.Printf("Stats -> Temp: %.1f°C | CPU: %.1f%% | RAM: %.1f%%",
				data.TemperatureCelsius,
				data.CPUUsagePercent,
				data.RAMUsagePercent)
=======
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

>>>>>>> 62f7337c1c09f665e0794ef9ac77b44e76df53e3
			postData("/telemetry", data)

		case <-restoreCheck.C:
			createRestorePoint()
		}
	}
}
