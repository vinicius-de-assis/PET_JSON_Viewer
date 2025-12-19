// utils.js - Funções utilitárias

function hasTelemetryData(message) {
  return message.STEPS !== undefined || 
         message.ATV !== undefined || 
         message.REST !== undefined ||
         message.TEMP_MED !== undefined ||
         message.TEMP_MAX !== undefined ||
         message.TEMP_MIN !== undefined ||
         message.VEL !== undefined;
}

function hasConfigData(message) {
  return message.REDES !== undefined || 
         message.CERCA !== undefined || 
         message.PERIODICIDADES !== undefined;
}

function normalizeBatteryData(batChar, batVolt) {
  let normalizedChar = batChar;
  let normalizedVolt = batVolt;
  
  if (batChar > 100 && batChar < 5000) {
    normalizedChar = Math.max(0, Math.min(100, ((batChar - 3000) / (4300 - 3000)) * 100));
  }
  
  if (batVolt === 100) {
    normalizedVolt = 4200;
  }
  
  return {
    char: Math.round(normalizedChar),
    volt: normalizedVolt
  };
}

function formatarTempo(segundos) {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segs = Math.floor(segundos % 60);
  return `${horas}h ${minutos}m ${segs}s`;
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getCorModo(modo) {
  const cores = {
    'PASSEIO': '#4CAF50',
    'NORMAL': '#2196F3',
    'RASTREIO': '#FF9800',
    'default': '#667eea'
  };
  return cores[modo] || cores['default'];
}

// utils.js - Adicione também esta função
function analyzeDataFormats(data) {
  const analysis = {
    total: data.length,
    withExternalTimestamp: 0,
    withDateField: 0,
    withTimeField: 0,
    withBothDateTime: 0,
    timestampSources: {},
    ccids: new Set()
  };
  
  data.forEach(item => {
    analysis.ccids.add(item.message.CCID);
    
    if (item.timestamp && item.timestamp !== item.message.timestamp) {
      analysis.withExternalTimestamp++;
    }
    
    if (item.message.DATE) analysis.withDateField++;
    if (item.message.TIME) analysis.withTimeField++;
    if (item.message.DATE && item.message.TIME) analysis.withBothDateTime++;
    
    // Analisar fonte do timestamp
    const source = item.timestamp ? 
      (item.timestamp.includes('T') ? 'ISO' : 'custom') : 
      (item.message.DATE && item.message.TIME ? 'DATE/TIME' : 'unknown');
    
    analysis.timestampSources[source] = (analysis.timestampSources[source] || 0) + 1;
  });
  
  analysis.uniqueCCIDs = Array.from(analysis.ccids);
  
  return analysis;
}

function parseDateTime(dateStr, timeStr) {
  try {
    // Formato: "DD/MM/YY"
    const [day, month, year] = dateStr.split('/');
    const fullYear = "20" + year; // Converte "25" para "2025"
    
    // Formato: "HH:MM:SS"
    const [hours, minutes, seconds] = timeStr.split(':');
    
    // Criar objeto Date
    const date = new Date(
      parseInt(fullYear),
      parseInt(month) - 1, // Mês é 0-indexed
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
    
    // Retornar como ISO string
    return date.toISOString();
  } catch (error) {
    console.warn('Erro ao parsear DATE/TIME:', dateStr, timeStr, error);
    return new Date().toISOString();
  }
}

function normalizeDataFormat(parsedLine) {
  // Se já estiver no formato correto com timestamp
  if (parsedLine.timestamp && parsedLine.message) {
    return {
      timestamp: parsedLine.timestamp,
      message: parsedLine.message
    };
  }
  
  // Se for o formato direto (sem wrapper)
  if (parsedLine.CCID || parsedLine.DATE) {
    let timestamp;
    
    // Tentar obter timestamp de DATE e TIME
    if (parsedLine.DATE && parsedLine.TIME) {
      timestamp = parseDateTime(parsedLine.DATE, parsedLine.TIME);
    } 
    // Se não tiver DATE/TIME, verificar outros campos
    else if (parsedLine.timestamp) {
      timestamp = parsedLine.timestamp;
    } else {
      // Usar timestamp atual como fallback
      timestamp = new Date().toISOString();
      console.warn('Sem timestamp disponível, usando data atual:', parsedLine);
    }
    
    return {
      timestamp: timestamp,
      message: parsedLine
    };
  }
  
  // Formato desconhecido
  console.warn('Formato desconhecido, ignorando linha:', parsedLine);
  return null;
}

function normalizeBatteryData(batChar, batVolt) {
  let normalizedChar = batChar;
  let normalizedVolt = batVolt;
  
  if (batChar > 100 && batChar < 5000) {
    // Supor que 4200-4300 é 100% e 3000 é 0%
    normalizedChar = Math.max(0, Math.min(100, ((batChar - 3000) / (4300 - 3000)) * 100));
  }
  
  if (batVolt === 100) {
    normalizedVolt = 4200; // Valor padrão em mV
  }
  
  return {
    char: Math.round(normalizedChar),
    volt: normalizedVolt
  };
}