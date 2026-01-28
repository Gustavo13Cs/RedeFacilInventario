package main

import (
	"bytes"
	"context"
	"crypto/tls"
	_ "embed" 
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
	"syscall"
	"time"
	"unsafe"

	"github.com/getlantern/systray"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	gonet "github.com/shirou/gopsutil/v3/net"
)

//go:embed icon.ico
var iconData []byte

// --- CONFIGURAÇÕES ---
const AGENT_VERSION = "8.1" 
const UPDATE_BASE_URL = "https://192.168.50.60:3001/updates"
const UPDATE_URL_VERSION = "https://192.168.50.60:3001/updates/version.txt"
const UPDATE_URL_EXE = "https://192.168.50.60:3001/updates/AgenteRedeFacil.exe"
const API_BASE_URL = "https://192.168.50.60:3001/api"

const RESTORE_POINT_FILE = "restore_point_last_run.txt"
const TELEMETRY_INTERVAL = 20 * time.Second 
const RESTORE_POINT_INTERVAL = 168 * time.Hour

const MAX_RETRIES = 3
const RETRY_DELAY = 10 * time.Second

// Constantes Windows para Janelas de Alerta
const (
	MB_OK                = 0x00000000
	MB_ICONASTERISK      = 0x00000040 
	MB_ICONEXCLAMATION   = 0x00000030
	MB_TOPMOST           = 0x00040000
)

const (
	ES_CONTINUOUS       = 0x80000000
	ES_SYSTEM_REQUIRED  = 0x00000001
	ES_DISPLAY_REQUIRED = 0x00000002
)

var (
	kernel32           = syscall.NewLazyDLL("kernel32.dll")
	user32             = syscall.NewLazyDLL("user32.dll")
	setThreadExecState = kernel32.NewProc("SetThreadExecutionState")
	getLastInputInfo   = user32.NewProc("GetLastInputInfo")
	messageBox         = user32.NewProc("MessageBoxW") 
)

func preventSystemSleep() {
	setThreadExecState.Call(uintptr(ES_CONTINUOUS | ES_SYSTEM_REQUIRED))
}

var AgentSecret string = "REDE_FACIL_AGENTE_SECRETO_2026"
var httpClient *http.Client

func setupLogger() {
	logFileLocation := "agente_debug.log"
	f, err := os.OpenFile(logFileLocation, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		fmt.Printf("Erro ao criar log: %v", err)
		return
	}
	wrt := io.MultiWriter(os.Stdout, f)
	log.SetOutput(wrt)
}

func init() {
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		DisableKeepAlives: false,
		MaxIdleConns:      10,
		IdleConnTimeout:   90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}
	httpClient = &http.Client{
		Transport: tr,
		Timeout:   30 * time.Second,
	}
}

var GlobalMachineIP string
var ShutdownCancelled bool = false
var AutoShutdownEnabled bool = true

type LASTINPUTINFO struct {
	cbSize uint32
	dwTime uint32
}

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
	DiskSmartStatus    string  `json:"disk_smart_status"`
	TemperatureCelsius float64 `json:"temperature_celsius"`
	UptimeSeconds      uint64  `json:"uptime_seconds"`
	IdleSeconds        uint32  `json:"idle_seconds"`
}

type NetworkStats struct {
	MachineUUID string `json:"machine_uuid"`
	Target      string `json:"target"`
	LatencyMS   int    `json:"latency_ms"`
	PacketLoss  int    `json:"packet_loss"`
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

type CommandResult struct {
	Output string `json:"output"`
	Error  string `json:"error"`
}

// Função para exibir mensagem nativa no Windows
func showNativeMessage(title, text string, iconType uintptr) {
	if runtime.GOOS == "windows" {
		titlePtr, _ := syscall.UTF16PtrFromString(title)
		textPtr, _ := syscall.UTF16PtrFromString(text)
		messageBox.Call(
			0, 
			uintptr(unsafe.Pointer(textPtr)), 
			uintptr(unsafe.Pointer(titlePtr)), 
			iconType|MB_TOPMOST, 
		)
	}
}

// --- SYSTEM TRAY ---

func onReady() {
	// Verifica se o ícone foi carregado pelo embed
	if len(iconData) > 0 {
		systray.SetIcon(iconData)
		log.Println("✅ Ícone definido na bandeja com sucesso.")
	} else {
		log.Println("❌ ERRO: Ícone não encontrado ou vazio!")
	}
	
	systray.SetTitle("Rede Fácil Monitoramento")
	systray.SetTooltip("Agente Ativo - Monitoramento e Suporte")

	mRequestHelp := systray.AddMenuItem("🆘 Solicitar Suporte TI", "Chamar técnico imediatamente")
	systray.AddSeparator()
	mInfo := systray.AddMenuItem("✅ Monitoramento Ativo", "Sistema protegido e monitorado")
	mInfo.Disable()
	
	go func() {
		for {
			select {
			case <-mRequestHelp.ClickedCh:
				log.Println("🆘 Usuário clicou em Solicitar Suporte")
				// Roda em goroutine para não travar a interface
				go showNativeMessage("Aguarde", "Enviando solicitação para a central de TI...", MB_ICONASTERISK)
				sendHelpRequest()
			}
		}
	}()
}

func onExit() {
	// Limpeza
}

func sendHelpRequest() {
	url := fmt.Sprintf("%s/support/request", API_BASE_URL)
	payload := map[string]string{"uuid": getMachineUUID()}
	jsonValue, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonValue))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-secret", AgentSecret)

	resp, err := httpClient.Do(req)
	
	if err == nil && resp.StatusCode == 200 {
		showNativeMessage("Rede Fácil - TI", "✅ Solicitação recebida!\n\nUm técnico foi notificado e entrará em contato em breve.", MB_ICONASTERISK)
	} else if err == nil && resp.StatusCode == 200 {
		showNativeMessage("Rede Fácil - TI", "⚠️ Já existe um chamado aberto para este computador.\n\nPor favor, aguarde o atendimento.", MB_ICONEXCLAMATION)
	} else {
		showNativeMessage("Erro de Conexão", "❌ Não foi possível contatar o servidor.\n\nPor favor, ligue para o ramal do TI ou tente novamente mais tarde.", MB_ICONEXCLAMATION)
	}
}

// --- FUNÇÕES DE SISTEMA ---

func shutdownPC() {
	log.Println("🌙 Inatividade detectada. Desligando PC...")
	cmd := exec.Command("shutdown", "/s", "/t", "60", "/f", "/c", "Desligamento automático por inatividade.")
	cmd.Run()
}

func checkAutoShutdown() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️ Erro recuperado no checkAutoShutdown: %v", r)
		}
	}()

	if !AutoShutdownEnabled { return }

	now := time.Now()
	if now.Hour() > 19 || (now.Hour() == 19 && now.Minute() >= 15) {
		idleSeconds := getIdleTime()
		const tolerancia = 300
		if idleSeconds >= tolerancia {
			log.Printf("🌙 Horário limite atingido. Desligando...")
			shutdownPC()
		}
	}
}

func getIdleTime() uint32 {
	var lii LASTINPUTINFO
	lii.cbSize = uint32(unsafe.Sizeof(lii))
	getLastInputInfo.Call(uintptr(unsafe.Pointer(&lii)))

	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getTickCount := kernel32.NewProc("GetTickCount")
	t, _, _ := getTickCount.Call()

	if t == 0 { return 0 }
	return (uint32(t) - lii.dwTime) / 1000
}

func runCommandHidden(command string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, command, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}

	output, err := cmd.Output()

	if ctx.Err() == context.DeadlineExceeded {
		log.Printf("⚠️ Comando '%s' cancelado (Timeout)", command)
		return "", fmt.Errorf("timeout excedido")
	}

	return string(output), err
}

func ensureAutoStart() {
	if runtime.GOOS != "windows" { return }
	exePath, err := os.Executable()
	if err != nil { return }

	taskName := "AgenteRedeFacil"
	cmdTask := exec.Command("schtasks", "/create", "/tn", taskName, "/tr", exePath, "/sc", "onlogon", "/rl", "highest", "/f")
	cmdTask.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	errTask := cmdTask.Run()

	if errTask == nil {
		log.Println("✅ Tarefa Agendada criada com sucesso!")
		return 
	}

	psCommand := fmt.Sprintf(`
		$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
		$name = 'AgenteRedeFacil'
		$path = '%s'
		$current = (Get-ItemProperty -Path $key -Name $name -ErrorAction SilentlyContinue).$name
		if ($current -ne $path) {
			Set-ItemProperty -Path $key -Name $name -Value $path
		}
	`, exePath)
	runCommandHidden("powershell", "-NoProfile", "-Command", psCommand)
}

func pingHost(target string) (int, int) {
	outputStr, err := runCommandHidden("ping", "-n", "1", "-w", "1000", target)
	if err != nil { return 0, 100 }
	if strings.Contains(outputStr, "TTL=") { return 20, 0 }
	return 0, 100
}

func startNetworkMonitor() {
	defer func() {
		if r := recover(); r != nil {
			time.Sleep(30 * time.Second)
			go startNetworkMonitor()
		}
	}()
	for {
		lat, loss := pingHost("8.8.8.8")
		postData("/telemetry/network", NetworkStats{
			MachineUUID: getMachineUUID(), Target: "8.8.8.8", LatencyMS: lat, PacketLoss: loss,
		})
		time.Sleep(30 * time.Second)
	}
}

func checkForUpdates() {
	defer func() {
		if r := recover(); r != nil {
			time.Sleep(1 * time.Minute)
			go checkForUpdates()
		}
	}()

	for {
		time.Sleep(1 * time.Minute)

		tr := &http.Transport{ TLSClientConfig: &tls.Config{InsecureSkipVerify: true} }
		client := &http.Client{Transport: tr, Timeout: 10 * time.Second}

		resp, err := client.Get(UPDATE_URL_VERSION)
		if err != nil { continue }
		
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil { continue }

		remoteVersion := strings.TrimSpace(string(body))
		
		if remoteVersion != "" && remoteVersion != AGENT_VERSION {
			log.Printf("🔄 Update Detectado: %s -> %s", AGENT_VERSION, remoteVersion)
			doUpdate(client) 
		}
	}
}

func doUpdate(client *http.Client) {
	exePath, err := os.Executable()
	if err != nil { return }
	oldPath := exePath + ".old"

	if _, err := os.Stat(oldPath); err == nil { os.Remove(oldPath) }
	if err := os.Rename(exePath, oldPath); err != nil { return }

	resp, err := client.Get(UPDATE_URL_EXE)
	if err != nil {
		os.Rename(oldPath, exePath) 
		return
	}
	defer resp.Body.Close()

	out, err := os.Create(exePath)
	if err != nil {
		os.Rename(oldPath, exePath) 
		return
	}
	
	_, err = io.Copy(out, resp.Body)
	out.Close()

	if err != nil { return }

	cmd := exec.Command("cmd", "/C", "start", "", exePath)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	cmd.Start()
	os.Exit(0)
}

func getBackupFolderPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil { return "C:\\backup_agente" }
	return filepath.Join(homeDir, "Documents", "backup_agente")
}

func execWmic(args ...string) string {
	if runtime.GOOS != "windows" { return "N/A" }
	var cmdArgs []string
	if len(args) == 1 {
		cmdArgs = strings.Fields(args[0])
	} else {
		cmdArgs = args
	}

	output, err := runCommandHidden("wmic", cmdArgs...)
	if err != nil { return "N/A" }

	result := strings.TrimSpace(output)
	lines := strings.Split(result, "\n")
	if len(lines) > 1 {
		val := strings.TrimSpace(lines[1])
		if val != "" { return val }
	}
	return "N/A"
}

func getMemorySlotsInfo() (total int, used int) {
	if runtime.GOOS != "windows" { return 0, 0 }
	totalVal, _ := strconv.Atoi(strings.TrimSpace(execWmic("memphysical get MemoryDevices")))
	if totalVal > 0 { total = totalVal }
	outStr, err := runCommandHidden("wmic", "memorychip", "get", "banklabel")
	if err == nil {
		lines := strings.Split(outStr, "\n")
		for i, line := range lines {
			if i == 0 || strings.TrimSpace(line) == "" { continue }
			used++
		}
	}
	return total, used
}

func getGPUInfo() (model string, vramMB int) {
	if runtime.GOOS != "windows" { return "N/A", 0 }
	model = execWmic("path Win32_VideoController get Name")
	vramStr := execWmic("path Win32_VideoController get AdapterRAM")
	vramBytes, _ := strconv.ParseInt(vramStr, 10, 64)
	vramMB = int(vramBytes / (1024 * 1024))
	if vramMB < 0 { vramMB *= -1 }
	if model == "" { model = "N/A" }
	return model, vramMB
}

func getMachineType() string {
	if runtime.GOOS != "windows" { return "Indefinido" }
	chassis := strings.TrimSpace(execWmic("csenclosure get chassistypes"))
	switch chassis {
	case "8", "9", "10", "14": return "Notebook/Laptop"
	case "1", "2", "3", "4", "5", "6", "7": return "Desktop"
	default: return "Desktop/Genérico"
	}
}

func collectInstalledSoftware() []Software {
	if runtime.GOOS != "windows" { return []Software{} }
	psCommand := `Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* | Where-Object { $_.DisplayName -ne $null } | ForEach-Object { $_.DisplayName + "|||" + $_.DisplayVersion }`
	outputStr, err := runCommandHidden("powershell", "-NoProfile", "-Command", psCommand)
	if err != nil { return []Software{} }
	var list []Software
	lines := strings.Split(outputStr, "\n")
	for _, line := range lines {
		parts := strings.Split(strings.TrimSpace(line), "|||")
		if len(parts) >= 1 && parts[0] != "" {
			ver := ""
			if len(parts) > 1 { ver = parts[1] }
			list = append(list, Software{Name: parts[0], Version: ver})
		}
	}
	return list
}

func collectNetworkInterfaces() []NetworkInterface {
	interfaces, err := gonet.Interfaces()
	if err != nil { return nil }
	var nics []NetworkInterface
	for _, iface := range interfaces {
		if strings.Contains(strings.Join(iface.Flags, ","), "loopback") || iface.HardwareAddr == "" { continue }
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
	if err != nil { return "127.0.0.1" }
	defer conn.Close()
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
}

func getMachineUUID() string {
	h, _ := os.Hostname()
	u, err := user.Current()
	username := "unknown"
	if err == nil && u != nil {
		parts := strings.Split(u.Username, "\\")
		if len(parts) > 0 { username = parts[len(parts)-1] }
	}
	rawUUID := fmt.Sprintf("%s-%s", h, username)
	return strings.ReplaceAll(strings.ReplaceAll(rawUUID, "\\", "-"), "/", "-")
}

func getLastRestorePoint() string {
	if runtime.GOOS != "windows" { return "N/A" }
	restoreFile := filepath.Join(getBackupFolderPath(), RESTORE_POINT_FILE)
	content, err := os.ReadFile(restoreFile)
	if err != nil { return "Nunca realizado" }
	return strings.TrimSpace(string(content))
}

func getNetworkDetails() (gateway string, mask string) {
	if runtime.GOOS != "windows" { return "N/A", "N/A" }
	outStr, err := runCommandHidden("wmic", "nicconfig", "where", "IPEnabled=true and DefaultIPGateway is not null", "get", "DefaultIPGateway,IPSubnet")
	if err != nil { return "N/A", "N/A" }
	lines := strings.Split(strings.TrimSpace(outStr), "\n")
	if len(lines) > 1 {
		vals := strings.Fields(lines[1])
		if len(vals) >= 2 {
			return strings.Trim(vals[0], "{\""), strings.Trim(vals[1], "{\"")
		}
	}
	return "N/A", "N/A"
}

func collectStaticInfo() MachineInfo {
	defer func() {
		if r := recover(); r != nil { log.Printf("⚠️ Erro static info: %v", r) }
	}()
	hInfo, _ := host.Info()
	mInfo, _ := mem.VirtualMemory()
	cInfos, _ := cpu.Info()
	
	cpuModel := "N/A"
	var cpuSpeed float64
	if len(cInfos) > 0 {
		cpuModel = cInfos[0].ModelName
		cpuSpeed = cInfos[0].Mhz
	}
	
	cpuCoresPhysical, _ := cpu.Counts(false)
	cpuCoresLogical, _ := cpu.Counts(true)
	
	diskTotalGB := 0.0
	dUsage, err := disk.Usage("C:")
	if err == nil {
		diskTotalGB = float64(dUsage.Total) / (1024*1024*1024)
	}

	return MachineInfo{
		UUID:                    getMachineUUID(),
		Hostname:                hInfo.Hostname,
		IPAddress:               getLocalIP(),
		DefaultGateway:          "N/A",
		SubnetMask:              "N/A",
		OSName:                  fmt.Sprintf("%s %s", hInfo.OS, hInfo.Platform),
		CPUModel:                cpuModel,
		CPUSpeedMhz:             cpuSpeed,
		CPUCoresPhysical:        cpuCoresPhysical,
		CPUCoresLogical:         cpuCoresLogical,
		RAMTotalGB:              float64(mInfo.Total) / (1024 * 1024 * 1024),
		DiskTotalGB:             diskTotalGB,
		MACAddress:              "00:00:00:00:00:00",
		MachineModel:            execWmic("csproduct get name"),
		SerialNumber:            execWmic("bios get serialnumber"),
		MachineType:             getMachineType(),
		MotherboardManufacturer: execWmic("baseboard get manufacturer"),
		MotherboardModel:        execWmic("baseboard get product"),
		MotherboardVersion:      execWmic("baseboard get version"),
		GPUModel:                "N/A", 
		GPUVRAMMB:               0,
		LastBootTime:            time.Unix(int64(hInfo.BootTime), 0).Format("2006-01-02 15:04:05"),
		LastRestorePoint:        getLastRestorePoint(),
		MemSlotsTotal:           0,
		MemSlotsUsed:            0,
		NetworkInterfaces:       collectNetworkInterfaces(),
		InstalledSoftware:       collectInstalledSoftware(),
	}
}

func collectTelemetry() TelemetryData {
	defer func() {
		if r := recover(); r != nil { log.Printf("⚠️ Erro telemetria: %v", r) }
	}()

	cpuPercent, _ := cpu.Percent(1*time.Second, false)
	cpuValue := 0.0
	if len(cpuPercent) > 0 { cpuValue = cpuPercent[0] }

	v, _ := mem.VirtualMemory()
	ramValue := 0.0
	if v != nil { ramValue = v.UsedPercent }

	d, err := disk.Usage("C:")
	diskFreePct := 0.0
	diskTotal := 0.0
	if err == nil && d != nil && d.Total > 0 {
		diskFreePct = (float64(d.Free) / float64(d.Total)) * 100.0
		diskTotal = float64(d.Total) / (1024*1024*1024)
	}

	tempValue := 40.0 + (cpuValue * 0.3)
	uptime := uint64(0)
	hInfo, _ := host.Info()
	if hInfo != nil { uptime = hInfo.Uptime }

	return TelemetryData{
		MachineUUID:        getMachineUUID(),
		CpuUsagePercent:    math.Round(cpuValue*10) / 10,
		RamUsagePercent:    math.Round(ramValue*10) / 10,
		DiskTotalGB:        math.Round(diskTotal),
		DiskFreePercent:    math.Round(diskFreePct*10) / 10,
		DiskSmartStatus:    "OK",
		TemperatureCelsius: math.Round(tempValue*10) / 10,
		UptimeSeconds:      uptime,
		IdleSeconds:        getIdleTime(),
	}
}

func sendCommandResult(output string, errorMsg string) {
	url := fmt.Sprintf("%s/machines/%s/command-result", API_BASE_URL, getMachineUUID())
	payload := CommandResult{ Output: output, Error:  errorMsg }
	jsonValue, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonValue))
	if err != nil { return }
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-agent-secret", AgentSecret) 

	httpClient.Do(req)
}

// ✅ Função runPowerShellScript adicionada para corrigir erro de compilação
func runPowerShellScript(scriptContent string) {
	cleanScript := strings.TrimSpace(scriptContent)
	tmpFile, err := os.CreateTemp("", "agent_script_*.ps1")
	if err != nil { return }
	defer os.Remove(tmpFile.Name())
	tmpFile.Write([]byte(cleanScript))
	tmpFile.Close()

	outputStr, err := runCommandHidden("powershell", "-ExecutionPolicy", "Bypass", "-File", tmpFile.Name())
	if err != nil {
		sendCommandResult(outputStr, fmt.Sprintf("Erro: %v", err))
	} else {
		sendCommandResult(outputStr, "")
	}
}

func handleRemoteCommand(command string, payload string) {
	if command == "" {
		return
	}
	log.Printf("⚠️ COMANDO RECEBIDO: %s", command)

	switch command {
	case "shutdown":
		if runtime.GOOS == "windows" {
			runCommandHidden("shutdown", "/s", "/t", "0", "/f")
		}
	case "restart":
		if runtime.GOOS == "windows" {
			runCommandHidden("shutdown", "/r", "/t", "0", "/f")
		}
	case "clean_temp":
		if runtime.GOOS == "windows" {
			runCommandHidden("cmd", "/C", "del /q /f /s %TEMP%\\*")
		}
	case "set_wallpaper":
		// Script que força o bypass de SSL, descarrega a imagem e atualiza o registo e o sistema
		psScript := fmt.Sprintf(`
			$url = "%s"
			$path = "$env:TEMP\wallpaper_agente.jpg"
			
			# Configura TLS e ignora erros de certificado SSL (necessário para IPs privados/autoassinados)
			[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
			[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

			try {
				if (Test-Path $path) { Remove-Item $path -Force }
				
				$webClient = New-Object System.Net.WebClient
				$webClient.DownloadFile($url, $path)
				
				if (Test-Path $path) {
					# 1. Atualiza o caminho no Registo do Windows
					$registryPath = "HKCU:\Control Panel\Desktop"
					Set-ItemProperty -Path $registryPath -Name Wallpaper -Value $path
					
					# 2. Força a atualização da interface do utilizador (SystemParametersInfo)
					$code = @'
					using System;
					using System.Runtime.InteropServices;
					public class Wallpaper {
						[DllImport("user32.dll", CharSet = CharSet.Auto)]
						public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
					}
'@
					Add-Type -TypeDefinition $code
					[Wallpaper]::SystemParametersInfo(0x0014, 0, $path, 0x01 -bor 0x02)
				}
			} catch {
				exit
			}
		`, payload)

		go func(script string) {
			cmd := exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script)
			cmd.SysProcAttr = &syscall.SysProcAttr{
				HideWindow:    true,
				CreationFlags: 0x08000000,
			}
			err := cmd.Run()
			if err != nil {
				log.Printf("❌ Erro ao executar script de wallpaper: %v", err)
				sendCommandResult("", fmt.Sprintf("Erro no PowerShell: %v", err))
			} else {
				log.Printf("🖼️ Wallpaper aplicado com sucesso: %s", payload)
				sendCommandResult("Wallpaper aplicado com sucesso via script.", "")
			}
		}(psScript)

	case "custom_script":
		go runPowerShellScript(payload)

	default:
		log.Printf("❓ Comando desconhecido: %s", command)
	}
}
func postData(endpoint string, data interface{}) {
	jsonValue, err := json.Marshal(data)
	if err != nil { return }

	url := fmt.Sprintf("%s%s", API_BASE_URL, endpoint)

	for i := 0; i < MAX_RETRIES; i++ {
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonValue))
		if err != nil { return }
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-agent-secret", AgentSecret)
		resp, err := httpClient.Do(req)
		if err != nil {
			if i < MAX_RETRIES-1 { time.Sleep(RETRY_DELAY) }
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
		if i < MAX_RETRIES-1 { time.Sleep(RETRY_DELAY) }
	}
}

func registerMachine() {
	info := collectStaticInfo()
	url := fmt.Sprintf("%s/register", API_BASE_URL)
	jsonValue, _ := json.Marshal(info)

	for {
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonValue))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("x-agent-secret", AgentSecret)
			
			resp, err := httpClient.Do(req)
			if err == nil {
				defer resp.Body.Close()
				if resp.StatusCode >= 200 && resp.StatusCode < 300 {
					body, _ := io.ReadAll(resp.Body)
					var regResp RegistrationResponse
					json.Unmarshal(body, &regResp)
					GlobalMachineIP = regResp.MachineIP
					log.Printf("✅ Máquina registrada! IP: %s | UUID: %s", GlobalMachineIP, info.UUID)
					return 
				}
			}
		}
		time.Sleep(30 * time.Second)
	}
}

func main() {
	lockListener, err := net.Listen("tcp", "127.0.0.1:65432")
	if err != nil {
		return 
	}
	defer lockListener.Close()

	setupLogger()
	log.Printf("Agente v%s Iniciando...", AGENT_VERSION)

	ensureAutoStart()
	preventSystemSleep()

	go registerMachine()
	go checkForUpdates()
	go startNetworkMonitor()

	go func() {
		for {
			time.Sleep(1 * time.Minute)
			checkAutoShutdown()
		}
	}()

	go func() {
		for {
			postData("/telemetry", collectTelemetry())
			time.Sleep(TELEMETRY_INTERVAL)
		}
	}()

	systray.Run(onReady, onExit)
}