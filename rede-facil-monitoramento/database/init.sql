CREATE TABLE machines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(64) NOT NULL UNIQUE, 
    hostname VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    os_name VARCHAR(100), 
    status ENUM('online', 'offline', 'maintenance') DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hardware_specs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT NOT NULL,
    cpu_model VARCHAR(150),
    ram_total_gb DECIMAL(5,2),
    disk_total_gb DECIMAL(10,2),
    mac_address VARCHAR(17),
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

CREATE TABLE installed_software (
    id INT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT NOT NULL,
    software_name VARCHAR(200),
    version VARCHAR(50),
    install_date DATE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);


CREATE TABLE telemetry_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT NOT NULL,
    cpu_usage_percent DECIMAL(5,2),
    ram_usage_percent DECIMAL(5,2),
    disk_free_percent DECIMAL(5,2),
    temperature_celsius DECIMAL(5,2), -- Opcional
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

CREATE INDEX idx_telemetry_machine_date ON telemetry_logs(machine_id, created_at);

CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    machine_id INT NOT NULL,
    alert_type ENUM('warning', 'critical') NOT NULL,
    message VARCHAR(255), 
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id)
);