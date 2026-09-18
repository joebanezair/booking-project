function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cell(value, type = "String") {
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function row(values) {
  return `<Row>${values.join("")}</Row>`;
}

function worksheet(name, rows) {
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows.join("")}</Table></Worksheet>`;
}

export function exportSalesSpreadsheet(data, rangeLabel = "Sales") {
  const summaryRows = [
    row([cell("Metric"), cell("Value")]),
    row([cell("Period"), cell(rangeLabel)]),
    row([cell("Primary Currency"), cell(data.primaryCurrency || "PHP")]),
    row([cell("Recorded Sales"), cell(data.summary?.totalSales || 0, "Number")]),
    row([cell("Completed Services"), cell(data.summary?.completedServices || 0, "Number")]),
    row([cell("Average Sale"), cell(data.summary?.averageSale || 0, "Number")]),
    row([cell("Services Sold"), cell(data.summary?.servicesSold || 0, "Number")])
  ];

  for (const total of data.totalsByCurrency || []) {
    summaryRows.push(row([
      cell(`Total ${total.currency}`),
      cell(total.totalSales || 0, "Number")
    ]));
  }

  const recordRows = [
    row(["Sale ID","Booking ID","Completed Date","Booking Date","Customer Name","Customer Email","Customer Phone","Service","Sale Amount","Currency","Status","Location"].map(value => cell(value)))
  ];
  for (const sale of data.records || []) {
    recordRows.push(row([
      cell(sale.id),
      cell(sale.bookingId),
      cell(new Date(sale.completedAt).toLocaleString()),
      cell(new Date(sale.bookingDate).toLocaleString()),
      cell(sale.guestName),
      cell(sale.guestEmail),
      cell(sale.guestPhone),
      cell(sale.serviceName),
      cell(sale.saleAmount || 0, "Number"),
      cell(sale.currency),
      cell(sale.status),
      cell(sale.locationLabel)
    ]));
  }

  const serviceRows = [
    row([cell("Service"), cell("Completed Sales"), cell("Revenue"), cell("Currency")])
  ];
  for (const service of data.byService || []) {
    serviceRows.push(row([
      cell(service.service),
      cell(service.sales || 0, "Number"),
      cell(service.revenue || 0, "Number"),
      cell(data.primaryCurrency || "PHP")
    ]));
  }

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 ${worksheet("Summary", summaryRows)}
 ${worksheet("Sales Records", recordRows)}
 ${worksheet("Service Performance", serviceRows)}
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeLabel = String(rangeLabel || "Sales").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  const link = document.createElement("a");
  link.href = url;
  link.download = `BookFlow_Sales_${safeLabel || "Report"}.xml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
