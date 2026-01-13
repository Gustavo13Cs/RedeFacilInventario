import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateExcel = (data, sheetName, fileName) => {
    const formattedData = data.map(item => ({
        "Patrimônio": item.patrimony_code || '',
        "Nome": item.name,
        "Modelo": item.model,
        "Marca": item.brand,
        "Tipo": item.type,
        "Serial": item.serial || item.serial_number,
        "Status": item.status === 'uso' ? 'Em Uso' : 
                  item.status === 'disponivel' ? 'Disponível' : 
                  item.status === 'manutencao' ? 'Manutenção' : 'Defeito',
        "Localização": item.location,
        "Responsável": item.assigned_to
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();

    const wscols = [
        {wch: 10}, {wch: 25}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 20}
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