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
	"strings"
	"time"
<<<<<<< HEAD
=======
	"path/filepath"
    "strconv"
>>>>>>> b793f4c98b9439697e51e4c9b53313921da35bb7

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
    gonet "github.com/shirou/gopsutil/v3/net"
)

const BACKUP_FOLDER_PATH = "C:\\Users\\Windows 10\\Documents\\backup_agente"
const API_BASE_URL = "http://localhost:3001/api"
const TELEMETRY_INTERVAL = 5 * time.Second

const MAX_RETRIES = 3
const RETRY_DELAY = 10 * time.Second

var GlobalMachineIP string

type NetworkInterface struct {
    InterfaceName string `json:"interface_name"`
    MACAddress    string `json:"mac_address"`
    IsUp          bool   `json:"is_up"`
    SpeedMbps     int    `json:"speed_mbps"`
}

type MachineInfo struct {
<<<<<<< HEAD
	UUID      string `json:"uuid"`
	Hostname  string `json:"hostname"`
	IPAddress string `json:"ip_address"`
	OSName    string `json:"os_name"`
	CPUModel  string `json:"cpu_model"`

	CPUSpeedMhz      float64 `json:"cpu_speed_mhz"`
	CPUCoresPhysical int     `json:"cpu_cores_physical"`
	CPUCoresLogical  int     `json:"cpu_cores_logical"`

	RAMTotalGB  float64 `json:"ram_total_gb"`
	DiskTotalGB float64 `json:"disk_total_gb"`
	MACAddress  string  `json:"mac_address"`

	MachineModel string `json:"machine_model"`
	SerialNumber string `json:"serial_number"`
	MachineType  string `json:"machine_type"`

	MotherboardManufacturer string `json:"mb_manufacturer"`
	MotherboardModel        string `json:"mb_model"`
	MotherboardVersion      string `json:"mb_version"`

=======
	UUID              string     `json:"uuid"`
	Hostname          string     `json:"hostname"`
	IPAddress         string     `json:"ip_address"`
	OSName            string     `json:"os_name"`
	CPUModel          string     `json:"cpu_model"`
    
    CPUSpeedMhz       float64    `json:"cpu_speed_mhz"`
    CPUCoresPhysical  int        `json:"cpu_cores_physical"`
    CPUCoresLogical   int        `json:"cpu_cores_logical"`
    
	RAMTotalGB        float64    `json:"ram_total_gb"`
	DiskTotalGB       float64    `json:"disk_total_gb"`
	MACAddress        string     `json:"mac_address"`
    
	MachineModel      string     `json:"machine_model"`
	SerialNumber      string     `json:"serial_number"`
    MachineType       string     `json:"machine_type"`
    
    MotherboardManufacturer string `json:"mb_manufacturer"`
    MotherboardModel        string `json:"mb_model"`
    MotherboardVersion      string `json:"mb_version"`
    
    GPUModel                string `json:"gpu_model"`
    GPUVRAMMB               int    `json:"gpu_vram_mb"`
    
    LastBootTime            string `json:"last_boot_time"` 
    
    // 🚨 NOVOS CAMPOS PARA SLOTS DE MEMÓRIA
    MemSlotsTotal           int    `json:"mem_slots_total"`
    MemSlotsUsed            int    `json:"mem_slots_used"`
    
    NetworkInterfaces []NetworkInterface `json:"network_interfaces"` 
    
>>>>>>> b793f4c98b9439697e51e4c9b53313921da35bb7
	InstalledSoftware []Software `json:"installed_software"`
}

type Software struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type TelemetryData struct {
	UUID                string  `json:"uuid"`
	Hostname            string  `json:"hostname"`
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
	result := strings.TrimSpace(out.String())
	lines := strings.Split(result, "\n")
	if len(lines) > 1 {
		return strings.TrimSpace(lines[1])
	}
	return "N/A"
}

<<<<<<< HEAD
=======
// FUNÇÃO AUXILIAR: COLETAR SLOTS DE MEMÓRIA
func getMemorySlotsInfo() (total int, used int) {
    if runtime.GOOS != "windows" {
        return 0, 0 
    }

    // 1. Total de Slots (MemoryDevices)
    totalOutput := execWmic("memphysical get MemoryDevices")
    totalString := strings.TrimSpace(totalOutput)
    
    totalValue, err := strconv.Atoi(totalString)
    if err == nil && totalValue > 0 {
        total = totalValue
    }

    // 2. Slots Usados (Conta quantos módulos de memória estão instalados)
    cmd := exec.Command("wmic", "memorychip", "get", "banklabel")
    var out bytes.Buffer
    cmd.Stdout = &out
    
    if err := cmd.Run(); err != nil {
        return total, 0
    }
    
    // Contagem de linhas que contêm um BankLabel (slots usados)
    lines := strings.Split(out.String(), "\n")
    used = 0
    for i, line := range lines {
        line = strings.TrimSpace(line)
        if i == 0 || line == "" || line == "BankLabel" {
            continue 
        }
        // Se a linha tem conteúdo e não é o cabeçalho, é um slot usado
        used++
    }
    
    return total, used
}


// FUNÇÃO PARA MAPEAMENTO ESPECÍFICO DO TIPO DE CHASSIS (Notebook/Desktop/Servidor)
>>>>>>> b793f4c98b9439697e51e4c9b53313921da35bb7
func getMachineType() string {
	if runtime.GOOS != "windows" {
		return "Indefinido"
	}

<<<<<<< HEAD
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
		// Fallback para VM/Ambientes Virtuais
		productName := execWmic("csproduct get name")
		if strings.Contains(strings.ToLower(productName), "vmware") ||
			strings.Contains(strings.ToLower(productName), "virtualbox") ||
			strings.Contains(strings.ToLower(productName), "server") {
			return "VM/Servidor"
		}
		return "Hardware Genérico"
	}
}

=======
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
        productName := execWmic("csproduct get name")
        if strings.Contains(strings.ToLower(productName), "vmware") || 
           strings.Contains(strings.ToLower(productName), "virtualbox") ||
           strings.Contains(strings.ToLower(productName), "server") {
            return "VM/Servidor"
        }
        return "Hardware Genérico" 
    }
}

// FUNÇÃO AUXILIAR: COLETAR INFORMAÇÕES DA GPU
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

// FUNÇÃO DE COLETA PLACAS DE REDE
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

        speed := 0 

        nics = append(nics, NetworkInterface{
            InterfaceName: iface.Name,
            MACAddress:    iface.HardwareAddr, 
            IsUp:          isUp,
            SpeedMbps:     speed,
        })
    }
    return nics
}


>>>>>>> b793f4c98b9439697e51e4c9b53313921da35bb7
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

// 🚨 FUNÇÃO DE COLETA ESTÁTICA COM SLOTS DE MEMÓRIA ADICIONADOS
func collectStaticInfo() MachineInfo {
	hInfo, _ := host.Info()
	mInfo, _ := mem.VirtualMemory()
	cInfos, _ := cpu.Info()
	dPartitions, _ := disk.Partitions(false)

	cpuModel := "N/A"
	var cpuSpeed float64
	var cpuCoresPhysical int
	var cpuCoresLogical int

	// COLETANDO DADOS DETALHADOS DA CPU
	if len(cInfos) > 0 {
		cpuModel = cInfos[0].ModelName
		cpuSpeed = cInfos[0].Mhz
	}

	cpuCoresPhysical, _ = cpu.Counts(false)
	cpuCoresLogical, _ = cpu.Counts(true)
	// FIM DA COLETA DE CPU

	machineModel := execWmic("csproduct get name")
	serialNumber := execWmic("bios get serialnumber")

	if serialNumber == "N/A" {
		serialNumber = hInfo.HostID
	}
<<<<<<< HEAD

	machineType := getMachineType()

	mbManufacturer := execWmic("baseboard get manufacturer")
	mbModel := execWmic("baseboard get product")
	mbVersion := execWmic("baseboard get version")
=======
    
    // COLETANDO O TIPO DA MÁQUINA
    machineType := getMachineType() 
    
    // COLETANDO INFORMAÇÕES DA PLACA-MÃE
    mbManufacturer := execWmic("baseboard get manufacturer")
    mbModel := execWmic("baseboard get product")
    mbVersion := execWmic("baseboard get version")
    
    // COLETANDO INFORMAÇÕES DA GPU
    gpuModel, gpuVRAM := getGPUInfo() 

    // COLETA DA ÚLTIMA INICIALIZAÇÃO
    bootTime, err := host.BootTime()
    var lastBootTime string
    if err == nil {
        lastBootTime = time.Unix(int64(bootTime), 0).Format("2006-01-02 15:04:05")
    } else {
        lastBootTime = "N/A"
    }

    // 🚨 COLETANDO SLOTS DE MEMÓRIA
    memSlotsTotal, memSlotsUsed := getMemorySlotsInfo()
    
    // COLETANDO PLACAS DE REDE
    networkInterfaces := collectNetworkInterfaces()
>>>>>>> b793f4c98b9439697e51e4c9b53313921da35bb7

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
<<<<<<< HEAD
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

		InstalledSoftware: []Software{{Name: "Agente Go", Version: "2.3"}},
=======
		UUID:              getMachineUUID(),
		Hostname:          hInfo.Hostname,
		IPAddress:         getLocalIP(),
		OSName:            fmt.Sprintf("%s %s", hInfo.OS, hInfo.Platform),
		CPUModel:          cpuModel,
		CPUSpeedMhz:       cpuSpeed,
		CPUCoresPhysical:  cpuCoresPhysical,
		CPUCoresLogical:   cpuCoresLogical,
		RAMTotalGB:        float64(mInfo.Total) / (1024 * 1024 * 1024),
		DiskTotalGB:       diskTotalGB,
		MACAddress:        "00:00:00:00:00:00",
		MachineModel:      machineModel,
		SerialNumber:      serialNumber,
        MachineType:       machineType,
        
        MotherboardManufacturer: mbManufacturer,
        MotherboardModel: mbModel,
        MotherboardVersion: mbVersion,
        
        GPUModel: gpuModel,
        GPUVRAMMB: gpuVRAM,
        
        LastBootTime: lastBootTime,
        
        // 🚨 NOVOS CAMPOS ENVIADOS
        MemSlotsTotal: memSlotsTotal,
        MemSlotsUsed: memSlotsUsed,
        
        // ENVIANDO O ARRAY DE PLACAS DE REDE
        NetworkInterfaces: networkInterfaces,
        
		InstalledSoftware: []Software{{Name: "Agente Go", Version: "2.9"}},
>>>>>>> b793f4c98b9439697e51e4c9b53313921da35bb7
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
	hInfo, _ := host.Info()

	return TelemetryData{
		UUID:                getMachineUUID(),
		Hostname:            hInfo.Hostname,
		CPUUsagePercent:     cpuUsage,
		RAMUsagePercent:     ramUsage,
		DiskFreePercent:     diskUsageFree,
		DiskSmartStatus:     "OK",
		TemperatureCelsius:  temperature,
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
