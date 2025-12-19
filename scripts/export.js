// export.js - Funções de exportação de dados

function exportJSON() {
  if (pontosFiltrados.length === 0) {
    alert("Nenhum dado para exportar.");
    return;
  }
  const exportData = JSON.stringify(pontosFiltrados, null, 2);
  downloadFile(exportData, "dados_filtrados.json", "application/json");
}

function exportCSV() {
  if (pontosFiltrados.length === 0) {
    alert("Nenhum dado para exportar.");
    return;
  }
  
  const headers = ["timestamp", "CCID", "LAT", "LON", "BAT_CHAR", "BAT_VOLT", "STEPS", "ATV", "REST", "TEMP_MED", "TEMP_MAX", "TEMP_MIN", "VEL", "MODE"];
  const csvRows = [headers.join(',')];
  
  pontosFiltrados.forEach(ponto => {
    const m = ponto.message;
    const row = [
      ponto.timestamp,
      m.CCID,
      m.LAT,
      m.LON,
      m.BAT?.CHAR || '',
      m.BAT?.VOLT || '',
      m.STEPS || '',
      m.ATV || '',
      m.REST || '',
      m.TEMP_MED || '',
      m.TEMP_MAX || '',
      m.TEMP_MIN || '',
      m.VEL || '',
      m.MODE || ''
    ];
    csvRows.push(row.map(field => `"${field}"`).join(','));
  });
  
  downloadFile(csvRows.join('\n'), "dados_exportados.csv", "text/csv");
}

function exportGPX() {
  if (pontosFiltrados.length === 0) {
    alert("Nenhum dado para exportar.");
    return;
  }
  
  const pontosGPS = pontosFiltrados.filter(p => p.message.LAT !== 0 && p.message.LON !== 0);
  
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Analisador de LOGS Dashboard">
  <metadata>
    <name>Trajeto Exportado</name>
    <desc>Trajeto gerado em ${new Date().toLocaleString()}</desc>
  </metadata>
  <trk>
    <name>Trajeto Principal</name>
    <trkseg>
`;
  
  pontosGPS.forEach(ponto => {
    gpx += `      <trkpt lat="${ponto.message.LAT}" lon="${ponto.message.LON}">
        <time>${ponto.timestamp}</time>
        <ele>0</ele>
      </trkpt>\n`;
  });
  
  gpx += `    </trkseg>
  </trk>
</gpx>`;
  
  downloadFile(gpx, "trajeto.gpx", "application/gpx+xml");
}

function exportStats() {
  const analysis = analyzeDataQuality(pontosFiltrados);
  const statsData = {
    exportDate: new Date().toISOString(),
    dataRange: {
      start: pontosFiltrados[0]?.timestamp,
      end: pontosFiltrados[pontosFiltrados.length-1]?.timestamp
    },
    analysis: analysis
  };
  
  downloadFile(JSON.stringify(statsData, null, 2), "estatisticas.json", "application/json");
}

function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}