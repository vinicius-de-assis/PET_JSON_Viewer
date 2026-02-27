// utils.js - Funções utilitárias

function hasTelemetryData(message) {
  // Verifica se tem dados de telemetria tradicionais
  const hasTraditionalTelemetry = 
    message.STEPS !== undefined || 
    message.ATV !== undefined || 
    message.REST !== undefined ||
    message.TEMP_MED !== undefined ||
    message.TEMP_MAX !== undefined ||
    message.TEMP_MIN !== undefined ||
    message.VEL !== undefined;
  
  // Verifica se tem dados de bateria (mesmo sem outros campos)
  const hasBatteryData = 
    message.BAT && 
    (message.BAT.CHAR !== undefined || message.BAT.VOLT !== undefined);
  
  // Verifica se tem dados de movimento
  const hasMovementData = 
    message.LAT !== undefined || 
    message.LON !== undefined ||
    message.GPS_WARN !== undefined;
  
  // Considera como telemetria se tiver QUALQUER um destes
  return hasTraditionalTelemetry || hasBatteryData || hasMovementData;
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

// utils.js - Função para diagnosticar dados de bateria

function diagnoseBatteryData(pontos) {
  const comBateria = pontos.filter(p => p.message.BAT);
  
  console.log("=== DIAGNÓSTICO DE BATERIA ===");
  console.log(`Total de pontos: ${pontos.length}`);
  console.log(`Pontos com BAT: ${comBateria.length}`);
  
  if (comBateria.length > 0) {
    const apenasBateria = comBateria.filter(p => 
      !p.message.STEPS && !p.message.ATV && !p.message.REST && !p.message.TEMP_MED
    );
    
    console.log(`Pontos APENAS com bateria: ${apenasBateria.length}`);
    
    // Amostra dos primeiros 5 pontos de bateria
    console.log("Amostra de pontos de bateria:");
    comBateria.slice(0, 5).forEach((p, i) => {
      console.log(`Ponto ${i+1}:`, {
        timestamp: p.timestamp,
        CHAR: p.message.BAT.CHAR,
        VOLT: p.message.BAT.VOLT,
        modo: p.message.MODE || 'N/A',
        apenasBateria: !p.message.STEPS && !p.message.ATV && !p.message.TEMP_MED
      });
    });
  }
  
  return {
    total: comBateria.length,
    apenasBateria: comBateria.filter(p => !p.message.STEPS && !p.message.ATV && !p.message.TEMP_MED).length,
    comTelemetria: comBateria.filter(p => p.message.STEPS || p.message.ATV || p.message.TEMP_MED).length
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

function parseDateTime(dateStr, timeStr, useStartAsFallback = false) {
  try {
    // Se não temos data/hora principal, mas temos START_DATE/START_TIME
    if (!dateStr && !timeStr && useStartAsFallback) {
      console.log("Usando START_DATE/START_TIME como fallback");
      return null; // Vai tentar com START depois
    }
    
    // Formato: "DD/MM/YY"
    const [day, month, year] = dateStr.split('/');
    const fullYear = "20" + year; // Converte "26" para "2026"
    
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
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      throw new Error('Data inválida');
    }
    
    // Retornar como ISO string
    return date.toISOString();
  } catch (error) {
    console.warn('Erro ao parsear DATE/TIME:', dateStr, timeStr, error);
    return null;
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
  if (parsedLine.CCID || parsedLine.DATE || parsedLine.START_DATE) {
    let timestamp = null;
    
    // PRIORIDADE 1: Tentar com DATE e TIME
    if (parsedLine.DATE && parsedLine.TIME) {
      timestamp = parseDateTime(parsedLine.DATE, parsedLine.TIME);
      if (timestamp) {
        console.log(`✅ Usando DATE/TIME: ${parsedLine.DATE} ${parsedLine.TIME}`);
      }
    }
    
    // PRIORIDADE 2: Se não tem DATE/TIME, tentar com START_DATE e START_TIME
    if (!timestamp && parsedLine.START_DATE && parsedLine.START_TIME) {
      timestamp = parseDateTime(parsedLine.START_DATE, parsedLine.START_TIME);
      if (timestamp) {
        console.log(`✅ Usando START_DATE/START_TIME: ${parsedLine.START_DATE} ${parsedLine.START_TIME}`);
      }
    }
    
    // PRIORIDADE 3: Se tiver timestamp no próprio objeto
    if (!timestamp && parsedLine.timestamp) {
      timestamp = parsedLine.timestamp;
      console.log(`✅ Usando timestamp do objeto: ${timestamp}`);
    }
    
    // FALLBACK: Usar timestamp atual com warning
    if (!timestamp) {
      timestamp = new Date().toISOString();
      console.warn('⚠️ Sem timestamp disponível, usando data atual:', parsedLine);
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

function analyzeTimestamps(pontos) {
  console.log("=== ANÁLISE DE TIMESTAMPS ===");
  
  const analise = {
    total: pontos.length,
    comDate: 0,
    comTime: 0,
    comStartDate: 0,
    comStartTime: 0,
    comDateETime: 0,
    comStartDateEStartTime: 0,
    timestamps: []
  };
  
  pontos.forEach((p, index) => {
    const msg = p.message;
    
    if (msg.DATE) analise.comDate++;
    if (msg.TIME) analise.comTime++;
    if (msg.START_DATE) analise.comStartDate++;
    if (msg.START_TIME) analise.comStartTime++;
    if (msg.DATE && msg.TIME) analise.comDateETime++;
    if (msg.START_DATE && msg.START_TIME) analise.comStartDateEStartTime++;
    
    // Guardar amostra dos primeiros 10 timestamps
    if (index < 10) {
      analise.timestamps.push({
        index,
        timestamp: p.timestamp,
        date: msg.DATE || 'N/A',
        time: msg.TIME || 'N/A',
        startDate: msg.START_DATE || 'N/A',
        startTime: msg.START_TIME || 'N/A',
        fonte: msg.DATE ? 'DATE/TIME' : (msg.START_DATE ? 'START_DATE/START_TIME' : 'fallback')
      });
    }
  });
  
  console.log("📊 Estatísticas:", {
    total: analise.total,
    comDateETime: analise.comDateETime,
    comStartDateEStartTime: analise.comStartDateEStartTime,
    apenasStartDate: analise.comStartDate - analise.comStartDateEStartTime,
    apenasStartTime: analise.comStartTime - analise.comStartDateEStartTime
  });
  
  console.log("📋 Amostra dos primeiros timestamps:", analise.timestamps);
  
  return analise;
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