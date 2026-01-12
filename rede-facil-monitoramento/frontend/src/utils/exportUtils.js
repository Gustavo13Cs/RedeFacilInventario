import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


export const generateExcel = (data, sheetName, fileName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};


export const generatePDF = ({ title, details = [], columns, rows, fileName, didParseCell }) => {
    const doc = new jsPDF();

    doc.setTextColor(15, 23, 42); 
    doc.setFontSize(18);
    doc.text(title, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    let yPos = 28;
    details.forEach(detail => {
        doc.text(detail, 14, yPos);
        yPos += 5;
    });

    autoTable(doc, {
        head: [columns],
        body: rows,
        startY: yPos + 2,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] }, 
        alternateRowStyles: { fillColor: [241, 245, 249] }, 
        styles: { fontSize: 9, cellPadding: 3 },
        didParseCell: didParseCell 
    });

    doc.save(`${fileName}.pdf`);
};