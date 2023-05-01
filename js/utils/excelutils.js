import * as XLSX from "xlsx";

export function exportToExcel(data, sheetName = "Sheet1") {
    // data = [{phone:"972546432705", name:"guy"}, {phone:"972555555", name:"moshe"];
    const worksheet = XLSX.utils.json_to_sheet(data); //This converts the array of phone objects to a worksheet object using the json_to_sheet method from the XLSX library.
    const headers = Object.keys(data[0]);   // ['phone','name']
    const headerRow = headers.map(header => [header]);  // [['phone'] , ['name']]
    XLSX.utils.sheet_add_aoa(worksheet, headerRow, { origin: "A1" });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }); /// This converts the workbook object to an Excel file buffer using the write method from the XLSX library.
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); // This creates a new blob object from the Excel file buffer
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `${sheetName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}