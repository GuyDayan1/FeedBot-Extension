const Papa = require('papaparse');



export function exportToExcelFile(data, sheetName = 'Sheet', headers) {
    const rows = data.map(item => {
        return [item.phoneNumber, item.phoneBookContactName, item.whatsappUserName];
    });

    const csvData = Papa.unparse({
        fields: headers,
        data: rows
    });

    const utf8Bom = '\uFEFF'; // Byte Order Mark (BOM) for UTF-8
    const csvContent = utf8Bom + csvData;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sheetName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}



export function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = (e) => {
            const csvData = e.target.result;
            const parsedData = Papa.parse(csvData, { header: true }); // Assuming the CSV has headers
            const data = parsedData.data;
            const headers = parsedData.meta.fields; // Extract the header names
            const colsSize = Object.keys(data[0]).length;
            const columnKeys = generateColumnKeys(colsSize);
            const newExcelData = data.map((row) => {
                const newRow = {};
                Object.keys(row).forEach((field, index) => {
                    const key = columnKeys[index];
                    newRow[key] = row[field];
                });
                return newRow;
            });

            resolve({ data: newExcelData, headers });
        };
        reader.onerror = (error) => {
            reject(error);
        };
    });
}

function generateColumnKeys(numColumns) {
    const columnKeys = [];
    const startCharCode = 'A'.charCodeAt(0);
    for (let i = 0; i < numColumns; i++) {
        const charCode = startCharCode + i;
        const columnName = String.fromCharCode(charCode);
        columnKeys.push('col' + columnName);
    }

    return columnKeys;
}


/// XLSX lib

// export function readExcelData(file) {
//     return new Promise((resolve, reject) => {
//         const reader = new FileReader(); // Create a new FileReader object to read the file
//         reader.readAsArrayBuffer(file); // Read the file as an ArrayBuffer
//         reader.onload = () => {
//             const fileData = reader.result; // Get the loaded file data
//             const workbookData = new Uint8Array(fileData); // Convert the file data to a Uint8Array
//             const workbook = readFile(workbookData, { type: 'array' }); // Parse the workbook data using xlsx library
//             const sheetName = workbook.SheetNames[0]; // Assuming the data is in the first sheet, get the sheet name
//             const worksheet = workbook.Sheets[sheetName]; // Get the worksheet data using the sheet name
//             const jsonData = utils.sheet_to_json(worksheet, { header: 1 }); // Convert the worksheet data to JSON format
//             resolve(jsonData); // Resolve the promise with the parsed JSON data
//         };
//         reader.onerror = (error) => {
//             reject(error); // Reject the promise if there's an error reading the file
//         };
//     });
// }

// export function exportToExcel(data, sheetName = "Sheet", headers) {
//     const worksheet = utils.json_to_sheet(data);
//     const workbook = utils.book_new();
//     utils.book_append_sheet(workbook, worksheet, sheetName);
//     utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
//     worksheet["!cols"] = [ { wch: 12 } ]; // set column A width to 12 characters
//     const excelBuffer = writeXLSX(workbook, { bookType: "xlsx", type: "array" });
//     const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
//     const link = document.createElement("a");
//     link.href = window.URL.createObjectURL(blob);
//     link.download = `${sheetName}.xlsx`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
// }