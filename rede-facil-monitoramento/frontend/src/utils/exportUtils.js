import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export const generateExcel = (data, sheetName, fileName) => {
    const rows = data.map(item => ({
        "Patrimônio": item.patrimony_code || "S/N",
        "Nome do Item": item.name,
        "Marca": item.brand || '-',
        "Modelo": item.model || '-',
        "Serial": item.serial || item.serial_number || '-',
        "Tipo": item.type || 'Geral',
        "Status": item.status === 'uso' ? 'Em Uso' : 
                  item.status === 'disponivel' ? 'Disponível' : 
                  item.status === 'manutencao' ? 'Manutenção' : 
                  item.status === 'defeito' ? 'Defeito' : item.status,
        "Localização": item.location || '-',
        "Responsável": item.assigned_to || '-',
        "Observações": item.notes || ''
    }));

    const workbook = XLSX.utils.book_new();
    const title = [["REDE FÁCIL - RELATÓRIO DE INVENTÁRIO"]];
    const dateInfo = [[`Gerado em: ${new Date().toLocaleString()}`]];
    const emptyRow = [[]]; 

    const worksheet = XLSX.utils.json_to_sheet(rows, { origin: 'A5' }); 

    XLSX.utils.sheet_add_aoa(worksheet, title, { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, dateInfo, { origin: "A2" });
    XLSX.utils.sheet_add_aoa(worksheet, emptyRow, { origin: "A3" });

    const wscols = [
        { wch: 15 }, // Patrimônio
        { wch: 30 }, // Nome
        { wch: 15 }, // Marca
        { wch: 20 }, // Modelo
        { wch: 15 }, // Serial
        { wch: 15 }, // Tipo
        { wch: 15 }, // Status
        { wch: 25 }, // Localização
        { wch: 25 }, // Responsável
        { wch: 40 }  // Obs
    ];
    worksheet['!cols'] = wscols;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const generatePDF = ({ title, details = [], columns, rows, fileName }) => {
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REDE FÁCIL - Gestão de Ativos", 14, 13);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text(title, 14, 35);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    
    let yPos = 42;
    details.forEach(detail => {
        doc.text(detail, 14, yPos);
        yPos += 5;
    });

    autoTable(doc, {
        head: [columns],
        body: rows,
        startY: yPos + 5,
        theme: 'grid',
        headStyles: { 
            fillColor: [30, 58, 138],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        }, 
        bodyStyles: { 
            fontSize: 8,
            textColor: 50
        },
        alternateRowStyles: { 
            fillColor: [241, 245, 249] 
        }, 
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' }, 
            4: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }, 
            5: { cellWidth: 30 } 
        },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 4) {
                const text = data.cell.raw;
                if (text === 'Disponível') {
                    data.cell.styles.textColor = [16, 185, 129]; 
                } else if (text === 'Em Uso') {
                    data.cell.styles.textColor = [37, 99, 235]; 
                } else if (text === 'Defeito/Falta') {
                    data.cell.styles.textColor = [220, 38, 38]; 
                } else if (text === 'Manutenção') {
                    data.cell.styles.textColor = [234, 88, 12];
                }
            }
        }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Página ' + i + ' de ' + pageCount, 196, 290, { align: 'right' });
    }

    doc.save(`${fileName}.pdf`);
};

export const generateTagsPDF = async (items, type = 'generic') => {
    const doc = new jsPDF();
    
    const tagWidth = 63.5;
    const tagHeight = 33.9;
    const marginX = 10;
    const marginY = 10;
    
    let col = 0;
    let row = 0;

    const baseUrl = `${window.location.protocol}//${window.location.host}`;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        let code, title, subtitle, footer, qrLink;

        if (type === 'machines') {
            code = item.hostname; 
            title = "COMPUTADOR";
            subtitle = item.ip_address || "IP Dinâmico";
            footer = item.sector || "Sem Setor";
            qrLink = `${baseUrl}/view/machine/${item.uuid}`;
        } else if (type === 'chips') {
            code = item.name || item.id_number || "S/N"; 
            title = "CELULAR"; 
            subtitle = item.model || "Modelo Desconhecido";
            footer = item.employee_name || "ATIVO";
            qrLink = `${baseUrl}/view/device/${item.id}`;
        } else {
            code = item.patrimony_code || item.serial_number || "S/N";
            title = "PATRIMÔNIO";
            const modelInfo = `${item.brand || ''} ${item.model || ''}`.trim();
            const displayText = modelInfo || item.name || "Item sem nome";
            subtitle = displayText.length > 30 ? displayText.substring(0, 30) + '...' : displayText;
            footer = item.location || "Geral";
            qrLink = `${baseUrl}/view/item/${item.id}`;
        }

        const x = marginX + (col * tagWidth);
        const y = marginY + (row * tagHeight);

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.rect(x, y, tagWidth, tagHeight);

        doc.setFillColor(30, 58, 138); 
        doc.rect(x, y, tagWidth, 7, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("REDE FÁCIL", x + 2, y + 4.5);
        doc.setFontSize(6);
        doc.text(title, x + tagWidth - 2, y + 4.5, { align: 'right' });

        doc.setTextColor(0, 0, 0);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(code, x + 2, y + 14);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(subtitle, x + 2, y + 19);
        
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text(footer, x + 2, y + 28);

        try {
            const qrDataUrl = await QRCode.toDataURL(qrLink, { margin: 0 });
            doc.addImage(qrDataUrl, 'PNG', x + tagWidth - 22, y + 9, 20, 20);
        } catch (err) {
            console.error("Erro QR", err);
        }

        col++;
        if (col >= 3) {
            col = 0;
            row++;
            if (row >= 8) {
                doc.addPage();
                row = 0;
            }
        }
    }

    doc.save(`Etiquetas_${type.toUpperCase()}.pdf`);
};