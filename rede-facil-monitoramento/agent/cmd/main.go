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
const API_BASE_URL = "http://localhost:3001/api" 
const TELEMETRY_INTERVAL = 5 * time.Second 

// --- ESTRUTURAS DE DADOS ---
type MachineInfo struct {
    UUID              string `json:"uuid"`
    Hostname          string `json:"hostname"`
    IPAddress         string `json:"ip_address"` 
    OSName            string `json:"os_name"`
    CPUModel          string `json:"cpu_model"`
    RAMTotalGB        float64 `json:"ram_total_gb"`
    DiskTotalGB       float64 `json:"disk_total_gb"`
    MACAddress        string `json:"mac_address"` 
    InstalledSoftware []Software `json:"installed_software"`
}

type Software struct {
    Name    string `json:"name"`
    Version string `json:"version"`
}

type TelemetryData struct {
    UUID               string  `json:"uuid"`
    CPUUsagePercent    float64 `json:"cpu_usage_percent"`
    RAMUsagePercent    float64 `json:"ram_usage_percent"`
    DiskFreePercent    float64 `json:"disk_free_percent"`
    TemperatureCelsius float64 `json:"temperature_celsius"` 
}

// --- FUNÇÕES DE COLETA DE DADOS ---
func getMachineUUID() string {
    h, _ := os.Hostname()
    u, _ := user.Current()
    return fmt.Sprintf("%s-%s", h, u.Username)
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

    var diskTotalGB float64
    if len(dPartitions) > 0 {
        dUsage, _ := disk.Usage(dPartitions[0].Mountpoint)
        diskTotalGB = float64(dUsage.Total) / (1024 * 1024 * 1024)
    }

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

func collectTelemetryData() TelemetryData {
    cpuPercents, _ := cpu.Percent(0, false) 
    cpuUsage := 0.0
    if len(cpuPercents) > 0 {
        cpuUsage = cpuPercents[0]
    }

    mInfo, _ := mem.VirtualMemory()
    ramUsage := mInfo.UsedPercent

    diskUsage := 0.0
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
    
    // CORRIGIDO: Chama a função real de coleta de temperatura
    temperature := getCPUTemperature() 

    return TelemetryData{
        UUID:                getMachineUUID(),
        CPUUsagePercent:     cpuUsage,
        RAMUsagePercent:     ramUsage,
        DiskFreePercent:     diskUsage,
        TemperatureCelsius: temperature,
    }
}

// --- FUNÇÃO PARA COLETAR TEMPERATURA (Reintroduzida e Corrigida para gopsutil/v3) ---
func getCPUTemperature() float64 {
    // A chamada correta para gopsutil/v3 é host.SensorsTemperatures()
    sensors, err := host.SensorsTemperatures()
    if err != nil {
        log.Printf("⚠️ Não foi possível coletar a temperatura da CPU (Host Sensors error): %v", err)
        return 0.0
    }

    var totalTemp float64
    var count int

    for _, sensor := range sensors {
        // Tenta encontrar sensores de CPU ou usa o primeiro encontrado se nenhum for específico
        if sensor.SensorKey == "coretemp" || sensor.SensorKey == "cpu-fan" || count == 0 {
            totalTemp += sensor.Temperature
            count++
        }
    }

    if count > 0 {
        return totalTemp / float64(count)
    }

    return 0.0
}


// --- FUNÇÃO DE COMUNICAÇÃO HTTP ---
func postData(endpoint string, data interface{}) {
    jsonValue, err := json.Marshal(data)
    if err != nil {
        log.Printf("Erro ao serializar JSON para %s: %v", endpoint, err)
        return
    }

    url := fmt.Sprintf("%s%s", API_BASE_URL, endpoint)
    
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

    // 1. REGISTRO INICIAL
    machineInfo := collectStaticInfo()
    log.Println("Tentando registrar/atualizar máquina com UUID:", machineInfo.UUID)
    postData("/register", machineInfo)

    // 2. LOOP DE TELEMETRIA CONTÍNUA
    ticker := time.NewTicker(TELEMETRY_INTERVAL)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            telemetry := collectTelemetryData()
            // CORRIGIDO: Linha de log para incluir a temperatura
            log.Println("Enviando telemetria:", 
                strconv.FormatFloat(telemetry.CPUUsagePercent, 'f', 2, 64), 
                "% CPU | Temperatura:", 
                strconv.FormatFloat(telemetry.TemperatureCelsius, 'f', 2, 64), 
                "°C")
            postData("/telemetry", telemetry)
        }
    }
}