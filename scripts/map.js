// map.js - Funções relacionadas ao mapa Leaflet

function plotMap(pontos, filters) {
  try {
    console.log("🔍 Iniciando plotMap...");
    console.log("Total de pontos recebidos:", pontos.length);
    
    const pontosComPosicao = pontos.filter(p => {
      const lat = p.message.LAT;
      const lon = p.message.LON;
      const hasValidGPS = lat !== 0 && lon !== 0 && !isNaN(lat) && !isNaN(lon);
      return hasValidGPS;
    });

    console.log("Pontos com posição válida:", pontosComPosicao.length);

    const showMap = pontosComPosicao.length > 0;
    document.getElementById('map').style.display = showMap ? 'block' : 'none';

    if (!showMap) {
      console.log("❌ Nenhum ponto com GPS válido encontrado");
      document.getElementById('map').innerHTML = 
        '<div class="anomaly-alert">⚠️ Nenhum ponto com coordenadas GPS válidas encontrado</div>';
      return;
    }

    // Parar replay anterior se estiver ativo
    stopReplay();

    // Preparar dados para replay
    replayPoints = pontosComPosicao;
    replayIndex = 0;

    // Limpar mapa existente de forma segura
    try {
      if (window.mapInstance) {
        window.mapInstance.remove();
        window.mapInstance = null;
      }
      if (currentMarkers) {
        currentMarkers.clearLayers();
        currentMarkers = null;
      }
    } catch (cleanupError) {
      console.warn("Erro ao limpar mapa anterior:", cleanupError);
    }

    // Criar novo mapa com tratamento de erro
    let map;
    try {
      // Usar as coordenadas do primeiro ponto como centro do mapa
      const firstPoint = pontosComPosicao[0];
      const centerLat = firstPoint.message.LAT;
      const centerLon = firstPoint.message.LON;
      
      map = L.map('map').setView([centerLat, centerLon], 13);
      window.mapInstance = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      console.log("🗺️ Mapa criado com sucesso");

      addMapLegend(map);

    } catch (mapError) {
      console.error("❌ Erro crítico ao criar mapa:", mapError);
      document.getElementById('map').innerHTML = 
        '<div class="anomaly-alert">⚠️ Erro crítico ao inicializar o mapa: ' + mapError.message + '</div>';
      return;
    }

    // Clusterização (apenas para visualização estática)
    try {
      currentMarkers = L.markerClusterGroup();
      map.addLayer(currentMarkers);
      console.log("📍 Clusterização configurada");
    } catch (clusterError) {
      console.warn("Erro na clusterização, usando marcadores simples:", clusterError);
      currentMarkers = L.layerGroup();
      map.addLayer(currentMarkers);
    }

    // Adicionar pontos com tratamento individual de erro (apenas para visualização estática)
    let markersAdded = 0;
    if (!filters.replay) {
      pontosComPosicao.forEach((ponto, index) => {
        try {
          const m = ponto.message;
          const latlng = [m.LAT, m.LON];
          const cor = (m.GPS_WARN && m.GPS_WARN !== 'false' && m.GPS_WARN !== '0') ? 'red' : 'green';
          
          const marker = L.circleMarker(latlng, {
            radius: filters.pointSize,
            color: cor,
            fillColor: cor,
            fillOpacity: 0.7,
            weight: 2
          }).bindPopup(createPopupContent(ponto));
          
          currentMarkers.addLayer(marker);
          markersAdded++;
        } catch (markerError) {
          console.warn(`Erro ao adicionar marcador ${index}:`, markerError);
        }
      });
      console.log(`✅ ${markersAdded} marcadores estáticos adicionados`);
    }

    // Linha de trajetória
    if (filters.unirPontos && pontosComPosicao.length > 1) {
      try {
        const coordinates = pontosComPosicao.map(p => [p.message.LAT, p.message.LON]);
        L.polyline(coordinates, { 
          color: 'blue', 
          weight: 3,
          opacity: 0.7
        }).addTo(map);
        console.log("🔄 Linha de trajetória desenhada");
      } catch (polylineError) {
        console.warn("Erro ao desenhar linha de trajetória:", polylineError);
      }
    }

    // Ajustar vista do mapa
    if (filters.autoFitBounds && pontosComPosicao.length > 0) {
      try {
        const group = new L.featureGroup(
          pontosComPosicao.map(p => L.marker([p.message.LAT, p.message.LON]))
        );
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.1));
          console.log("🎯 Mapa ajustado aos bounds");
        }
      } catch (boundsError) {
        console.warn("Erro ao ajustar bounds do mapa:", boundsError);
      }
    }

    // Iniciar replay se solicitado
    if (filters.replay && replayPoints.length > 0) {
      startReplay(map, filters);
    }

    // Adicionar cercas virtuais
    try {
      plotVirtualFences(pontos);
      console.log("🛡️ Cercas virtuais processadas");
    } catch (fenceError) {
      console.warn("Erro ao plotar cercas virtuais:", fenceError);
    }

    console.log("✅ plotMap executado com sucesso!");

  } catch (majorError) {
    console.error("❌ ERRO CRÍTICO em plotMap:", majorError);
    document.getElementById('map').innerHTML = 
      '<div class="anomaly-alert">⚠️ Erro crítico ao carregar mapa: ' + majorError.message + 
      '<br>Pontos com GPS: ' + pontos.filter(p => p.message.LAT !== 0 && p.message.LON !== 0).length +
      '</div>';
  }
}

function createPopupContent(ponto) {
  const m = ponto.message;
  return `
    <div style="min-width: 250px;">
      <strong>CCID:</strong> ${m.CCID}<br>
      <strong>Data/Hora:</strong> ${new Date(ponto.timestamp).toLocaleString()}<br>
      <strong>Posição:</strong> ${m.LAT.toFixed(6)}, ${m.LON.toFixed(6)}<br>
      <strong>Bateria:</strong> ${m.BAT?.CHAR || 'N/A'}%<br>
      <strong>Temperatura Média:</strong> ${m.TEMP_MED || 'N/A'}°C<br>
      ${m.TEMP_MAX ? `<strong>Temperatura Máxima:</strong> ${m.TEMP_MAX}°C<br>` : ''}
      ${m.TEMP_MIN ? `<strong>Temperatura Mínima:</strong> ${m.TEMP_MIN}°C<br>` : ''}
      <strong>Passos:</strong> ${m.STEPS || 0}<br>
      <strong>Atividade (ATV):</strong> ${m.ATV || 0}<br>
      <strong>Velocidade:</strong> ${m.VEL || 0} km/h
    </div>
  `;
}

function addMapLegend(map) {
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'map-legend');
    div.style.backgroundColor = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '5px';
    div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    div.style.fontSize = '12px';
    div.style.fontFamily = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
    
    div.innerHTML = `
      <h4 style="margin: 0 0 8px 0; font-size: 14px;">🎯 Legenda</h4>
      <div style="display: flex; align-items: center; margin-bottom: 5px;">
        <div style="width: 12px; height: 12px; background: green; border-radius: 50%; margin-right: 8px; border: 1px solid #fff;"></div>
        <span>Modo de passeio / Normal</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 5px;">
        <div style="width: 12px; height: 12px; background: red; border-radius: 50%; margin-right: 8px; border: 1px solid #fff;"></div>
        <span>Modo de Rastreio</span>
      </div>
    `;
    
    return div;
  };

  legend.addTo(map);
  window.mapLegend = legend;
}

function plotVirtualFences(pontos) {
  let fencesAdded = 0;
  
  pontos.forEach((item, index) => {
    try {
      const cerca = item.message?.CERCA;
      if (cerca?.STATUS === "ON" && cerca?.POLIG) {
        const polig = cerca.POLIG;
        const coords = [];
        let i = 1;
        
        // Coletar coordenadas da cerca
        while (polig[`${i}_LAT`] !== undefined && polig[`${i}_LON`] !== undefined) {
          const lat = polig[`${i}_LAT`];
          const lon = polig[`${i}_LON`];
          
          // Verificar se as coordenadas são válidas
          if (lat !== 0 && lon !== 0 && !isNaN(lat) && !isNaN(lon)) {
            coords.push([lat, lon]);
          }
          i++;
        }
        
        // Só criar o polígono se tiver pelo menos 3 pontos válidos
        if (coords.length >= 3) {
          const polygon = L.polygon(coords, {
            color: 'green',  // Verde para cercas virtuais
            fillColor: 'green',
            fillOpacity: 0.1,
            weight: 2
          }).addTo(window.mapInstance).bindPopup("🛡️ Cerca Virtual Ativa");
          
          drawnFences.push(polygon);
          fencesAdded++;
        }
      }
    } catch (fenceError) {
      console.warn(`Erro ao processar cerca no ponto ${index}:`, fenceError);
    }
  });
  
  console.log(`🛡️ ${fencesAdded} cercas virtuais adicionadas`);
}

// Funções de replay
function startReplay(map, filters) {
  // Parar replay anterior se estiver ativo
  stopReplay();
  
  // Limpar marcadores estáticos
  if (currentMarkers) {
    currentMarkers.clearLayers();
  }
  
  console.log(`🎬 Iniciando replay com ${replayPoints.length} pontos`);
  
  // Criar layer group para os marcadores do replay
  const replayLayer = L.layerGroup().addTo(map);
  
  // Adicionar controles de replay ao mapa
  addReplayControls(map);
  
  let currentMarker = null;
  
  replayInterval = setInterval(() => {
    if (replayIndex >= replayPoints.length) {
      // Fim do replay - reiniciar automaticamente
      restartReplay();
      return;
    }
    
    const ponto = replayPoints[replayIndex];
    const m = ponto.message;
    
    // Remover marcador anterior
    if (currentMarker) {
      replayLayer.removeLayer(currentMarker);
    }
    
    // Criar novo marcador
    const cor = (m.GPS_WARN && m.GPS_WARN !== 'false' && m.GPS_WARN !== '0') ? 'red' : 'green';
    currentMarker = L.circleMarker([m.LAT, m.LON], {
      radius: filters.pointSize * 1.5, // Marcador maior para destaque
      color: cor,
      fillColor: cor,
      fillOpacity: 0.9,
      weight: 3
    }).bindPopup(createPopupContent(ponto));
    
    replayLayer.addLayer(currentMarker);
    
    // Centralizar mapa no ponto atual (opcional)
    if (filters.autoFitBounds) {
      map.setView([m.LAT, m.LON], map.getZoom(), {
        animate: true,
        duration: 0.5
      });
    }
    
    // Atualizar informações do replay
    updateReplayInfo(ponto, replayIndex + 1, replayPoints.length);
    
    replayIndex++;
    
  }, replaySpeed);
  
  // Atualizar estado do botão de pause
  const pauseButton = document.getElementById('pauseReplay');
  if (pauseButton) {
    pauseButton.textContent = '⏸️';
  }
}

function addReplayControls(map) {
  // Criar controle personalizado para o replay
  const replayControl = L.control({ position: 'topright' });
  
  replayControl.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'replay-control');
    div.innerHTML = `
      <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); min-width: 180px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px;">🎬 Replay Ativo</h4>
        <div id="replayInfo" style="font-size: 11px; margin-bottom: 8px; line-height: 1.3;">
          Ponto: 0/${replayPoints.length}
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-bottom: 8px;">
          <button id="pauseReplay" title="Pausar/Continuar" style="padding: 6px; background: #ffc107; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">⏸️</button>
          <button id="restartReplay" title="Reiniciar" style="padding: 6px; background: #17a2b8; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">🔄</button>
          <button id="stopReplay" title="Parar" style="padding: 6px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">⏹️</button>
        </div>
        <div style="margin-top: 8px;">
          <label style="font-size: 11px; display: block; margin-bottom: 4px;">Velocidade:</label>
          <input type="range" id="replaySpeed" min="100" max="3000" value="${replaySpeed}" step="100" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px;">
            <span>Lento</span>
            <span id="speedValue">${replaySpeed/1000}s</span>
            <span>Rápido</span>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar event listeners
    setTimeout(() => {
      document.getElementById('pauseReplay').addEventListener('click', toggleReplay);
      document.getElementById('restartReplay').addEventListener('click', restartReplay);
      document.getElementById('stopReplay').addEventListener('click', stopReplay);
      document.getElementById('replaySpeed').addEventListener('input', function(e) {
        replaySpeed = parseInt(e.target.value);
        document.getElementById('speedValue').textContent = (replaySpeed/1000) + 's';
        // Reiniciar replay com nova velocidade
        if (replayInterval) {
          const filters = getFilters();
          startReplay(map, filters);
        }
      });
    }, 100);
    
    return div;
  };
  
  replayControl.addTo(map);
  window.replayControl = replayControl;
}

function removeReplayControls() {
  if (window.replayControl && window.mapInstance) {
    window.mapInstance.removeControl(window.replayControl);
  }
}

function updateReplayInfo(ponto, current, total) {
  const replayInfo = document.getElementById('replayInfo');
  if (replayInfo) {
    const time = new Date(ponto.timestamp).toLocaleString();
    replayInfo.innerHTML = `
      Ponto: ${current}/${total}<br>
      <small>${time}</small><br>
      <small>${ponto.message.CCID}</small>
    `;
  }
}

function stopReplay() {
  if (replayInterval) {
    clearInterval(replayInterval);
    replayInterval = null;
    console.log("⏹️ Replay parado");
  }
  replayIndex = 0;
  removeReplayControls();
}

function restartReplay() {
  console.log("🔄 Reiniciando replay");
  
  // Parar replay atual
  stopReplay();
  
  // Reiniciar do início
  replayIndex = 0;
  
  // Iniciar replay novamente
  const filters = getFilters();
  startReplay(window.mapInstance, filters);
  
  // Atualizar botão de pause para estado de play
  const pauseButton = document.getElementById('pauseReplay');
  if (pauseButton) {
    pauseButton.textContent = '⏸️';
  }
}

function toggleReplay() {
  const pauseButton = document.getElementById('pauseReplay');
  
  if (replayInterval) {
    // Pausar replay
    stopReplay();
    if (pauseButton) {
      pauseButton.textContent = '▶️';
      pauseButton.title = 'Continuar';
    }
    console.log("⏸️ Replay pausado");
  } else {
    // Continuar replay
    const filters = getFilters();
    startReplay(window.mapInstance, filters);
    if (pauseButton) {
      pauseButton.textContent = '⏸️';
      pauseButton.title = 'Pausar';
    }
    console.log("▶️ Replay continuado");
  }
}

// Funções de cerca manual
function drawFence() {
  const coordsText = document.getElementById('fenceCoords').value.trim();
  if (!coordsText || !window.mapInstance) {
    alert("Insira coordenadas válidas e carregue o mapa.");
    return;
  }

  const linhas = coordsText.split('\n');
  const coords = linhas.map(linha => {
    const [lat, lon] = linha.split(',').map(Number);
    return (isFinite(lat) && isFinite(lon)) ? [lat, lon] : null;
  }).filter(Boolean);

  if (coords.length < 3) {
    alert("É necessário pelo menos 3 pontos para formar uma cerca.");
    return;
  }

  const polygon = L.polygon(coords, {
    color: 'red',  // Vermelho para cercas manuais
    fillColor: '#f03',
    fillOpacity: 0.1,
    weight: 2
  }).addTo(window.mapInstance).bindPopup("🛡️ Cerca Manual");
  
  drawnFences.push(polygon);
  
  // Ajustar mapa para mostrar a cerca
  window.mapInstance.fitBounds(polygon.getBounds());
}

function clearFences() {
  drawnFences.forEach(fence => {
    if (window.mapInstance) {
      window.mapInstance.removeLayer(fence);
    }
  });
  drawnFences = [];
}