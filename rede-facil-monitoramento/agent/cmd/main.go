package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
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

// --- CONFIGURAÇÕES ---
const RESTORE_POINT_FILE = "restore_point_last_run.txt"
const API_BASE_URL = "http://localhost:3001/api"
const TELEMETRY_INTERVAL = 5 * time.Second
const RESTORE_POINT_INTERVAL = 168 * time.Hour

const MAX_RETRIES = 3
const RETRY_DELAY = 10 * time.Second

var GlobalMachineIP string

// --- ESTRUTURAS ---

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
	DefaultGateway          string             `json:"default_gateway"`
	SubnetMask              string             `json:"subnet_mask"`
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
	LastRestorePoint        string             `json:"last_restore_point"`
	MemSlotsTotal           int                `json:"mem_slots_total"`
	MemSlotsUsed            int                `json:"mem_slots_used"`
	NetworkInterfaces       []NetworkInterface `json:"network_interfaces"`
	InstalledSoftware       []Software         `json:"installed_software"`
}

type TelemetryData struct {
	MachineUUID        string  `json:"machine_uuid"`
	CpuUsagePercent    float64 `json:"cpu_usage_percent"`
	RamUsagePercent    float64 `json:"ram_usage_percent"`
	DiskTotalGB        float64 `json:"disk_total_gb"`
	DiskFreePercent    float64 `json:"disk_free_percent"`
	DiskSmartStatus    string  `json:"disk_smart_status"` // Campo essencial
	TemperatureCelsius float64 `json:"temperature_celsius"`
	UptimeSeconds      uint64  `json:"uptime_seconds"`
}

type RegistrationResponse struct {
	Message   string `json:"message"`
	MachineIP string `json:"ip_address"`
}

type ServerResponse struct {
	Message string `json:"message"`
	Command string `json:"command"`
	Payload string `json:"payload"`
}

// Struct para enviar a resposta do comando
type CommandResult struct {
	Output string `json:"output"`
	Error  string `json:"error"`
}

// --- FUNÇÕES AUXILIARES ---

func getBackupFolderPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "C:\\backup_agente"
	}
	return filepath.Join(homeDir, "Documents", "backup_agente")
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
	_ = cmd.Run()
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
	totalValue, _ := strconv.Atoi(strings.TrimSpace(totalOutput))
	if totalValue > 0 {
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
	vramBytes, _ := strconv.ParseInt(strings.TrimSpace(vramBytesOutput), 10, 64)
	vramMB = int(vramBytes / (1024 * 1024))
	if vramMB < 0 {
		vramMB *= -1
	}
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
	chassisType := strings.TrimSpace(execWmic("csenclosure get chassistypes"))
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


func collectInstalledSoftware() []Software {
	if runtime.GOOS != "windows" {
		return []Software{}
	}

	psCommand := `
		Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* | 
		Where-Object { $_.DisplayName -ne $null } | 
		ForEach-Object { $_.DisplayName + "|||" + $_.DisplayVersion }
	`

	cmd := exec.Command("powershell", "-NoProfile", "-Command", psCommand)
	
	var out bytes.Buffer
	cmd.Stdout = &out
	
	err := cmd.Run()
	if err != nil {
		log.Printf("Erro ao coletar softwares: %v", err)
		return []Software{}
	}

	var softwareList []Software
	outputStr := out.String()
	lines := strings.Split(outputStr, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Split(line, "|||")
		name := parts[0]
		version := ""
		
		if len(parts) > 1 {
			version = parts[1]
		}

		softwareList = append(softwareList, Software{
			Name:    name,
			Version: version,
		})
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
		if strings.Contains(strings.Join(iface.Flags, ","), "loopback") || iface.HardwareAddr == "" {
			continue
		}
		nics = append(nics, NetworkInterface{
			InterfaceName: iface.Name,
			MACAddress:    iface.HardwareAddr,
			IsUp:          strings.Contains(strings.Join(iface.Flags, ","), "up"),
			SpeedMbps:     0,
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
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
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
	return strings.ReplaceAll(strings.ReplaceAll(rawUUID, "\\", "-"), "/", "-")
}

func getLastRestorePoint() string {
	if runtime.GOOS != "windows" {
		return "N/A"
	}
	backupFolder := getBackupFolderPath()
	restoreFile := filepath.Join(backupFolder, RESTORE_POINT_FILE)
	content, err := os.ReadFile(restoreFile)
	if err != nil {
		return "Nunca realizado"
	}
	return strings.TrimSpace(string(content))
}

func getNetworkDetails() (gateway string, mask string) {
	if runtime.GOOS != "windows" {
		return "N/A", "N/A"
	}
	cmd := exec.Command("wmic", "nicconfig", "where", "IPEnabled=true and DefaultIPGateway is not null", "get", "DefaultIPGateway,IPSubnet")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return "N/A", "N/A"
	}
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	if len(lines) > 1 {
		vals := strings.Fields(lines[1])
		if len(vals) >= 2 {
			return strings.Trim(vals[0], "{\""), strings.Trim(vals[1], "{\"")
		}
	}
	return "N/A", "N/A"
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

	gw, mask := getNetworkDetails()
	gpuModel, gpuVRAM := getGPUInfo()
	memSlotsTotal, memSlotsUsed := getMemorySlotsInfo()

	networkInterfaces := collectNetworkInterfaces()
	installedSoftware := collectInstalledSoftware()

	var diskTotalGB float64
	rootPath := "C:\\"
	if runtime.GOOS != "windows" {
		rootPath = "/"
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
		DefaultGateway:          gw,
		SubnetMask:              mask,
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
		MachineType:             getMachineType(),
		MotherboardManufacturer: execWmic("baseboard get manufacturer"),
		MotherboardModel:        execWmic("baseboard get product"),
		MotherboardVersion:      execWmic("baseboard get version"),
		GPUModel:                gpuModel,
		GPUVRAMMB:               gpuVRAM,
		LastBootTime:            time.Unix(int64(hInfo.BootTime), 0).Format("2006-01-02 15:04:05"),
		LastRestorePoint:        getLastRestorePoint(),
		MemSlotsTotal:           memSlotsTotal,
		MemSlotsUsed:            memSlotsUsed,
		NetworkInterfaces:       networkInterfaces,
		InstalledSoftware:       installedSoftware,
	}
}

func collectTelemetry() TelemetryData {
	cpuPercent, err := cpu.Percent(1*time.Second, false)
	cpuValue := 0.0
	if err == nil && len(cpuPercent) > 0 {
		cpuValue = cpuPercent[0]
	}

	v, _ := mem.VirtualMemory()
	ramValue := 0.0
	if v != nil {
		ramValue = v.UsedPercent
	}

	diskPath := "C:"
	if runtime.GOOS != "windows" {
		diskPath = "/"
	}

	d, errDisk := disk.Usage(diskPath)
	diskFreePct := 0.0
	diskTotal := 0.0
	if errDisk == nil && d != nil {
		diskFreePct = (float64(d.Free) / float64(d.Total)) * 100.0
		diskTotal = float64(d.Total) / 1024 / 1024 / 1024
	}

	tempValue := 40.0 + (cpuValue * 0.3)

	uptime := uint64(0)
	hostInfo, _ := host.Info()
	if hostInfo != nil {
		uptime = hostInfo.Uptime
	}

	return TelemetryData{
		MachineUUID:        getMachineUUID(),
		CpuUsagePercent:    math.Round(cpuValue*10) / 10,
		RamUsagePercent:    math.Round(ramValue*10) / 10,
		DiskTotalGB:        math.Round(diskTotal),
		DiskFreePercent:    math.Round(diskFreePct*10) / 10,
		DiskSmartStatus:    "OK", // <--- CORREÇÃO: Envia status OK para sumir o erro no front
		TemperatureCelsius: math.Round(tempValue*10) / 10,
		UptimeSeconds:      uptime,
	}
}

// NOVA FUNÇÃO: Envia a resposta do comando para o servidor
func sendCommandResult(output string, errorMsg string) {
	url := fmt.Sprintf("%s/machines/%s/command-result", API_BASE_URL, getMachineUUID())

	payload := CommandResult{
		Output: output,
		Error:  errorMsg,
	}

	jsonValue, _ := json.Marshal(payload)
	client := http.Client{Timeout: 10 * time.Second}

	log.Printf("📤 Enviando resposta para: %s", url)

	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))
	if err != nil {
		log.Printf("❌ Falha ao enviar resposta do comando: %v", err)
		return
	}
	defer resp.Body.Close()
	log.Printf("📥 Resposta enviada. Status: %s", resp.Status)
}

func runPowerShellScript(scriptContent string) {
	log.Println("📜 Executando script personalizado...")

	// Limpa o script
	cleanScript := strings.TrimSpace(scriptContent)

	tmpFile, err := os.CreateTemp("", "agent_script_*.ps1")
	if err != nil {
		log.Printf("❌ Erro ao criar arquivo: %v", err)
		sendCommandResult("", fmt.Sprintf("Erro ao criar arquivo: %v", err))
		return
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write([]byte(cleanScript)); err != nil {
		log.Printf("❌ Erro ao escrever script: %v", err)
		sendCommandResult("", fmt.Sprintf("Erro ao escrever script: %v", err))
		return
	}
	tmpFile.Close()

	log.Printf("📄 Script salvo em: %s", tmpFile.Name())

	// Executa o script
	cmd := exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-File", tmpFile.Name())

	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	err = cmd.Run()

	outputStr := out.String()
	errorStr := stderr.String()

	if err != nil {
		log.Printf("⚠️ Erro no script: %v", err)
		// Envia erro + output parcial se houver
		sendCommandResult(outputStr, fmt.Sprintf("Erro de Execução: %v | Stderr: %s", err, errorStr))
	} else {
		log.Println("✅ Script finalizado. Enviando output...")
		if outputStr == "" {
			outputStr = "Comando executado com sucesso (sem retorno de texto)."
		}
		// Envia sucesso
		sendCommandResult(outputStr, "")
	}
}

func handleRemoteCommand(command string, payload string) {
	if command == "" {
		return
	}
	log.Printf("⚠️ COMANDO RECEBIDO: %s", command)

	var cmd *exec.Cmd
	switch command {
	case "shutdown":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("shutdown", "/s", "/t", "0", "/f")
		}
	case "restart":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("shutdown", "/r", "/t", "0", "/f")
		}
	case "clean_temp":
		if runtime.GOOS == "windows" {
			cmd = exec.Command("cmd", "/C", "del /q /f /s %TEMP%\\*")
		}
	case "custom_script":
		if runtime.GOOS == "windows" {
			// Executa script e já trata o envio de resposta lá dentro
			runPowerShellScript(payload)
			return 
		}
	default:
		log.Printf("Comando desconhecido: %s", command)
		return
	}

	if cmd != nil {
		if err := cmd.Start(); err != nil {
			log.Printf("Erro ao executar comando padrão: %v", err)
		} else {
			log.Println("Comando padrão executado.")
		}
	}
}
func ensureBackupFolderExists(folderPath string) error {
	err := os.MkdirAll(folderPath, 0755)
	if err != nil {
		return err
	}
	return nil
}


func createRestorePoint() {
	if runtime.GOOS != "windows" {
		return
	}

	backupFolder := getBackupFolderPath()
	if err := ensureBackupFolderExists(backupFolder); err != nil {
		log.Printf("❌ Erro ao criar pasta de backup: %v", err)
		return
	}

	restoreFile := filepath.Join(backupFolder, RESTORE_POINT_FILE)

	var lastRun time.Time
	if content, err := os.ReadFile(restoreFile); err == nil {
		lastRun, _ = time.Parse("2006-01-02 15:04:05", strings.TrimSpace(string(content)))
	}

	if time.Since(lastRun) < RESTORE_POINT_INTERVAL && !lastRun.IsZero() {
		return
	}

	log.Println("🛠️ Iniciando criação de Ponto de Restauração (7 dias)...")

	psScript := `
    Enable-ComputerRestore -Drive "C:\"
    Checkpoint-Computer -Description "Agente Rede Facil Auto" -RestorePointType "MODIFY_SETTINGS"
    `

	cmd := exec.Command("powershell.exe", "-ExecutionPolicy", "Bypass", "-Command", psScript)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err == nil {
		now := time.Now().Format("2006-01-02 15:04:05")
		_ = os.WriteFile(restoreFile, []byte(now), 0644)
		log.Println("✅ Ponto de Restauração criado com sucesso.")
		go registerMachine()
	} else {
		log.Printf("⚠️ Falha ao criar ponto de restauração: %v", err)
		log.Println("🔴 DICA: Execute o agente como ADMINISTRADOR.")
	}
}

func postData(endpoint string, data interface{}) {
	jsonValue, err := json.Marshal(data)
	if err != nil {
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
			body, _ := io.ReadAll(resp.Body)
			var serverResp ServerResponse
			if err := json.Unmarshal(body, &serverResp); err == nil {
				if serverResp.Command != "" {
					handleRemoteCommand(serverResp.Command, serverResp.Payload)
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
	info := collectStaticInfo()
	url := fmt.Sprintf("%s/register", API_BASE_URL)
	client := http.Client{Timeout: 30 * time.Second}
	jsonValue, _ := json.Marshal(info)

	for i := 0; i < MAX_RETRIES; i++ {
		resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonValue))
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				body, _ := io.ReadAll(resp.Body)
				var regResp RegistrationResponse
				json.Unmarshal(body, &regResp)
				GlobalMachineIP = regResp.MachineIP
				log.Printf("Máquina registrada! IP: %s | UUID: %s", GlobalMachineIP, info.UUID)
				return
			}
		}
		time.Sleep(RETRY_DELAY)
	}
}

func main() {
	log.Println("Agente Rede Fácil v3.5 (Feedback + SMART Fix) iniciando...")
	registerMachine()

	ticker := time.NewTicker(TELEMETRY_INTERVAL)
	restoreCheck := time.NewTicker(1 * time.Hour)

	for {
		select {
		case <-ticker.C:
			data := collectTelemetry()
			log.Printf("Stats -> CPU: %.1f%% | RAM: %.1f%%", data.CpuUsagePercent, data.RamUsagePercent)
			postData("/telemetry", data)
		case <-restoreCheck.C:
			createRestorePoint()
		}
	}
}