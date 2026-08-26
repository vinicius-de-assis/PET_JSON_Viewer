// filters.js - Funções de filtragem e análise

function getFilters() {
  const startStr = document.getElementById('startTime').value;
  const endStr = document.getElementById('endTime').value;

  return {
    ccid: document.getElementById('ccidInput').value || '',
    // Se a string existir, cria a Data. Se não, guarda null
    startTime: startStr ? new Date(startStr) : null,
    endTime: endStr ? new Date(endStr) : null,
    unirPontos: document.getElementById('linhaCheckbox').checked,
    replay: document.getElementById('replayCheckbox').checked,
    autoFitBounds: document.getElementById('autoFitBounds').checked,
    showConfigs: document.getElementById('showConfigs').checked,
    pointSize: parseInt(document.getElementById('pointSize').value),
    filterType: document.getElementById('filterType').value,
    minBattery: parseInt(document.getElementById('minBattery').value) || 0,
    maxSpeed: parseInt(document.getElementById('maxSpeed').value) || 200
  };
}

function filterData(data, filters) {
  return data.filter(item => {
    const m = item.message;
    const ts = new Date(item.timestamp);
    
    // Filtro CCID
    if (filters.ccid && m.CCID !== filters.ccid) return false;
    
    // Filtro temporal corrigido (Verifica se não é nulo antes de comparar)
    if (filters.startTime && ts < filters.startTime) return false;
    if (filters.endTime && ts > filters.endTime) return false;
    
    // Filtro bateria - MAIS PERMISSIVO
    if (filters.minBattery > 0) {
      if (m.BAT && m.BAT.CHAR !== undefined) {
        if (m.BAT.CHAR < filters.minBattery) return false;
      }
    }
    
    // Filtro velocidade - só aplica se tiver VEL
    if (filters.maxSpeed < 500 && m.VEL !== undefined && m.VEL > filters.maxSpeed) return false;
    
    // Filtro tipo - MAIS PERMISSIVO PARA BATERIA
    switch (filters.filterType) {
      case 'gps':
        return m.LAT !== 0 && m.LON !== 0;
      case 'movement':
        return m.VEL > 0;
      case 'stationary':
        return m.VEL === 0;
      case 'telemetry':
        return hasTelemetryData(m);
      case 'config':
        return hasConfigData(m);
      case 'battery':
        return m.BAT && (m.BAT.CHAR !== undefined || m.BAT.VOLT !== undefined);
      default:
        return true;
    }
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function analyzeDataQuality(pontos) {
  const total = pontos.length;
  const comGPS = pontos.filter(p => p.message.LAT !== 0 && p.message.LON !== 0).length;
  const comBateria = pontos.filter(p => p.message.BAT).length;
  const comPassos = pontos.filter(p => p.message.STEPS !== undefined).length;
  const comATV = pontos.filter(p => p.message.ATV !== undefined).length;
  const comREST = pontos.filter(p => p.message.REST !== undefined).length;
  const comTelemetria = pontos.filter(p => hasTelemetryData(p.message)).length;
  const comConfig = pontos.filter(p => hasConfigData(p.message)).length;
  
  const pontosGPS = pontos.filter(p => p.message.LAT !== 0 && p.message.LON !== 0);
  const trajetoria = analisarTrajetoria(pontosGPS);
  const temposModo = calcularTempoModos(pontos);
  
  const duracao = total > 0 ? 
    (new Date(pontos[pontos.length-1].timestamp) - new Date(pontos[0].timestamp)) / (1000 * 60 * 60) : 0;
  
  return {
    totalPontos: total,
    pontosComGPS: comGPS,
    pontosComBateria: comBateria,
    pontosComPassos: comPassos,
    pontosComATV: comATV,
    pontosComREST: comREST,
    pontosComTelemetria: comTelemetria,
    pontosComConfig: comConfig,
    taxaGPS: total > 0 ? (comGPS / total * 100).toFixed(1) : 0,
    taxaBateria: total > 0 ? (comBateria / total * 100).toFixed(1) : 0,
    taxaPassos: total > 0 ? (comPassos / total * 100).toFixed(1) : 0,
    taxaATV: total > 0 ? (comATV / total * 100).toFixed(1) : 0,
    taxaTelemetria: total > 0 ? (comTelemetria / total * 100).toFixed(1) : 0,
    duracaoHoras: duracao.toFixed(1),
    trajetoria: trajetoria,
    temposModo: temposModo
  };
}

function analisarTrajetoria(pontosGPS) {
  if (pontosGPS.length < 2) return null;
  
  let distanciaTotal = 0;
  let velocidadeMaxima = 0;
  let tempoMovimento = 0;
  const tempos = [];
  
  for (let i = 1; i < pontosGPS.length; i++) {
    const dist = calcularDistancia(
      pontosGPS[i-1].message.LAT, pontosGPS[i-1].message.LON,
      pontosGPS[i].message.LAT, pontosGPS[i].message.LON
    );
    distanciaTotal += dist;
    
    const tempo = (new Date(pontosGPS[i].timestamp) - new Date(pontosGPS[i-1].timestamp)) / 1000;
    const velocidade = dist / (tempo / 3600);
    
    velocidadeMaxima = Math.max(velocidadeMaxima, velocidade);
    if (velocidade > 1) tempoMovimento += tempo;
    tempos.push(tempo);
  }
  
  return {
    distanciaTotal: distanciaTotal.toFixed(2),
    velocidadeMaxima: velocidadeMaxima.toFixed(1),
    tempoTotal: formatarTempo(tempoMovimento),
    pontosPorHora: (pontosGPS.length / (tempos.reduce((a, b) => a + b, 0) / 3600)).toFixed(1)
  };
}

function calcularTempoModos(pontos) {
  if (pontos.length < 2) return null;

  const pontosComModo = pontos.filter(p => p.message.MODE);
  
  if (pontosComModo.length < 2) return null;

  pontosComModo.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const temposModo = {};
  let modoAtual = pontosComModo[0].message.MODE;
  let inicioModo = new Date(pontosComModo[0].timestamp);

  for (let i = 1; i < pontosComModo.length; i++) {
    const ponto = pontosComModo[i];
    const modo = ponto.message.MODE;
    const timestamp = new Date(ponto.timestamp);

    if (modo !== modoAtual) {
      const duracao = (timestamp - inicioModo) / 1000;
      
      if (!temposModo[modoAtual]) {
        temposModo[modoAtual] = 0;
      }
      temposModo[modoAtual] += duracao;
      
      modoAtual = modo;
      inicioModo = timestamp;
    }
  }

  const ultimoTimestamp = new Date(pontosComModo[pontosComModo.length - 1].timestamp);
  const duracaoFinal = (ultimoTimestamp - inicioModo) / 1000;
  
  if (!temposModo[modoAtual]) {
    temposModo[modoAtual] = 0;
  }
  temposModo[modoAtual] += duracaoFinal;

  const temposFormatados = {};
  for (const [modo, segundos] of Object.entries(temposModo)) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = Math.floor(segundos % 60);
    
    temposFormatados[modo] = {
      segundos: Math.round(segundos),
      formatado: `${horas}h ${minutos}m ${segs}s`,
      porcentagem: ((segundos / (ultimoTimestamp - new Date(pontosComModo[0].timestamp)) * 1000) * 100).toFixed(1)
    };
  }

  return temposFormatados;
}

function displayStatistics(analysis) {
  const statsContent = document.getElementById('statsContent');
  
  let statsHTML = `
    <div class="dashboard">
      <div class="metric">
        <span class="value">${analysis.totalPontos}</span>
        <span class="label">Total de Pontos</span>
      </div>
      <div class="metric">
        <span class="value">${analysis.taxaTelemetria}%</span>
        <span class="label">Com Telemetria</span>
        <div class="progress-bar"><div class="progress-fill" style="width: ${analysis.taxaTelemetria}%"></div></div>
      </div>
      <div class="metric">
        <span class="value">${analysis.taxaGPS}%</span>
        <span class="label">Com GPS</span>
        <div class="progress-bar"><div class="progress-fill" style="width: ${analysis.taxaGPS}%"></div></div>
      </div>
      <div class="metric">
        <span class="value">${analysis.duracaoHoras}h</span>
        <span class="label">Duração</span>
      </div>
    </div>
    
    <div style="margin-top: 20px;">
      <h4>📈 Detalhamento dos Dados</h4>
      <div class="dashboard">
        <div class="metric">
          <span class="value">${analysis.pontosComTelemetria}</span>
          <span class="label">Telemetria</span>
        </div>
        <div class="metric">
          <span class="value">${analysis.pontosComConfig}</span>
          <span class="label">Configuração</span>
        </div>
        <div class="metric">
          <span class="value">${analysis.pontosComATV}</span>
          <span class="label">Com ATV</span>
        </div>
        <div class="metric">
          <span class="value">${analysis.pontosComREST}</span>
          <span class="label">Com REST</span>
        </div>
      </div>
    </div>
  `;
  
  if (analysis.temposModo) {
    statsHTML += `
      <div style="margin-top: 20px;">
        <h4>⏱️ Tempo em Cada Modo</h4>
        <div class="dashboard">
    `;
    
    Object.entries(analysis.temposModo).forEach(([modo, tempo]) => {
      const cor = getCorModo(modo);
      statsHTML += `
        <div class="metric">
          <span class="value">${tempo.formatado}</span>
          <span class="label" style="color: ${cor}">${modo}</span>
          <div class="progress-bar"><div class="progress-fill" style="width: ${tempo.porcentagem}%; background: ${cor}"></div></div>
          <small>${tempo.porcentagem}% do tempo total</small>
        </div>
      `;
    });
    
    statsHTML += `</div></div>`;
  }
  
  if (analysis.trajetoria) {
    statsHTML += `
      <div style="margin-top: 20px;">
        <h4>🗺️ Análise da Trajetória</h4>
        <div class="dashboard">
          <div class="metric">
            <span class="value">${analysis.trajetoria.distanciaTotal}</span>
            <span class="label">Distância (km)</span>
          </div>
          <div class="metric">
            <span class="value">${analysis.trajetoria.velocidadeMaxima}</span>
            <span class="label">Vel. Máx (km/h)</span>
          </div>
          <div class="metric">
            <span class="value">${analysis.trajetoria.tempoTotal}</span>
            <span class="label">Tempo Total</span>
          </div>
        </div>
      </div>
    `;
  }
  statsContent.innerHTML = statsHTML;
}

function displayDetailedAnalysis(pontos, analysis) {
  const detailedAnalysis = document.getElementById('detailedAnalysis');
  
  let content = `
    <h4>📋 Resumo Detalhado</h4>
    <table class="data-table">
      <tr>
        <th>Métrica</th>
        <th>Valor</th>
        <th>Percentual</th>
      </tr>
      <tr>
        <td>Total de Pontos</td>
        <td>${analysis.totalPontos}</td>
        <td>100%</td>
      </tr>
      <tr>
        <td>Pontos com GPS</td>
        <td>${analysis.pontosComGPS}</td>
        <td>${analysis.taxaGPS}%</td>
      </tr>
      <tr>
        <td>Pontos com Bateria</td>
        <td>${analysis.pontosComBateria}</td>
        <td>${analysis.taxaBateria}%</td>
      </tr>
      <tr>
        <td>Pontos com ATV</td>
        <td>${analysis.pontosComATV}</td>
        <td>${analysis.taxaATV}%</td>
      </tr>
    </table>
  `;
  
  if (analysis.temposModo) {
    content += `
      <h4>⏱️ Distribuição de Tempo por Modo</h4>
      <table class="data-table">
        <tr>
          <th>Modo</th>
          <th>Tempo</th>
          <th>Porcentagem</th>
        </tr>
        ${Object.entries(analysis.temposModo).map(([modo, tempo]) => `
          <tr>
            <td><strong style="color: ${getCorModo(modo)}">${modo}</strong></td>
            <td>${tempo.formatado}</td>
            <td>${tempo.porcentagem}%</td>
          </tr>
        `).join('')}
      </table>
    `;
  }
  
  if (analysis.trajetoria) {
    content += `
      <h4>🗺️ Análise da Trajetória</h4>
      <table class="data-table">
        <tr>
          <th>Métrica</th>
          <th>Valor</th>
        </tr>
        <tr>
          <td>Distância Total</td>
          <td>${analysis.trajetoria.distanciaTotal} km</td>
        </tr>
        <tr>
          <td>Velocidade Máxima</td>
          <td>${analysis.trajetoria.velocidadeMaxima} km/h</td>
        </tr>
        <tr>
          <td>Tempo Total em Movimento</td>
          <td>${analysis.trajetoria.tempoTotal}</td>
        </tr>
        <tr>
          <td>Pontos por Hora</td>
          <td>${analysis.trajetoria.pontosPorHora}</td>
        </tr>
      </table>
    `;
  }
  
  detailedAnalysis.innerHTML = content;
}

// NOVA FUNÇÃO: Exibe a tabela de problemas na aba dedicada
function displayValidationIssues(validationStats, pontos) {
  const validationContent = document.getElementById('validationContent');
  if (!validationContent) return;

  if (!validationStats || validationStats.totalErrors === 0) {
    validationContent.innerHTML = `
      <div class="metric" style="border-left-color: #28a745;">
        <span class="value" style="color: #28a745;">✓</span>
        <span class="label">Nenhum problema de consistência detectado no LOG.</span>
      </div>
    `;
    return;
  }

  // Monta sumário das regras
  let html = `
    <div class="anomaly-alert">
      <strong>${validationStats.totalErrors}</strong> anomalias encontradas neste conjunto de dados.
    </div>
    
    <h4>Resumo de Regras Violadas</h4>
    <table class="data-table">
      <tr>
        <th>Regra</th>
        <th>Total de Ocorrências</th>
      </tr>
      ${Object.entries(validationStats.ruleErrors).map(([rule, count]) => `
        <tr>
          <td>${rule}</td>
          <td><strong style="color: #dc3545;">${count}</strong></td>
        </tr>
      `).join('')}
    </table>

    <h4 style="margin-top: 20px;">Listagem de Eventos e Falhas (Timeline)</h4>
    <table class="data-table" style="font-size: 13px;">
      <tr>
        <th>Data/Hora</th>
        <th>Problema(s) Detectado(s)</th>
      </tr>
  `;

  // Filtra apenas pontos que falharam e exibe na tabela (limite de segurança de 200 itens para não travar navegador)
  const invalidPoints = pontos.filter(p => !p.isValid);
  const displayPoints = invalidPoints.slice(0, 200);
  
  displayPoints.forEach(p => {
    const timeStr = new Date(p.timestamp).toLocaleString();
    const errorsStr = p.validations.map(v => `• ${v.error}`).join('<br>');
    html += `
      <tr>
        <td style="white-space: nowrap;">${timeStr}</td>
        <td style="color: #dc3545;">${errorsStr}</td>
      </tr>
    `;
  });

  if (invalidPoints.length > 200) {
     html += `<tr><td colspan="2" style="text-align: center; color: #666;">... e mais ${invalidPoints.length - 200} registros com problema omitidos ...</td></tr>`;
  }

  html += `</table>`;
  validationContent.innerHTML = html;
}


// ==========================================
// SISTEMA EXTENSÍVEL DE VALIDAÇÃO DE DADOS
// ==========================================
const validationRules = [
  {
    id: 'check_accumulators',
    name: 'Acumuladores (STEPS, ATV, REST) não podem retroceder',
    validate: (current, prev) => {
      if (!prev) return { valid: true };
      
      const m = current.message;
      const p = prev.message;
      
      // Se START_DATE ou START_TIME mudaram, o reset dos acumuladores é permitido
      if ((m.START_DATE !== p.START_DATE) || (m.START_TIME !== p.START_TIME)) {
         return { valid: true };
      }
      
      const errors = [];
      if (m.STEPS !== undefined && p.STEPS !== undefined && m.STEPS < p.STEPS) {
        errors.push(`STEPS retrocedeu (${p.STEPS} → ${m.STEPS})`);
      }
      if (m.ATV !== undefined && p.ATV !== undefined && m.ATV < p.ATV) {
        errors.push(`ATV retrocedeu (${p.ATV} → ${m.ATV})`);
      }
      if (m.REST !== undefined && p.REST !== undefined && m.REST < p.REST) {
        errors.push(`REST retrocedeu (${p.REST} → ${m.REST})`);
      }
      
      if (errors.length > 0) return { valid: false, error: errors.join(' | ') };
      return { valid: true };
    }
  },
  {
    id: 'check_time_consistency',
    name: 'Soma ATV+REST deve corresponder à diferença de relógio',
    validate: (current) => {
      const m = current.message;
      // Pula a regra se não tivermos todos os campos necessários
      if (m.ATV === undefined || m.REST === undefined || !m.DATE || !m.TIME || !m.START_DATE || !m.START_TIME) {
        return { valid: true };
      }

      const currentDt = parseDateTime(m.DATE, m.TIME);
      const startDt = parseDateTime(m.START_DATE, m.START_TIME);

      if (currentDt && startDt) {
        // Diferença em segundos entre a hora atual e a hora de start
        const elapsedSeconds = Math.round((new Date(currentDt) - new Date(startDt)) / 1000);
        const sumCounters = m.ATV + m.REST;
        
        // Aplica uma margem de tolerância de 2 minutos (120 segundos)
        if (Math.abs(elapsedSeconds - sumCounters) > 120) {
          return { valid: false, error: `ATV+REST (${sumCounters}s) difere do tempo decorrido (${elapsedSeconds}s) além da tolerância de 2min` };
        }
      }
      return { valid: true };
    }
  },
  {
    id: 'check_wifi_route',
    name: 'WIFI restrito a ROUTE = 1',
    validate: (current) => {
      const m = current.message;
      if (m.WIFI !== undefined && m.ROUTE !== 1) {
        return { valid: false, error: `WIFI exibido indevidamente para ROUTE = ${m.ROUTE}` };
      }
      return { valid: true };
    },
    fix: (current) => {
      // Força a remoção do campo para que não polua o popup nem os exports
      if (current.message.WIFI !== undefined && current.message.ROUTE !== 1) {
        delete current.message.WIFI;
      }
    }
  }
  // Futuramente, basta adicionar novos objetos de regras aqui!
];

function runDataValidation(pontos) {
  const validationStats = { totalErrors: 0, ruleErrors: {} };

  pontos.forEach((ponto, index) => {
    ponto.validations = [];
    ponto.isValid = true;
    
    const prevPonto = index > 0 ? pontos[index - 1] : null;

    validationRules.forEach(rule => {
      // 1. Checa a regra
      const result = rule.validate(ponto, prevPonto);
      if (!result.valid) {
        ponto.isValid = false;
        ponto.validations.push({ ruleName: rule.name, error: result.error });
        
        validationStats.totalErrors++;
        validationStats.ruleErrors[rule.name] = (validationStats.ruleErrors[rule.name] || 0) + 1;
      }
      
      // 2. Aplica a correção automática (se a regra possuir uma)
      if (rule.fix) {
        rule.fix(ponto);
      }
    });
  });

  return validationStats;
}

// Substitua sua função displayDetailedAnalysis INTEIRA por esta:
function displayDetailedAnalysis(pontos, analysis, validationStats = null) {
  const detailedAnalysis = document.getElementById('detailedAnalysis');
  
  let content = `
    <h4>📋 Resumo Detalhado</h4>
    <table class="data-table">
      <tr>
        <th>Métrica</th>
        <th>Valor</th>
        <th>Percentual</th>
      </tr>
      <tr>
        <td>Total de Pontos</td>
        <td>${analysis.totalPontos}</td>
        <td>100%</td>
      </tr>
      <tr>
        <td>Pontos com GPS</td>
        <td>${analysis.pontosComGPS}</td>
        <td>${analysis.taxaGPS}%</td>
      </tr>
      <tr>
        <td>Pontos com Bateria</td>
        <td>${analysis.pontosComBateria}</td>
        <td>${analysis.taxaBateria}%</td>
      </tr>
    </table>
  `;

  // Adiciona a tabela de violações de dados se houver erros
  if (validationStats && validationStats.totalErrors > 0) {
    content += `
      <h4 style="color: #dc3545; margin-top: 20px;">⚠️ Análise de Consistência e Falhas</h4>
      <table class="data-table">
        <tr>
          <th>Regra Violada</th>
          <th>Total de Ocorrências</th>
        </tr>
        ${Object.entries(validationStats.ruleErrors).map(([rule, count]) => `
          <tr>
            <td>${rule}</td>
            <td><strong style="color: #dc3545;">${count}</strong> pontos</td>
          </tr>
        `).join('')}
      </table>
    `;
  }
  
  if (analysis.temposModo) {
    content += `
      <h4>⏱️ Distribuição de Tempo por Modo</h4>
      <table class="data-table">
        <tr>
          <th>Modo</th>
          <th>Tempo</th>
          <th>Porcentagem</th>
        </tr>
        ${Object.entries(analysis.temposModo).map(([modo, tempo]) => `
          <tr>
            <td><strong style="color: ${getCorModo(modo)}">${modo}</strong></td>
            <td>${tempo.formatado}</td>
            <td>${tempo.porcentagem}%</td>
          </tr>
        `).join('')}
      </table>
    `;
  }
  
  detailedAnalysis.innerHTML = content;
}