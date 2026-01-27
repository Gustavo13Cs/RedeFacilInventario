package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
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

// --- CONFIGURAÇÕES ---
const AGENT_VERSION = "6.4-PRO" 
const UPDATE_BASE_URL = "https://192.168.50.60:3001/updates"
const UPDATE_URL_VERSION = "https://192.168.50.60:3001/updates/version.txt"
const UPDATE_URL_EXE = "https://192.168.50.60:3001/updates/AgenteRedeFacil.exe"
const API_BASE_URL = "https://192.168.50.60:3001/api"

const RESTORE_POINT_FILE = "restore_point_last_run.txt"
const TELEMETRY_INTERVAL = 20 * time.Second 
const RESTORE_POINT_INTERVAL = 168 * time.Hour

const MAX_RETRIES = 3
const RETRY_DELAY = 10 * time.Second

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

const (
	MB_OK                = 0x00000000
	MB_ICONASTERISK      = 0x00000040 
	MB_ICONEXCLAMATION   = 0x00000030
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


func showNativeMessage(title, text string, iconType uintptr) {
	if runtime.GOOS == "windows" {
		titlePtr, _ := syscall.UTF16PtrFromString(title)
		textPtr, _ := syscall.UTF16PtrFromString(text)
		

		messageBox.Call(
			0, 
			uintptr(unsafe.Pointer(textPtr)), 
			uintptr(unsafe.Pointer(titlePtr)), 
			iconType | MB_TOPMOST, 
		)
	}
}


func onReady() {
	systray.SetIcon(getIconData()) 
	
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
				showNativeMessage("Aguarde", "Enviando solicitação para a central de TI...", MB_ICONASTERISK)
				sendHelpRequest()
			}
		}
	}()
}

func onExit() {
	// Limpeza
}

func getIconData() []byte {

	iconB64 := "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U0jfZc8uGnotebvUWSG09rLkjtCsmduVor7dyKeX3Tos8LXkVqXNB7/l0kwSFle8eBVxLL1P0tFOm15u9RZIbT2rQfiNLPvQmytFTCanyTZYnXL2+Kp6iO7/AFJ0srrp5/G6VwoZjUeScB8NoZ96e1a9po5pqCqGgnA67EXRONnJ8BfCxvV81jer5rG9XzWN6vmsb1fNY3q+axvV80HSuNoI8DeCoKGcjqMTnuNXONSe2DmOLXDuIVC5kv1tWCg0HisFBoPFYKDQeKwUGg8VgoNB4rBQaDxWCg0HiqBzIvoai57i5x7yf4e//8QAKBABAAECBAYCAwEBAAAAAAAAAREAYSExQaEQMFFxkfAggXDB4bHR/9oACAEBAAE/Ifw67RIHK0XMumN4J5AYMGDBgwZuZNMbwxTtEgcJznxEA1WgAShdLFqwesLeF1q9qvar2q9qvar2q9qwesDeV0pAEoHWzanxMI0TminIJ3wCjKmEOnM3Pmi3S6B1aDA0NLHn+U4F0JTKiEevI2aFOBTviPOK9/8APiK8uzCMZJ8cDxE/qzh+63/P1avf8NooG11awcMxF3DTPiI0KYmOtIQKYAa0i6KW/jPbVia3AB5z7nSBooigaMRVqH8h0K3/AD9Wr3/DylAXUa7VlTgT/aB0yWLnOPqmJh3N/wB/Xdtm+OKUkgQfRfFv+fq1e/48YwYx51FspxFxd9uh7kHpIyZ0Be0L7e5Jn6gTx3/P1avf8cHrXtCCk2kbqpqLBUmsX19whh1yFwE6HvcbpSdgbUyBAwjpw3/P1avf17dOh1aSUu0vpmpzTUYv1/NK0kg/ifuk8PK5WncMBGgQ0cA0pkFBJA5ZTw3/AD9Wr39ZShPzWPAUCHDwYYt+PcKg7g1nmcwB7xnx3/O1apwCd8EoypgDrzdikZOkFHRDqY8f2k7Z16WPmyogHpyd2lTkU74rzT4iAaJQBIQuty1YvWEvCaVe1XtV7Ve1XtV7Ve1YvWAvKa0gSEDpdtT4mEarznaJK4Si5k1xvJHIDBgwYMGDNzLrjeWadokrlfw9/9oADAMBAAIAAwAAABD333333333333333333333333333333333333333332VDHHEbX333330j330eFz333332jnPLwr3333332j0oLan3333332hQ+0yn3333330YNPDCZf3333321z330/wB999999999999999999999999999999999999999999//EACcRAQABAwMDBAIDAAAAAAAAAAERACExQVFhIKHwEDBxkVDRgcHh/9oACAEDAQE/EPxX0JqbAar2y8ujDKK79p0Agg6jyNzxcEdIQ8UikITrdOEC/Kf6dB+siAUAKaZbTe2LU5m3nJMzyITyUZsE37u932AQj0n2X7U1kGwCyJs/GmSZtNWgG/v4XvDIIolkhkgBIkBgELQgqRVyrea87g9kEl3KTubf8BuaTGfTbFTBC9cuSKUKFA1oGR3vmb3m/oZ53B7AIKYUiUAMaJdzfRLUHVy8ChBACIEyJFDGDRDlMk55uZzSTclmEq8CwHzf0M87g67mMr3w23QIanxSbr9YLyDEeYGpywyq6rqvqMMPzAwSMSQqlpiwEzNKKiRjYWx/B1ioSEo5Fm7Pdlrzj9V5x+q84/VNEIxKofBg/Gf/xAAnEQEBAAECBAYDAQEAAAAAAAABESEAMUFRYfAQIDBxodFQgZHB4f/aAAgBAgEBPxD8V7fb9m6vAP6uDigbYAJ8HzvI++/wbhJJ1woHGqcnbQASj5wcgIex/wCvIxxLVBJDi2CzEd88jYsN0i06Is6JpdqyfzB8HoPov9AM+ZoUxBVCIMvvx2ZMzWUvy+Pe98wIlY8QliKoEaOStGgfAgBgAiGu76vovszCxcnn/wC/kA1ExuDLBwNYOCYiC6KxMRRHkxtMYjMTwt7vq+g+1nqWFQvA4LMcRzyRnDiwMUUNoOwrxNE9da6JGbdEGSTOjBoCVAK7oVfbE43wt7vq+fFTgeUpnkI1wZzNBDibRuilE6VOmppxAAANgPGaankDAgg0AcgMUAA071hXNDL+3PnAIUdM67yJ8ENd+/eu/fvXfv3p9WbwC+7u/v8AGf/EACgQAQABAwQBBAICAwAAAAAAAAERACExQVFhcYEwQJGhECBwweHw8f/aAAgBAQABPxD+HZPFgv2Au0FAJIEORR0w+glSpUqVKlCgEsiHAp6Jak8WC/ZG56wcWPlZAHa187nRF3B+4l0BA8IOflF7BGy+hTTTTTTSgeAHPwg9kjdK+dzog5l/UyaiHFj4WQj0nqhAKjiErwy7KScE0MI+ZF4k1/e4IADAMpgDestXW89rZp997BiOES4maScE0sK+JE4g0oIBUMSleWXb7WRVqqlupDsJOvwVgGhmOfy+y1SJFQsZMEhXBwS+KTKAGT1UJZ2xsFO74AILCwFGTJM6U/kQOVOANaQzslbCvq+5KI/AP5Zxliw2BCBS66JlGFEr5j7oZEIgQTBaB/llX2VUiRU0qKLOEHMmj4bMlHAyJqNypmXBhMizezpXSoVchWDJ8QP/AAoRygyMsAHwAdFImAyVSQTVm/C6J7WqRIqskZFhlgtmhQkB20YI3ixxsUJLm1SiXJOlxmlN+g3QiPR2PGVoh3TkqMr7WqRIqUC3zqzhb7jqEzl4AKqwB4AOAoRDcOwiAwMLbvLLSO/E0jkmVAbW07o5IUpRubp3mONaW6kFCjI+yqkSKpvdYlgWU0D/AG9QQpjMQm4k/KeKexVrSF+KwliYAJZpmiCajZEs/TlLDrnMEuqtI9COuQCaXJ6R1pHJ2YASq6AVavNUQA+n2VUiRU1wSlmGPy/g+foBIKBm5GdvzZzKyRNki85pon+hnJ6LHsapAQGo4lC8sO2gnBNLCHiVeJdKyTUJ2I2RLI0OZ7Gr73zR+Z3SAGAwBt+4TgmhhTzKnEOtBAahiELww7PVTix8LJE6Svjc6Im5f1MOioHhBz8qPQY2D0KaaaaaaUDwA5+FXosbjXxudEDMH7iDVE4sfKyVe19aTxYL9xLlBQCCRDlU9svoJUqVKlSpQoBDAhwqOyGpPFgv3Vu/w9//2Q=="
	
	data, err := base64.StdEncoding.DecodeString(iconB64)
	if err != nil {
		log.Println("Erro ao carregar ícone:", err)
		return nil
	}
	return data
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
	if command == "" { return }
	log.Printf("⚠️ COMANDO: %s", command)

	switch command {
	case "shutdown":
		if runtime.GOOS == "windows" { runCommandHidden("shutdown", "/s", "/t", "0", "/f") }
	case "restart":
		if runtime.GOOS == "windows" { runCommandHidden("shutdown", "/r", "/t", "0", "/f") }
	case "clean_temp":
		if runtime.GOOS == "windows" { runCommandHidden("cmd", "/C", "del /q /f /s %TEMP%\\*") }
	case "cancel_shutdown":
		ShutdownCancelled = true
		sendCommandResult("Cancelado pelo usuário.", "")
	case "set_wallpaper":
		psScript := fmt.Sprintf(`
				$url = "%s"
				$path = "$env:TEMP\wallpaper_agente.jpg"
				if (Test-Path $path) { Remove-Item $path -Force }
				[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
				try {
					[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
					Invoke-WebRequest -Uri $url -OutFile $path -UseBasicParsing
				} catch {
					Write-Output "Erro no download: $_"
					exit
				}
				$code = @'
				using System;
				using System.Runtime.InteropServices;
				public class Wallpaper {
					[DllImport("user32.dll", CharSet = CharSet.Auto)]
					public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
				}
'@
				Add-Type -TypeDefinition $code
				[Wallpaper]::SystemParametersInfo(0x0014, 0, $path, 0x03)
			`, payload)
			go runPowerShellScript(psScript)
	case "custom_script":
		if runtime.GOOS == "windows" { runPowerShellScript(payload) }
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