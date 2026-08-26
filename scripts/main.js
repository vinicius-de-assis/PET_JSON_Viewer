// main.js - Lógica principal e inicialização

// Variáveis globais (mantidas aqui por serem usadas em vários módulos)
let allData = [], pontosFiltrados = [];
let tempChart, stepChart, batCharChart, batVoltChart, activityChart, inactivityChart, modeChart;
let currentMarkers = null;
let drawnFences = [];
let replayInterval = null;
let replayIndex = 0;
let replayPoints = [];
let replaySpeed = 1400;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  initializeTabs();
  initializeChartTabs();
  
  // Event listeners principais
  document.getElementById('fileInput').addEventListener('change', plotData);
  document.getElementById('plotBtn').addEventListener('click', plotData);
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  document.getElementById('exportCSV').addEventListener('click', exportCSV);
  document.getElementById('exportGPX').addEventListener('click', exportGPX);
  document.getElementById('exportStats').addEventListener('click', exportStats);
  document.getElementById('drawFenceBtn').addEventListener('click', drawFence);
  document.getElementById('clearFencesBtn').addEventListener('click', clearFences);
  document.getElementById('debugBtn').addEventListener('click', toggleDebug);
  
  // Atualizar valor do tamanho dos pontos
  document.getElementById('pointSize').addEventListener('input', function() {
    document.getElementById('pointSizeValue').textContent = this.value;
  });
  
  // Debounce para filtros
  let filterTimeout;
  const filterInputs = ['ccidInput', 'startTime', 'endTime', 'filterType', 'minBattery', 'maxSpeed', 'showConfigs'];
  filterInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(plotData, 500);
    });
  });
});

function plotData() {
  const file = document.getElementById('fileInput').files[0];
  if (!file) return alert("Selecione um arquivo primeiro.");

  document.getElementById('loading').style.display = 'block';

  // AS DUAS LINHAS ABAIXO FALTAVAM NO SEU CÓDIGO
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const lines = e.target.result.trim().split('\n');
      allData = lines.map(line => {
        try { 
          line = line.trim();
          if (!line) return null;

          let jsonStr = line;
          let externalTimestamp = null;

          // Procura o início do JSON na linha (primeiro '{')
          const jsonStartIndex = line.indexOf('{');
          
          // Se houver um prefixo antes do JSON (ex: json-MAC-2026-08-25 10:43:06.123: {...)
          if (jsonStartIndex > 0) {
            const prefix = line.substring(0, jsonStartIndex);
            
            // Extrai a data/hora do prefixo (YYYY-MM-DD HH:MM:SS.ms)
            const timeMatch = prefix.match(/(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
            if (timeMatch) {
              // Converte para formato ISO (ex: 2026-08-25T10:43:06.866)
              // Omitir o 'Z' no final faz o navegador usar o timezone local
              let isoTime = `${timeMatch[1]}T${timeMatch[2]}`;
              if (isoTime.length > 23) {
                isoTime = isoTime.substring(0, 23); // Trunca nanosegundos (mantém milissegundos)
              }
              externalTimestamp = isoTime;
            }
            
            // Isola apenas a parte do JSON para o parser
            jsonStr = line.substring(jsonStartIndex);
          }

          const parsed = JSON.parse(jsonStr);
          
          // Injeta o timestamp externo no objeto para a normalização usar
          if (externalTimestamp) {
            parsed._ext_timestamp = externalTimestamp;
          }
          
          // Normalizar formato dos dados
          const normalized = normalizeDataFormat(parsed);

          if (!normalized) return null;
          
          // Normalizar dados de bateria
          if (normalized.message && normalized.message.BAT) {
            const batNormalized = normalizeBatteryData(
              normalized.message.BAT.CHAR, 
              normalized.message.BAT.VOLT
            );
            normalized.message.BAT.CHAR = batNormalized.char;
            normalized.message.BAT.VOLT = batNormalized.volt;
          }
          
          return normalized;
        }
        catch(e) { 
          console.log('Erro ao parsear linha:', line, e);
          return null; 
        }
      }).filter(Boolean);
      
      // Ordenar por timestamp
      allData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      console.log("📥 Dados carregados:", allData.length);
      if (allData.length > 0) {
        console.log("📋 Primeiro ponto:", allData[0]);
        console.log("📋 Último ponto:", allData[allData.length - 1]);
        
        // Log de exemplos para debug
        const sampleTypes = {};
        allData.slice(0, 5).forEach((item, i) => {
          sampleTypes[`Ponto ${i+1}`] = {
            temTimestampExterno: !!item.timestamp,
            temDateNoMessage: !!item.message.DATE,
            temTimeNoMessage: !!item.message.TIME,
            CCID: item.message.CCID,
            timestamp: item.timestamp
          };
        });
        console.log("🔍 Tipos de dados encontrados:", sampleTypes);
      }
      
      processAndPlot();
    } catch (error) {
      console.error("Erro no carregamento do arquivo:", error);
      document.getElementById('loading').innerHTML = 
        '<div class="anomaly-alert">⚠️ Erro ao carregar arquivo. Verifique o formato.</div>';
    } finally {
      document.getElementById('loading').style.display = 'none';
    }
  };
  
  reader.onerror = function() {
    document.getElementById('loading').innerHTML = 
      '<div class="anomaly-alert">⚠️ Erro na leitura do arquivo.</div>';
    document.getElementById('loading').style.display = 'none';
  };
  
  reader.readAsText(file);
}

// Processamento principal dos dados
function processAndPlot() {
  try {
    console.log("🚀 INICIANDO processAndPlot");
    
    // Análise dos formatos de dados
    const formatAnalysis = analyzeDataFormats(allData);
    console.log("📊 Análise dos formatos de dados:", formatAnalysis);

    // === POPULAR O DROPDOWN DE MACs ===
    const ccidSelect = document.getElementById('ccidInput');
    // Salva o valor atualmente selecionado para não perdê-lo caso o filtro seja re-processado
    const currentSelected = ccidSelect.value;
    
    // Limpa o select
    ccidSelect.innerHTML = '<option value="">Todos os dispositivos</option>';
    
    // Insere os MACs encontrados no log
    if (formatAnalysis.uniqueCCIDs && formatAnalysis.uniqueCCIDs.length > 0) {
      formatAnalysis.uniqueCCIDs.forEach(mac => {
        const option = document.createElement('option');
        option.value = mac;
        option.textContent = mac;
        ccidSelect.appendChild(option);
      });
      // Restaura a seleção se o MAC ainda existir na nova lista
      if (formatAnalysis.uniqueCCIDs.includes(currentSelected)) {
        ccidSelect.value = currentSelected;
      }
    }
    
    // ANÁLISE DE TIMESTAMPS
    const timestampAnalysis = analyzeTimestamps(allData);
    console.log("⏰ Análise de timestamps:", timestampAnalysis);

    // Limpar gráficos anteriores
    [tempChart, stepChart, batCharChart, batVoltChart, activityChart, inactivityChart, modeChart].forEach(chart => {
      if (chart) chart.destroy();
    });

    const filters = getFilters();
    
    try {
      pontosFiltrados = filterData(allData, filters);
      console.log("📊 Dados filtrados:", pontosFiltrados.length);

      // DIAGNÓSTICO DE BATERIA
      const bateriaDiagnostico = diagnoseBatteryData(pontosFiltrados);
      console.log("🔋 Diagnóstico de bateria:", bateriaDiagnostico);

      // Verificar se os pacotes de configuração estão sendo incluídos
      const configPoints = pontosFiltrados.filter(p => hasConfigData(p.message));
      console.log(`🔧 Pontos de configuração: ${configPoints.length}`);

    } catch (filterError) {
      console.warn("Erro no filtro de dados, usando dados brutos:", filterError);
      pontosFiltrados = allData;
    }
    
    debugData(pontosFiltrados);

    let qualityAnalysis = {};
    try {
      qualityAnalysis = analyzeDataQuality(pontosFiltrados);
    } catch (analysisError) {
      console.warn("Erro na análise de qualidade:", analysisError);
      qualityAnalysis = {
        totalPontos: pontosFiltrados.length,
        pontosComGPS: pontosFiltrados.filter(p => p.message.LAT !== 0 && p.message.LON !== 0).length,
        pontosComTelemetria: pontosFiltrados.filter(p => hasTelemetryData(p.message)).length,
        taxaGPS: '0',
        taxaTelemetria: '0',
        duracaoHoras: '0'
      };
    }
    
    displayStatistics(qualityAnalysis);
    
    // ==== AQUI ENTRA O NOVO MOTOR DE VALIDAÇÃO ====
    let validationStats = null;
    try {
       validationStats = runDataValidation(pontosFiltrados);
    } catch(validationError) {
       console.warn("Erro ao rodar motor de validação:", validationError);
    }
    
    try {
      displayDetailedAnalysis(pontosFiltrados, qualityAnalysis);
      // Chama o preenchimento da nova aba de Problemas:
      if (typeof displayValidationIssues === 'function') {
        displayValidationIssues(validationStats, pontosFiltrados);
      }
    } catch (analysisError) {
      console.warn("Erro na análise detalhada:", analysisError);
    }
    
    try {
      plotMap(pontosFiltrados, filters);
    } catch (mapError) {
      console.error("Erro ao plotar mapa:", mapError);
      document.getElementById('map').innerHTML = '<div class="anomaly-alert">⚠️ Erro ao carregar mapa</div>';
    }
    
    try {
      plotCharts(pontosFiltrados);
    } catch (chartError) {
      console.error("Erro ao plotar gráficos:", chartError);
      document.getElementById('chartContainer').innerHTML += '<div class="anomaly-alert">⚠️ Alguns gráficos não puderam ser carregados</div>';
    }

    if (document.getElementById('debugPanel').style.display === 'block') {
      try {
        runDebugAnalysis();
      } catch (debugError) {
        console.warn("Erro no debug:", debugError);
      }
    }
    
  } catch (majorError) {
    console.error("Erro crítico no processamento:", majorError);
    document.getElementById('loading').innerHTML = 
      '<div class="anomaly-alert">⚠️ Erro no processamento</div>';
    
    const basicStats = {
      totalPontos: allData.length,
      pontosComGPS: allData.filter(p => p.message.LAT !== 0 && p.message.LON !== 0).length,
      taxaGPS: '0',
      taxaTelemetria: '0',
      duracaoHoras: '0'
    };
    displayStatistics(basicStats);
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

// Funções de inicialização de abas
function initializeTabs() {
  document.querySelectorAll('.tab-button[data-tab]').forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      
      // Esconder todas as abas
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      
      // Mostrar aba selecionada
      const tabElement = document.getElementById(`${tabName}-tab`);
      if (tabElement) {
        tabElement.classList.add('active');
      }
      
      // Atualizar botões
      document.querySelectorAll('.tab-button[data-tab]').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
    });
  });
}

function initializeChartTabs() {
  document.querySelectorAll('[data-chart]').forEach(button => {
    button.addEventListener('click', function() {
      const chartId = this.getAttribute('data-chart');
      
      // Esconder todos os gráficos
      document.querySelectorAll('.chart-container > canvas, .chart-container > div').forEach(canvas => {
        canvas.style.display = 'none';
      });
      
      // Mostrar gráfico selecionado
      const chartElement = document.getElementById(chartId);
      if (chartElement) {
        chartElement.style.display = chartId === 'batteryChart' ? 'grid' : 'block';
      }
      
      // Atualizar botões
      document.querySelectorAll('[data-chart]').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
    });
  });
}

// Funções de debug
function toggleDebug() {
  const debugPanel = document.getElementById('debugPanel');
  debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
  if (debugPanel.style.display === 'block') {
    runDebugAnalysis();
  }
}

function runDebugAnalysis() {
  const debugContent = document.getElementById('debugContent');
  const ccid = document.getElementById('ccidInput').value.trim() || 'FC:01:2C:DA:EC:CE';
  
  const pontosCCID = allData.filter(p => p.message.CCID === ccid);
  const comTelemetria = pontosCCID.filter(p => hasTelemetryData(p.message));
  const comConfig = pontosCCID.filter(p => hasConfigData(p.message));
  const comGPS = pontosCCID.filter(p => p.message.LAT !== 0 && p.message.LON !== 0);
  
  let debugHTML = `
    <div class="debug-info">
      <strong>CCID Analisado:</strong> ${ccid}<br>
      <strong>Total de pontos:</strong> ${pontosCCID.length}<br>
      <strong>Com telemetria:</strong> ${comTelemetria.length}<br>
      <strong>Com configuração:</strong> ${comConfig.length}<br>
      <strong>Com GPS:</strong> ${comGPS.length}<br>
    </div>
  `;

  if (pontosCCID.length > 0) {
    debugHTML += `<h4>📋 Primeiros 5 pontos do CCID:</h4>`;
    pontosCCID.slice(0, 5).forEach((ponto, i) => {
      debugHTML += `
        <div class="debug-info">
          <strong>Ponto ${i + 1}:</strong> ${ponto.timestamp}<br>
          <strong>Tipo:</strong> ${hasTelemetryData(ponto.message) ? 'Telemetria' : 'Configuração'}<br>
          <strong>Bateria CHAR:</strong> ${ponto.message.BAT?.CHAR}<br>
          <strong>Bateria VOLT:</strong> ${ponto.message.BAT?.VOLT}<br>
          <strong>STEPS:</strong> ${ponto.message.STEPS}<br>
          <strong>ATV:</strong> ${ponto.message.ATV}<br>
          <strong>GPS:</strong> ${ponto.message.LAT !== 0 ? `${ponto.message.LAT}, ${ponto.message.LON}` : 'Sem GPS'}<br>
          <strong>Campos presentes:</strong> ${Object.keys(ponto.message).join(', ')}
        </div>
      `;
    });
  }

  debugContent.innerHTML = debugHTML;
}

// Função auxiliar para debug de dados
function debugData(pontos) {
  console.log("=== DEBUG DOS DADOS ===");
  console.log("Total de pontos:", pontos.length);
  
  const pontosComGPS = pontos.filter(p => p.message.LAT !== 0 && p.message.LON !== 0);
  console.log("Pontos com GPS:", pontosComGPS.length);
  
  if (pontosComGPS.length > 0) {
    console.log("Primeiros 5 pontos com GPS:");
    pontosComGPS.slice(0, 5).forEach((ponto, i) => {
      console.log(`Ponto ${i + 1}:`, {
        LAT: ponto.message.LAT,
        LON: ponto.message.LON,
        CCID: ponto.message.CCID,
        timestamp: ponto.timestamp
      });
    });
  }
  
  // Verificar valores problemáticos
  const problematicPoints = pontos.filter(p => {
    const lat = p.message.LAT;
    const lon = p.message.LON;
    return (lat !== 0 && lon !== 0) && (isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon));
  });
  
  if (problematicPoints.length > 0) {
    console.warn("Pontos com coordenadas problemáticas:", problematicPoints);
  }
}