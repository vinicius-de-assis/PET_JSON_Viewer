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
    const batData = pontos.filter(p => p.message.BAT && p.message.BAT.CHAR !== undefined).map(p => ({
      x: new Date(p.timestamp),
      carga: p.message.BAT.CHAR,
      volts: p.message.BAT.VOLT / 1000,
      modo: p.message.MODE || 'DESCONHECIDO',
      timestamp: p.timestamp
    }));
    
    if (batData.length > 0) {
      // Função para obter cor baseada no modo
      function getModoColor(modo) {
        const cores = {
          'PASSEIO': '#2196F3',     // Azul (era verde)
          'NORMAL': '#4CAF50',      // Verde (era azul)
          'RASTREIO': '#FF9800',    // Laranja (mantido)
          'DESCONHECIDO': '#9E9E9E' // Cinza (mantido)
        };
        return cores[modo] || '#9E9E9E';
      }

      // Gráfico de carga com cores por modo
      batCharChart = createChartSafe('batCharChart', {
        type: 'line',
        data: {
          datasets: [{
            label: 'Carga da Bateria',
            data: batData.map(d => ({x: d.x, y: d.carga})),
            borderColor: 'green',
            backgroundColor: 'rgba(0, 255, 0, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: batData.map(d => getModoColor(d.modo)),
            pointBorderColor: batData.map(d => getModoColor(d.modo)),
            pointRadius: 4,
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
                  const modo = batData[index].modo;
                  return `Carga: ${context.parsed.y}% | Modo: ${modo}`;
                },
                afterLabel: function(context) {
                  const index = context.dataIndex;
                  const dataPoint = batData[index];
                  const time = new Date(dataPoint.timestamp).toLocaleString();
                  return `Horário: ${time}`;
                },
                footer: function(tooltipItems) {
                  const index = tooltipItems[0].dataIndex;
                  const modo = batData[index].modo;
                  const cor = getModoColor(modo);
                  return `🔵 Modo: ${modo}`;
                }
              }
            },
            legend: {
              display: true,
              labels: {
                generateLabels: function(chart) {
                  const modos = [...new Set(batData.map(d => d.modo))];
                  return modos.map(modo => ({
                    text: modo,
                    fillStyle: getModoColor(modo),
                    strokeStyle: getModoColor(modo),
                    lineWidth: 2
                  }));
                }
              }
            }
          },
          scales: {
            x: { type: 'time', title: { display: true, text: 'Tempo' } },
            y: { 
              title: { display: true, text: 'Carga (%)' }, 
              min: 0, 
              max: 100 
            }
          }
        }
      }, 'Carga da Bateria');

      // Gráfico de tensão com cores por modo
      batVoltChart = createChartSafe('batVoltChart', {
        type: 'line',
        data: {
          datasets: [{
            label: 'Tensão da Bateria',
            data: batData.map(d => ({x: d.x, y: d.volts})),
            borderColor: 'orange',
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: batData.map(d => getModoColor(d.modo)),
            pointBorderColor: batData.map(d => getModoColor(d.modo)),
            pointRadius: 4,
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
                  const modo = batData[index].modo;
                  return `Tensão: ${context.parsed.y.toFixed(2)}V | Modo: ${modo}`;
                },
                afterLabel: function(context) {
                  const index = context.dataIndex;
                  const dataPoint = batData[index];
                  const time = new Date(dataPoint.timestamp).toLocaleString();
                  return `Horário: ${time}`;
                },
                footer: function(tooltipItems) {
                  const index = tooltipItems[0].dataIndex;
                  const modo = batData[index].modo;
                  const cor = getModoColor(modo);
                  return `🔵 Modo: ${modo}`;
                }
              }
            }
          },
          scales: {
            x: { type: 'time', title: { display: true, text: 'Tempo' } },
            y: { 
              title: { display: true, text: 'Tensão (V)' }, 
              min: 0.0, 
              max: 4.3 
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