import {utils, writeXLSX} from 'xlsx';

export function exportToExcel(data, sheetName = "Sheet", headers) {
    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, sheetName);
    utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
    worksheet["!cols"] = [ { wch: 12 } ]; // set column A width to 10 characters
    const excelBuffer = writeXLSX(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `${sheetName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// if (headers.length === 0) {
//     headers = Object.keys(data[0]); // Default to all headers if not specified
// }