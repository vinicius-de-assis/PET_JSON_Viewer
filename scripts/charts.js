// charts.js - Funções para criação de gráficos

function plotCharts(pontos) {
  // Função auxiliar segura para criar gráficos
  function createChartSafe(canvasId, config, chartName) {
    try {
      const ctx = document.getElementById(canvasId).getContext('2d');
      return new Chart(ctx, config);
    } catch (error) {
      console.error(`Erro ao criar gráfico ${chartName}:`, error);
      document.getElementById(canvasId).innerHTML = 
        `<div class="anomaly-alert">⚠️ Gráfico ${chartName} não disponível</div>`;
      return null;
    }
  }

  // Gráfico de temperatura - COM TEMPERATURAS MÉDIA, MÁXIMA E MÍNIMA
  try {
    const tempData = pontos.filter(p => p.message.TEMP_MED !== undefined).map(p => ({
      x: new Date(p.timestamp),
      tempMed: p.message.TEMP_MED,
      tempMax: p.message.TEMP_MAX !== undefined ? p.message.TEMP_MAX : p.message.TEMP_MED,
      tempMin: p.message.TEMP_MIN !== undefined ? p.message.TEMP_MIN : p.message.TEMP_MED
    }));
    
    if (tempData.length > 0) {
      tempChart = createChartSafe('tempChart', {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Temperatura Média',
              data: tempData.map(d => ({x: d.x, y: d.tempMed})),
              borderColor: 'red',
              backgroundColor: 'rgba(255, 0, 0, 0.1)',
              fill: false,
              tension: 0.4,
              pointRadius: 3,
              pointHoverRadius: 6,
              borderWidth: 2
            },
            {
              label: 'Temperatura Máxima',
              data: tempData.map(d => ({x: d.x, y: d.tempMax})),
              borderColor: 'orange',
              backgroundColor: 'rgba(255, 165, 0, 0.1)',
              fill: false,
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 5,
              borderWidth: 1,
              borderDash: [5, 5]
            },
            {
              label: 'Temperatura Mínima',
              data: tempData.map(d => ({x: d.x, y: d.tempMin})),
              borderColor: 'blue',
              backgroundColor: 'rgba(0, 0, 255, 0.1)',
              fill: false,
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 5,
              borderWidth: 1,
              borderDash: [5, 5]
            }
          ]
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            title: {
              display: true,
              text: 'Temperaturas - Média, Máxima e Mínima'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  label += context.parsed.y.toFixed(2) + '°C';
                  return label;
                }
              }
            }
          },
          scales: {
            x: { 
              type: 'time', 
              title: { display: true, text: 'Tempo' },
              time: {
                unit: 'hour',
                displayFormats: {
                  hour: 'HH:mm'
                }
              }
            },
            y: { 
              title: { display: true, text: 'Temperatura (°C)' },
              suggestedMin: Math.min(...tempData.map(d => Math.min(d.tempMin, d.tempMed))) - 2,
              suggestedMax: Math.max(...tempData.map(d => Math.max(d.tempMax, d.tempMed))) + 2
            }
          }
        }
      }, 'Temperatura');
      
      console.log(`🌡️ Gráfico de temperatura criado com ${tempData.length} pontos`);
      console.log(`📊 Faixa de temperaturas: Min ${Math.min(...tempData.map(d => d.tempMin)).toFixed(1)}°C - Max ${Math.max(...tempData.map(d => d.tempMax)).toFixed(1)}°C`);
    }
  } catch (error) {
    console.warn("Erro no gráfico de temperatura:", error);
  }

  // Gráfico de passos - COM TRY/CATCH INTERNO
  try {
    const steps = pontos.filter(p => p.message.STEPS !== undefined).map(p => ({
      x: new Date(p.timestamp),
      y: p.message.STEPS
    }));
    
    if (steps.length > 0) {
      stepChart = createChartSafe('stepChart', {
        type: 'line',
        data: {
          datasets: [{
            label: 'Passos',
            data: steps,
            borderColor: 'purple',
            backgroundColor: 'rgba(128, 0, 128, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: { type: 'time', title: { display: true, text: 'Tempo' } },
            y: { 
              title: { display: true, text: 'Passos' }, 
              beginAtZero: true 
            }
          }
        }
      }, 'Passos');
    }
  } catch (error) {
    console.warn("Erro no gráfico de passos:", error);
  }

  // Gráficos de bateria - COM CORES POR MODO
  try {
    // Filtrar pontos que têm dados de bateria (mesmo sem outros campos)
    const batData = pontos.filter(p => 
      p.message.BAT && 
      (p.message.BAT.CHAR !== undefined || p.message.BAT.VOLT !== undefined)
    ).map(p => ({
      x: new Date(p.timestamp),
      carga: p.message.BAT.CHAR,
      volts: p.message.BAT.VOLT / 1000, // Converter mV para V
      modo: p.message.MODE || 'DESCONHECIDO',
      timestamp: p.timestamp,
      // Indicar se é pacote apenas de bateria
      isBatteryOnly: !p.message.STEPS && !p.message.ATV && !p.message.TEMP_MED
    }));
    
    console.log(`🔋 Dados de bateria encontrados: ${batData.length} pontos`);
    console.log(`📊 Pontos apenas de bateria: ${batData.filter(d => d.isBatteryOnly).length}`);
    
    if (batData.length > 0) {
      // Função para obter cor baseada no modo
      function getModoColor(modo) {
        const cores = {
          'PASSEIO': '#2196F3',     // Azul
          'NORMAL': '#4CAF50',      // Verde
          'RASTREIO': '#FF9800',    // Laranja
          'DESCONHECIDO': '#9E9E9E' // Cinza
        };
        return cores[modo] || '#9E9E9E';
      }

      // Gráfico de carga
      batCharChart = createChartSafe('batCharChart', {
        type: 'line',
        data: {
          datasets: [{
            label: 'Carga da Bateria (%)',
            data: batData.map(d => ({x: d.x, y: d.carga})),
            borderColor: 'green',
            backgroundColor: 'rgba(0, 255, 0, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: batData.map(d => d.isBatteryOnly ? '#FFA500' : getModoColor(d.modo)),
            pointBorderColor: batData.map(d => d.isBatteryOnly ? '#FFA500' : getModoColor(d.modo)),
            pointRadius: batData.map(d => d.isBatteryOnly ? 6 : 4), // Pontos maiores para pacotes só bateria
            pointHoverRadius: 8,
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const index = context.dataIndex;
                  const dataPoint = batData[index];
                  const tipo = dataPoint.isBatteryOnly ? '📱 Apenas Bateria' : `📊 Modo: ${dataPoint.modo}`;
                  return [
                    `Carga: ${context.parsed.y.toFixed(1)}%`,
                    tipo
                  ];
                },
                afterLabel: function(context) {
                  const index = context.dataIndex;
                  const dataPoint = batData[index];
                  const time = new Date(dataPoint.timestamp).toLocaleString();
                  return `🕐 ${time}`;
                }
              }
            },
            title: {
              display: true,
              text: 'Carga da Bateria ao Longo do Tempo'
            }
          },
          scales: {
            x: { 
              type: 'time', 
              title: { display: true, text: 'Tempo' },
              time: {
                unit: 'hour',
                displayFormats: {
                  hour: 'HH:mm'
                }
              }
            },
            y: { 
              title: { display: true, text: 'Carga (%)' }, 
              min: 0, 
              max: 100,
              grid: {
                color: 'rgba(0,0,0,0.1)'
              }
            }
          }
        }
      }, 'Carga da Bateria');

      // Gráfico de tensão
      batVoltChart = createChartSafe('batVoltChart', {
        type: 'line',
        data: {
          datasets: [{
            label: 'Tensão da Bateria (V)',
            data: batData.map(d => ({x: d.x, y: d.volts})),
            borderColor: 'orange',
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: batData.map(d => d.isBatteryOnly ? '#FFA500' : getModoColor(d.modo)),
            pointBorderColor: batData.map(d => d.isBatteryOnly ? '#FFA500' : getModoColor(d.modo)),
            pointRadius: batData.map(d => d.isBatteryOnly ? 6 : 4),
            pointHoverRadius: 8,
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const index = context.dataIndex;
                  const dataPoint = batData[index];
                  const tipo = dataPoint.isBatteryOnly ? '📱 Apenas Bateria' : `📊 Modo: ${dataPoint.modo}`;
                  return [
                    `Tensão: ${context.parsed.y.toFixed(3)}V`,
                    tipo
                  ];
                },
                afterLabel: function(context) {
                  const index = context.dataIndex;
                  const dataPoint = batData[index];
                  const time = new Date(dataPoint.timestamp).toLocaleString();
                  return `🕐 ${time}`;
                }
              }
            },
            title: {
              display: true,
              text: 'Tensão da Bateria ao Longo do Tempo'
            }
          },
          scales: {
            x: { 
              type: 'time', 
              title: { display: true, text: 'Tempo' },
              time: {
                unit: 'hour',
                displayFormats: {
                  hour: 'HH:mm'
                }
              }
            },
            y: { 
              title: { display: true, text: 'Tensão (V)' }, 
              min: 3.0, 
              max: 4.3,
              grid: {
                color: 'rgba(0,0,0,0.1)'
              }
            }
          }
        }
      }, 'Tensão da Bateria');
    }
  } catch (error) {
    console.warn("Erro nos gráficos de bateria:", error);
  }

  // Gráfico de atividade - COM TRY/CATCH INTERNO
  try {
    const atvData = pontos.filter(p => p.message.ATV !== undefined).map(p => ({
      x: new Date(p.timestamp),
      y: p.message.ATV
    }));
    
    if (atvData.length > 0) {
      activityChart = createChartSafe('activityChart', {
        type: 'line',
        data: {
          datasets: [{
            label: 'Atividade (ATV)',
            data: atvData,
            borderColor: 'blue',
            backgroundColor: 'rgba(0, 0, 255, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: { 
              type: 'time', 
              title: { display: true, text: 'Tempo' } 
            },
            y: { 
              title: { display: true, text: 'Nível de Atividade (ATV)' },
              beginAtZero: true
            }
          }
        }
      }, 'Atividade');
    }
  } catch (error) {
    console.warn("Erro no gráfico de atividade:", error);
  }

  // Gráfico de inatividade - COM TRY/CATCH INTERNO
  try {
    const restData = pontos.filter(p => p.message.REST !== undefined).map(p => ({
      x: new Date(p.timestamp),
      y: p.message.REST
    }));
    
    if (restData.length > 0) {
      inactivityChart = createChartSafe('inactivityChart', {
        type: 'line',
        data: {
          datasets: [{
            label: 'Tempo de Repouso (REST)',
            data: restData,
            borderColor: 'red',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: { type: 'time', title: { display: true, text: 'Tempo' } },
            y: { 
              title: { display: true, text: 'Tempo de Repouso (REST)' },
              beginAtZero: true
            }
          }
        }
      }, 'Inatividade');
    }
  } catch (error) {
    console.warn("Erro no gráfico de inatividade:", error);
  }

  // Gráfico de Modos - COM TRY/CATCH INTERNO
  try {
    const temposModo = calcularTempoModos(pontos);
    
    if (temposModo && Object.keys(temposModo).length > 0) {
      modeChart = createChartSafe('modeChart', {
        type: 'pie',
        data: {
          labels: Object.keys(temposModo),
          datasets: [{
            data: Object.values(temposModo).map(t => t.segundos),
            backgroundColor: Object.keys(temposModo).map(modo => getCorModo(modo)),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
            },
            title: {
              display: true,
              text: 'Distribuição de Tempo por Modo de Operação'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
                  const tempoFormatado = formatarTempo(value);
                  return `${label}: ${tempoFormatado} (${percentage}%)`;
                }
              }
            }
          }
        }
      }, 'Modos de Operação');
    }
  } catch (error) {
    console.warn("Erro no gráfico de modos:", error);
  }
}