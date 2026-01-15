<div align="center">

# 🛡️ RFF Monitor | Sistema de Inventário e Governança de TI
### Rede Fácil Financeira — Divisão de Infraestrutura

![Status](https://img.shields.io/badge/Status-Produção-success?style=for-the-badge&logo=appveyor)
![Security](https://img.shields.io/badge/Security-TLS_1.3-blue?style=for-the-badge&logo=letsencrypt)
![Platform](https://img.shields.io/badge/Platform-Windows_Workstations-informational?style=for-the-badge&logo=windows)
![Access](https://img.shields.io/badge/Access-Internal_Restricted-red?style=for-the-badge&logo=auth0)

<p align="center">
  <b>Monitoramento Proativo • Inventário de Hardware • Compliance Financeiro</b>
</p>

</div>

---

## 📑 Índice
- [📍 Visão Geral do Projeto](#-visão-geral-do-projeto)
- [🏗️ Arquitetura da Solução](#-arquitetura-da-solução)
- [🖥️ Interface e Dashboards](#-interface-e-dashboards)
- [🚀 Funcionalidades Principais](#-funcionalidades-principais)
- [⚙️ Stack Tecnológico](#-stack-tecnológico)
- [📦 Instalação e Deploy](#-instalação-e-deploy)
- [🔒 Segurança e Privacidade](#-segurança-e-privacidade)

---

## 📍 Visão Geral do Projeto

O **RFF Monitor** é a solução definitiva de gerenciamento de ativos desenvolvida para a **Rede Fácil Financeira**. O sistema resolve o desafio de gerenciar um parque tecnológico distribuído em diversas unidades, garantindo que a equipe de TI tenha controle total sem precisar de deslocamento físico.

O software opera como um serviço de fundo (daemon), coletando telemetria vital para manutenção preventiva e auditoria de segurança.

---

## 🏗️ Arquitetura da Solução

O sistema foi desenhado seguindo uma arquitetura de **Microsserviços Event-Driven**, garantindo que o monitoramento de milhares de máquinas não sobrecarregue a rede da empresa.

### Diagrama de Fluxo de Dados

```mermaid
graph TD
    subgraph "Unidade Operacional (Endpoint)"
        A[🖥️ PC do Usuário] -->|Coleta WMI/CIM| B(Agente Local RFF)
        B -->|Criptografia AES-256| B
    end

    B -->|HTTPS / JSON Segura| C{Firewall Corporativo}

    subgraph "Infraestrutura Central (Cloud/On-Premise)"
        C -->|Load Balancer| D[API Gateway]
        D -->|Auth Token| E[Serviço de Ingestão]
        E -->|Persistência| F[(Banco de Dados Master)]
        E -->|Logs| G[(Elasticsearch / Logs)]
    end

    subgraph "Visualização e Gestão"
        F --> H[Backend Dashboard]
        H --> I[💻 Painel do Administrador]
        I -->|Alertas| J[📧 Email / Slack / Teams]
    end
