import L, { marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import ApexCharts from 'apexcharts';
import * as turf from '@turf/turf';

import { yellowIcon, redIcon, orangeIcon, greyIcon } from './color-markers';
import './animations.js';
import { baseLayer, getLayers } from './layers';
import { severityChartOptions, casualtyChartOptions, weekdaysChartOptions } from './charts-options.js';

import 'leaflet.heat';


// Map Logic
const map = L.map('map',{zoomControl: false}).setView([54.5, -3], 6);

const UK_NAME = "United Kingdom"
let currentData;
let currentLayer;
let heatPoints;
let newAccidentLatLng = null;
let tempAccidentMarker = null;
let currentAccident = null;
let activeMarker = null;
let originalLatLngOnEdit = null;
let bufferLayer = null;
let bufferFilteredData = null;
let bufferRadiusKm = 5;
let bufferCenterLatLng = null;
let districtFilteredData;
let districtLayer;
let districtPolygonLayer;
let currentLocationSelected = UK_NAME;

const { layers, refs } = getLayers();
const { markersLayer, heatmapLayer, choroplethLayer} = refs;

baseLayer.addTo(map);
markersLayer.addTo(map);
currentLayer = markersLayer;

L.control.layers(layers, {}, {collapsed: true, position: 'bottomleft'}).addTo(map);
L.control.zoom({ position: 'bottomleft' }).addTo(map);

loadAccidents().then(() => {loadDistricts();});

// Statistics Logic
function getSeverityPie(){
  let dataToUse = districtFilteredData || currentData;
  return [
      dataToUse.filter(a => a.accident_severity === 'Fatal').length,
      dataToUse.filter(a => a.accident_severity === 'Serious').length,
      dataToUse.filter(a => a.accident_severity === 'Slight').length
      ];
}


function getCasualtyHistogram() {
  const buckets = [
    {x: "1", y: 0 },
    {x: "2", y: 0 },
    {x: "3", y: 0 },
    {x: "4-5", y: 0 },
    {x: "6-10", y: 0},
    {x: "+10", y: 0}
  ];

  let dataToUse = districtFilteredData || currentData;

  if(dataToUse){
    dataToUse.forEach(a => {
      const n = a.number_of_casualties;

      if (n <= 1) buckets[0].y++;
      else if (n <= 2) buckets[1].y++;
      else if (n <= 3) buckets[2].y++;
      else if (n <= 5) buckets[3].y++;
      else if (n <= 10) buckets[4].y++;
      else buckets[5].y++;
    });

    return buckets;
  }
} 

function getWeekdaysHistogram(){
  const buckets = [
    {x: "Monday", y: 0 },
    {x: "Tuesday", y: 0 },
    {x: "Wednesday", y: 0 },
    {x: "Thursday", y: 0 },
    {x: "Friday", y: 0},
    {x: "Saturday", y: 0},
    {x: "Sunday", y: 0}
  ];

  let dataToUse = districtFilteredData || currentData;

  if(dataToUse){
    dataToUse.forEach(a => {
      const day = a.day_of_week;

      if (day == "Monday") buckets[0].y++;
      else if (day == "Tuesday") buckets[1].y++;
      else if (day == "Wednesday") buckets[2].y++;
      else if (day == "Thursday") buckets[3].y++;
      else if (day == "Friday") buckets[4].y++;
      else if (day == "Saturday") buckets[5].y++;
      else buckets[6].y++;
    });

    return buckets;
  }
}
// Statistics Logic

// Map Interactions
function lockMapInteractions() {
  map.dragging.disable();
  map.scrollWheelZoom.disable();
  map.doubleClickZoom.disable();
}

function unlockMapInteractions() {
  map.dragging.enable();
  map.scrollWheelZoom.enable();
  map.doubleClickZoom.enable();
}
// Map Interactions

// Rendering Logic
const infoSidebar = document.getElementById('info-sidebar');
const infoContent = document.getElementById('info-content');
const markersLegend = document.getElementById('legend-severity');
const choroplethLegend = document.getElementById('legend-choropleth');


let severityChart;
let casualtiesChart;
let weekdaysChart;

export function cleanStatistics() {
  if (severityChart) {
    severityChart.destroy();
    severityChart = null;
  }
  if (casualtiesChart) {
    casualtiesChart.destroy();
    casualtiesChart = null;
  }
  if(weekdaysChart) {
    weekdaysChart.destroy();
    weekdaysChart = null;
  }
}

export function renderStatistics() {

  let dataToUse = districtFilteredData || currentData;

  let accCounter = document.getElementById("accidents-counter")
  if (accCounter){
    accCounter.innerHTML = `
        <h2>Accidents in ${currentLocationSelected}</h2>
        <p class="font-normal text-gray-500">${dataToUse.length}</p>
      `;
  }

  if (!document.getElementById("severity-chart")) {
    infoContent.innerHTML = `
      <div id="accidents-counter" class="flex items-center justify-between text-xl font-inter font-semibold mb-4">
        <h2>Accidents in ${currentLocationSelected}</h2>
        <p class="font-normal text-gray-500">${dataToUse.length}</p>
      </div>
      <h2 class="text-xl font-inter font-semibold text-center mb-2">Severity</h2>
      <div id="severity-chart" class="mb-4"></div>
      <h2 class="text-xl font-inter font-semibold text-center mb-2">Casualties</h2>
      <div id="casualty-chart"></div>
      <h2 class="text-xl font-inter font-semibold text-center mb-2">Weekdays</h2>
      <div id="weekdays-chart"></div>
    `;
  }

  let severityData = getSeverityPie();
  let casualtyData = getCasualtyHistogram();
  let weekdaysData = getWeekdaysHistogram();

  if(severityChart){
    severityChart.updateSeries(severityData);
  } else {
    severityChart = new ApexCharts(document.getElementById("severity-chart"), severityChartOptions(severityData));
    severityChart.render();
  }

  if(casualtiesChart){
    casualtiesChart.updateSeries([{
      name: 'Number of Accidents',
      data: casualtyData
    }]);
  } else {
    casualtiesChart = new ApexCharts(document.getElementById("casualty-chart"), casualtyChartOptions(casualtyData));
    casualtiesChart.render();
  }

  if(weekdaysChart){
    weekdaysChart.updateSeries([{
      name: 'Number of Accidents',
      data: weekdaysData
    }]);
  } else {
    weekdaysChart = new ApexCharts(document.getElementById("weekdays-chart"), weekdaysChartOptions(weekdaysData));
    weekdaysChart.render();
  }
}

function renderMarkers(data) {
  markersLayer.clearLayers();
  data.forEach(accident => {
    const marker = L.marker([accident.latitude, accident.longitude], {icon: accident.accident_severity == "Fatal" ? redIcon : accident.accident_severity == "Serious" ? orangeIcon : yellowIcon });
    marker.on('click', () => {
          quitCreateAccident();
          map.setView([accident.latitude, accident.longitude]);
          currentAccident = accident;
          activeMarker = marker;
          var accidentColor = accident.accident_severity == "Fatal" ? " bg-red-100 text-red-700" : accident.accident_severity == "Serious" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";
          infoContent.innerHTML = `
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-inter font-semibold">Accident ${accident.accident_index} Details</h2>
            <button id="show-stats" class="text-sm text-blue-600 hover:underline">
              
            </button>
            <button>
              <i class="fa-solid fa-arrow-left text-gray-300  text-2xl cursor-pointer hover:text-gray-500 hover:scale-90 mr-2" id="return-statistics"></i>
              <i class="fa-solid fa-xmark text-gray-300  text-2xl cursor-pointer hover:text-gray-500 hover:scale-90" id="close-info"></i>
            </button>
          </div>
          <div id="acc-details" class="space-y-2">
            <div class="flex items-center justify-between">
                <div class="text-2xl font-bold text-gray-900">
                ${accident.time}
                </div>
                <span class="px-3 py-1 text-sm font-semibold rounded-full ${accidentColor}">
                ${accident.accident_severity} accident
                </span>
            </div>
            
            <div class="text-gray-500 text-sm mb-1">
                ${new Date(accident.accident_date).toLocaleDateString()}
            </div>

            <div class="border-t border-gray-200 pt-4 space-y-6">
                <div>
                    <h2 class="text-xl text-gray-900 font-semibold mb-2">Conditions</h2>
                    <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-500">Weather</span>
                        <span class="font-medium text-gray-900">${accident.weather_conditions}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">Light</span>
                        <span class="font-medium text-gray-900">${accident.light_conditions}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">Surface</span>
                        <span class="font-medium text-gray-900">${accident.road_surface_conditions}</span>
                    </div>
                    </div>
                </div>
                <div>
                    <h2 class="text-xl text-gray-900 font-semibold mb-2">Crash Summary</h2>
                    <div class="space-y-2">
                        <div class="flex justify-between">
                        <span class="text-gray-500">Vehicles</span>
                        <span class="font-medium text-gray-900">${accident.number_of_vehicles}</span>
                        </div>
                        <div class="flex justify-between">
                        <span class="text-gray-500">Casualties</span>
                        <span class="font-medium text-gray-900">${accident.number_of_casualties}</span>
                        </div>
                        <div class="flex justify-between">
                        <span class="text-gray-500">Vehicle type</span>
                        <span class="font-medium text-gray-900">${accident.vehicle_type}</span>
                        </div>
                    </div>
                </div>
                <div>
                    <h2 class="text-xl text-gray-900 font-semibold mb-2">Road</h2>
                    <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-500">Road type</span>
                        <span class="font-medium text-gray-900">${accident.road_type}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">Speed limit</span>
                        <span class="font-medium text-gray-900">${accident.speed_limit} mph</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">Junction type</span>
                        <span class="font-medium text-gray-900">${accident.junction_detail}</span>
                    </div>
                    </div>
                </div>
            </div>
        </div>
          <div class="mt-auto flex justify-between pt-4">
            <button id="info-update" class="bg-gray-50 rounded-lg shadow-sm flex items-center justify-center gap-2 px-3 py-2 hover:bg-gray-100 transition-transform duration-200 hover:scale-97 border border-neutral-300 cursor-pointer">
                <i class="fa-solid fa-pen text-2xl"></i>
                <span class="text-sm font-medium">Update</span>
            </button>
            <button id="info-delete" class="bg-red-500 rounded-lg text-white shadow-sm flex items-center justify-center gap-2 px-3 py-2 hover:bg-red-600 transition-transform duration-200 hover:scale-97 border border-neutral-300 cursor-pointer">
                <i class="fa-solid fa-trash-can text-2xl"></i>
                <span class="text-sm font-medium">Delete</span>
            </button>
          </div>
          `;
          
          updateButtonEventListener();
          deleteButtonEventListener();

          let statisticsReturn = document.getElementById('return-statistics');
          statisticsReturn.addEventListener('click', () => {
            cleanStatistics();
            renderStatistics();
          });

          if (!infoSidebar.classList.contains('-translate-x-0')) {
            infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
            infoSidebar.classList.toggle('-translate-x-0');
          }
        });

      markersLayer.addLayer(marker);
  });

  cleanStatistics();
  renderStatistics();
}

function renderHeatmap(data) {
  heatPoints = data.map(a => [a.latitude, a.longitude]);
  heatmapLayer.setLatLngs(heatPoints);
  cleanStatistics();
  renderStatistics();
}

map.on('baselayerchange', e => {
  const dataToUse = bufferFilteredData || currentData;
  currentLocationSelected = UK_NAME;
  switch(e.layer){
    case markersLayer:
      if(districtLayer){
        map.removeLayer(districtLayer);
        districtFilteredData = null;
      }
      currentLayer = markersLayer;
      renderMarkers(dataToUse);
      break;
    case heatmapLayer:
      if(districtLayer){
        map.removeLayer(districtLayer);
        districtFilteredData = null;
      }
      currentLayer = heatmapLayer;
      renderHeatmap(dataToUse);
      break;
    case choroplethLayer:
      if(currentLayer != choroplethLayer){
        loadDistricts();
      }
      currentLayer = choroplethLayer;
      cleanStatistics();
      renderStatistics();
      clearBuffer();
      break;
  }
  swapMapLegend(currentLayer);
});

function swapMapLegend(currentLayer){
  if (currentLayer === choroplethLayer){
    choroplethLegend.classList.remove("hidden");
    markersLegend.classList.add("hidden");
  } else if (currentLayer === markersLayer){
    choroplethLegend.classList.add("hidden");
    markersLegend.classList.remove("hidden");
  } else {
    choroplethLegend.classList.add("hidden");
    markersLegend.classList.add("hidden");
  }
}
// Rendering Logic

// Click Spatial Buffer
const toggle = document.getElementById('toggle-buffer');

toggle.addEventListener("change", () => {
  if (toggle.checked && currentLayer !== choroplethLayer) {
    map.on("click", handleMapClick);
  } else {
    map.off("click", handleMapClick);
    clearBuffer();
  }
});

function handleMapClick(e) {
  applyBuffer(e.latlng)
}

function applyBuffer(centerLatLng) {
  map.setView(centerLatLng);
  bufferCenterLatLng = centerLatLng
  const center = turf.point([bufferCenterLatLng.lng, bufferCenterLatLng.lat]);
  const buffered = turf.buffer(center, bufferRadiusKm, { units: 'kilometers' });
  if (bufferLayer) {
    map.removeLayer(bufferLayer);
  }

  bufferLayer = L.geoJSON(buffered, {
    style: {
      color: '#eb2525',
      weight: 2,
      fillColor: '#e65555',
      fillOpacity: 0.1
    }
  }).addTo(map);

  const accidentPoints = currentData.map(a => turf.point([a.longitude, a.latitude], a));
  const accidentFeatureCollection = turf.featureCollection(accidentPoints);
  const inside = turf.pointsWithinPolygon(accidentFeatureCollection, buffered);

  bufferFilteredData = inside.features.map(a => a.properties);

  map.fireEvent('baselayerchange', {layer: currentLayer});
}

const radiusInput = document.getElementById('buffer-radius');
const radiusValue = document.getElementById('buffer-radius-value');

if (radiusInput && radiusValue) {
  radiusInput.addEventListener('input', (e) => {
    bufferRadiusKm = Number(e.target.value);
    radiusValue.textContent = bufferRadiusKm;
  
    if (bufferCenterLatLng) {
      applyBuffer(bufferCenterLatLng);
    }
  });
}

const clearBufferButton = document.getElementById('clear-buffer');

if (clearBufferButton) {
  clearBufferButton.addEventListener('click', () => {
    clearBuffer();
  });
}

function clearBuffer() {
  bufferFilteredData = null;
  bufferCenterLatLng = null;
  
  if (bufferLayer) {
    map.removeLayer(bufferLayer);
    bufferLayer = null;
  }

  if (currentLayer !== choroplethLayer) {
     map.fireEvent('baselayerchange', {layer: currentLayer});
  }
}
// Click Spatial Buffer

// Data Loading Logic
function loadAccidents(filters){
  var baseURL = 'http://localhost:5000/accidents';
  if (filters) {
    const queryParams = new URLSearchParams();
    for (const [key, values] of Object.entries(filters)) {
      values.forEach(value => queryParams.append(key, value));
    }
    baseURL += `?${queryParams.toString()}`;
  }

  return fetch(baseURL)
      .then(res => res.json())
      .then(data => {
        currentData = data;
        currentLocationSelected = UK_NAME;
        map.fireEvent('baselayerchange', {layer: currentLayer});
      })
      .catch(err => console.error(err));
}

function loadDistricts(){
  var baseURL = "http://localhost:5000/districts";
  return fetch(baseURL)
  .then(res => res.json())
  .then(geojson => {
    choroplethLayer.clearLayers();
    districtFilteredData = null;
    districtPolygonLayer = null;
    if(districtLayer){
      map.removeLayer(districtLayer);
    }
    L.geoJSON(geojson, {
        onEachFeature: (feature,layer) => {
          layer.on('mouseover',() => {
            if(layer.options.fillOpacity == 0.7){
              layer.setStyle({
                weight: 3,
                fillOpacity: 0.9
              });
            }
          });

          layer.on('mouseout',() => {
            if(layer.options.fillOpacity == 0.9){
              layer.setStyle({
                weight: 1,
                fillOpacity: 0.7
              });
            }
          });
          
          layer.on('click', () => {
            layer.setStyle({
              weight: 1,
              fillOpacity: 0
            });

            if(districtPolygonLayer && districtPolygonLayer !== layer) {
              districtPolygonLayer.setStyle({
                fillOpacity: 0.7
              });
            }

            if(districtLayer){
              map.removeLayer(districtLayer);
            }

            districtPolygonLayer = layer;

            const accidentPoints = currentData.map(a => turf.point([a.longitude, a.latitude], a));
            const accidentFeatureCollection = turf.featureCollection(accidentPoints);
            const inside = turf.pointsWithinPolygon(accidentFeatureCollection, feature);

            districtFilteredData = inside.features.map(a => a.properties);
  
            districtLayer = L.featureGroup();
            districtFilteredData.forEach(accident => {
              districtLayer.addLayer(L.marker([accident.latitude, accident.longitude], {icon: accident.accident_severity == "Fatal" ? redIcon : accident.accident_severity == "Serious" ? orangeIcon : yellowIcon })
            .on('click', () => {
                quitCreateAccident();
                map.setView([accident.latitude, accident.longitude]);
                currentAccident = accident;
                var accidentColor = accident.accident_severity == "Fatal" ? " bg-red-100 text-red-700" : accident.accident_severity == "Serious" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";
                infoContent.innerHTML = `
                  <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-inter font-semibold">Accident ${accident.accident_index} Details</h2>
                    <button id="show-stats" class="text-sm text-blue-600 hover:underline">
                      
                    </button>
                    <button>
                      <i class="fa-solid fa-arrow-left text-gray-300  text-2xl cursor-pointer hover:text-gray-500 hover:scale-90 mr-2" id="return-statistics"></i>
                      <i class="fa-solid fa-xmark text-gray-300  text-2xl cursor-pointer hover:text-gray-500 hover:scale-90" id="close-info"></i>
                    </button>
                  </div>
                  <div id="acc-details" class="space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="text-2xl font-bold text-gray-900">
                        ${accident.time}
                        </div>
                        <span class="px-3 py-1 text-sm font-semibold rounded-full ${accidentColor}">
                        ${accident.accident_severity} accident
                        </span>
                    </div>
                    
                    <div class="text-gray-500 text-sm mb-1">
                        ${new Date(accident.accident_date).toLocaleDateString()}
                    </div>

                    <div class="border-t border-gray-200 pt-4 space-y-6">
                        <div>
                            <h2 class="text-xl text-gray-900 font-semibold mb-2">Conditions</h2>
                            <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-gray-500">Weather</span>
                                <span class="font-medium text-gray-900">${accident.weather_conditions}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-500">Light</span>
                                <span class="font-medium text-gray-900">${accident.light_conditions}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-500">Surface</span>
                                <span class="font-medium text-gray-900">${accident.road_surface_conditions}</span>
                            </div>
                            </div>
                        </div>
                        <div>
                            <h2 class="text-xl text-gray-900 font-semibold mb-2">Crash Summary</h2>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                <span class="text-gray-500">Vehicles</span>
                                <span class="font-medium text-gray-900">${accident.number_of_vehicles}</span>
                                </div>
                                <div class="flex justify-between">
                                <span class="text-gray-500">Casualties</span>
                                <span class="font-medium text-gray-900">${accident.number_of_casualties}</span>
                                </div>
                                <div class="flex justify-between">
                                <span class="text-gray-500">Vehicle type</span>
                                <span class="font-medium text-gray-900">${accident.vehicle_type}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h2 class="text-xl text-gray-900 font-semibold mb-2">Road</h2>
                            <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-gray-500">Road type</span>
                                <span class="font-medium text-gray-900">${accident.road_type}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-500">Speed limit</span>
                                <span class="font-medium text-gray-900">${accident.speed_limit} mph</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-500">Junction type</span>
                                <span class="font-medium text-gray-900">${accident.junction_detail}</span>
                            </div>
                            </div>
                        </div>
                    </div>
                </div>
                  <div class="mt-auto flex justify-between pt-4">
                    <button id="info-update" class="bg-gray-50 rounded-xl shadow-md flex items-center justify-center gap-2 px-3 py-2 hover:bg-gray-100 hover:scale-95 border border-neutral-300 cursor-pointer">
                        <i class="fa-solid fa-pen text-2xl"></i>
                        <span class="text-xs font-medium">Update</span>
                    </button>
                    <button id="info-delete" class="bg-red-500 rounded-xl text-white shadow-md flex items-center justify-center gap-2 px-3 py-2 hover:bg-red-600 hover:scale-95 border border-neutral-300 cursor-pointer">
                        <i class="fa-solid fa-trash-can text-2xl"></i>
                        <span class="text-xs font-medium">Delete</span>
                    </button>
                  </div>
                `;
                
                updateButtonEventListener();
                deleteButtonEventListener();

                let statisticsReturn = document.getElementById('return-statistics');
                statisticsReturn.addEventListener('click', () => {
                  cleanStatistics();
                  renderStatistics();
                });

                if (!infoSidebar.classList.contains('-translate-x-0')) {
                  infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
                  infoSidebar.classList.toggle('-translate-x-0');
                }
              }));

              districtLayer.addTo(map);
            });

            currentLocationSelected = feature.properties.lad22nm;
            cleanStatistics();
            renderStatistics();
            if (!infoSidebar.classList.contains('-translate-x-0')) {
            infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
            infoSidebar.classList.toggle('-translate-x-0');
            }

          });
        },
        style: feature => {
          const count = feature.properties.accident_count;

          const color = count > 50 ? '#08306b' :
                        count > 20 ? '#2171b5' :
                        count > 10 ? '#6baed6' :
                        count > 5  ? '#9ecae1' :
                        count > 0  ? '#c6dbef' :
                                     '#deebf7';

          return {
            fillColor: color,
            weight: 1,
            color: '#555',
            fillOpacity: 0.7
          };
        }
      }).addTo(choroplethLayer);
      map.fireEvent('baselayerchange', {layer: currentLayer});
  });
}
// Data Loading Logic

// Insert Accident
function createAccident(newAccidentData) {
  var baseURL = 'http://localhost:5000/accidents';
  
  return fetch(baseURL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(newAccidentData)
  })
      .then(res => res.json())
      .then(inserted => {
        currentData.push(inserted);
        map.fireEvent('baselayerchange', {layer: currentLayer});
        return inserted;
      })
      .catch(err => console.error(err));
}

const newAccidentPanel = document.getElementById('new-accident-panel');

map.on('contextmenu', (e) => {
  map.setView(e.latlng);
  newAccidentLatLng = e.latlng;
  newAccidentPanel.classList.remove('hidden');

  if (tempAccidentMarker) {
    map.removeLayer(tempAccidentMarker);
    tempAccidentMarker = null;
  }
  tempAccidentMarker = L.marker(newAccidentLatLng, {icon: greyIcon}).addTo(map);
  lockMapInteractions();
  clearBuffer();
});

function quitCreateAccident() {
  newAccidentPanel.classList.add('hidden');
  newAccidentLatLng = null;

  if (tempAccidentMarker) {
    map.removeLayer(tempAccidentMarker);
    tempAccidentMarker = null;
  }
  unlockMapInteractions();
}

document.getElementById('acc-cancel').addEventListener('click', () => {
  quitCreateAccident();
});

document.getElementById('acc-save').addEventListener('click', () => {
  const sev = document.getElementById('acc-sev').value;
  const wea = document.getElementById('acc-wea').value;
  const date = document.getElementById('acc-date').value;

  const newAccidentData = {
    latitude: newAccidentLatLng.lat,
    longitude: newAccidentLatLng.lng,
    accident_severity: sev,
    weather_conditions: wea,
    accident_date: date,
    day_of_week: getWeekDayName(date)
  };

  createAccident(newAccidentData)
    .then(() => {
      quitCreateAccident();
    })
    .then(() => {loadDistricts();})
    .catch(err => console.error(err));
});

function getWeekDayName(dateInput) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const date = new Date(dateInput);
  return days[date.getDay()];
}
// Insert Accident

// Update Accident
function updateAccident(accident_index, newAccidentData) {
  var baseURL = 'http://localhost:5000/accidents/' + encodeURIComponent(accident_index);
  
  return fetch(baseURL, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(newAccidentData)
  })
      .then(res => res.json())
      .then(updated => {
        const idx = currentData.findIndex(a => a.accident_index === updated.accident_index);
        currentData[idx] = updated;
        map.fireEvent('baselayerchange', {layer: currentLayer});
        currentAccident = null;
        infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
        infoSidebar.classList.toggle('-translate-x-0');
        return updated;
      })
      .catch(err => console.error(err));
}

function updateButtonEventListener() {
  const updateButton = document.getElementById('info-update');
  updateButton.onclick = () => {
    const detailsDiv = document.getElementById("acc-details");
    const isoDate = currentAccident.accident_date ? currentAccident.accident_date.slice(0, 10) : '';
    detailsDiv.innerHTML = `
                            <label class="block text-md mb-1">Latitude</label> 
                            <input id="edit-lat" type="number" step="0.0001" value="${currentAccident.latitude}" class="w-full border rounded px-2 py-1 text-md mb-3 cursor-pointer"

                            <label class="block text-md mb-1">Longitude</label> 
                            <input id="edit-lng" type="number" step="0.0001" value="${currentAccident.longitude}" class="w-full border rounded px-2 py-1 text-md mb-3 cursor-pointer"
                            
                            <label class="block text-md mb-1">Severity</label> 
                            <select id="edit-sev" class="w-full border rounded px-2 py-1 text-md mb-3 cursor-pointer">
                              <option value="Slight" ${currentAccident.accident_severity === 'Slight' ? 'selected' : ''}>Slight</option>
                              <option value="Serious" ${currentAccident.accident_severity === 'Serious' ? 'selected' : ''}>Serious</option>
                              <option value="Fatal" ${currentAccident.accident_severity === 'Fatal' ? 'selected' : ''}>Fatal</option>
                            </select>

                            <label class="block text-md mb-1">Weather Conditions</label> 
                            <select id="edit-wea" class="w-full border rounded px-2 py-1 text-md mb-3 cursor-pointer">
                              <option value="Fine" ${currentAccident.weather_conditions === 'Fine' ? 'selected' : ''}>Fine</option>
                              <option value="Raining" ${currentAccident.weather_conditions === 'Raining' ? 'selected' : ''}>Raining</option>
                              <option value="Snowing" ${currentAccident.weather_conditions === 'Snowing' ? 'selected' : ''}>Snowing</option>
                              <option value="Fog" ${currentAccident.weather_conditions === 'Fog' ? 'selected' : ''}>Fog</option>
                            </select>

                            <label class="block text-md mb-1">Date</label>
                            <input id="edit-date" type="date" class="w-full border rounded px-2 py-1 text-md mb-3 cursor-pointer" value="${isoDate}" />
                            `;

    const bottomBar = updateButton.parentElement;
    bottomBar.innerHTML = `<button id="edit-cancel" class="bg-gray-200 rounded-xl px-3 py-2 text-md font-medium hover:bg-gray-300 transition-transform duration-200 hover:scale-97 cursor-pointer">
                            Cancel
                            </button>
                            <button id="edit-save" class="bg-blue-600 text-white rounded-xl px-3 py-2 text-md font-medium hover:bg-blue-700 transition-transform duration-200 hover:scale-97 cursor-pointer">
                            Save Changes
                            </button>
                            `;
    
    const cancelButton = document.getElementById("edit-cancel");
    const saveButton = document.getElementById("edit-save");

    const latInput = document.getElementById('edit-lat');
    const lngInput = document.getElementById('edit-lng');

    originalLatLngOnEdit = activeMarker.getLatLng();

    function previewPosition() {
      const lat = parseFloat(document.getElementById('edit-lat').value);
      const lng = parseFloat(document.getElementById('edit-lng').value);
      activeMarker.setLatLng([lat, lng]);
    }
    
    latInput.addEventListener('input', previewPosition);
    lngInput.addEventListener('input', previewPosition);

    cancelButton.onclick = () => {
      if (originalLatLngOnEdit) {
        activeMarker.setLatLng(originalLatLngOnEdit);
      }

      infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
      infoSidebar.classList.toggle('-translate-x-0');
      detailsDiv.classList.add('hidden');
      bottomBar.classList.add('hidden');
    }

    saveButton.onclick = () => {
      const lat = parseFloat(latInput.value);
      const lng = parseFloat(lngInput.value);
      const sev = document.getElementById('edit-sev').value;
      const wea = document.getElementById('edit-wea').value;
      const date = document.getElementById('edit-date').value;

      const updatedAccident = {
        latitude: lat,
        longitude: lng,
        accident_severity: sev,
        weather_conditions: wea,
        accident_date: date
      };

      updateAccident(currentAccident.accident_index, updatedAccident).then(() => {loadDistricts();});
      detailsDiv.classList.add('hidden');
      bottomBar.classList.add('hidden');
    }
  }
}
// Update Accident

// Delete Accident
function deleteAccident(accident_index) {
  var baseURL = 'http://localhost:5000/accidents/' + encodeURIComponent(accident_index);
  
  return fetch(baseURL, {
    method: 'DELETE',
    headers: {'Content-Type': 'application/json'},
  })
      .then(res => res.json())
      .then(deleted => {
        currentData = currentData.filter(a => a.accident_index !== accident_index)
        map.fireEvent('baselayerchange', {layer: currentLayer});
        currentAccident = null;
        infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
        infoSidebar.classList.toggle('-translate-x-0');
        return deleted;
      })
      .catch(err => console.error(err));
}

function deleteButtonEventListener() {
  const deleteButton = document.getElementById('info-delete');
  deleteButton.onclick = () => {
    const detailsDiv = document.getElementById("acc-details");
    detailsDiv.innerHTML = `<label class="block text-md mb-1">Are you sure you want to delete this accident?</label>`;

    const bottomBar = deleteButton.parentElement;
    bottomBar.innerHTML = `<button id="delete-cancel" class="bg-gray-200 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-300 transition-transform duration-200 hover:scale-97 cursor-pointer">
                            Cancel
                            </button>
                            <button id="delete-confirm" class="bg-red-500 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-600 transition-transform duration-200 hover:scale-97 cursor-pointer">
                            Confirm Delete
                            </button>
                            `;

    const cancelButton = document.getElementById("delete-cancel");
    const confirmButton = document.getElementById("delete-confirm");
    
    cancelButton.onclick = () => {
      infoSidebar.classList.toggle('-translate-x-[calc(100%+1vw)]');
      infoSidebar.classList.toggle('-translate-x-0');
      detailsDiv.classList.add('hidden');
      bottomBar.classList.add('hidden');
    }

    confirmButton.onclick = () => {
      deleteAccident(currentAccident.accident_index).then(() => {loadDistricts();});
      detailsDiv.classList.add('hidden');
      bottomBar.classList.add('hidden');
    }
  }
}
// Delete Accident

// Bulk Insert
function bulkImportAccidents(file) {
  const formData = new FormData();
  formData.append('file', file);
  const baseURL = 'http://localhost:5000/accidents/bulk';
  
  return fetch(baseURL, {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(result => {
        currentData = currentData.concat(result.rows);
        map.fireEvent('baselayerchange', { layer: currentLayer });
      return result;
    });
}

export function handleBulkFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    alert("Please upload a CSV file.");
    return;
  }

  bulkImportAccidents(file).then(result => {
    alert(`Imported ${result.insertedCount} accidents.`);
    document.getElementById('bulk-dropzone-close').click();
  })
  .then(() => {renderStatistics();loadDistricts();})
  .catch(err => {
    console.error('Bulk import failed:', err);
    alert(`Bulk import failed: ${err.message}`);
  });
}
// Bulk Insert

// Filter Logic
function getSelectedFilters() {
  const allowedFilters = ['severity-filter', 'weather-filter','weekdays-filter'];
  const selected = {};

  for (const id of allowedFilters) {
    const form = document.getElementById(id);
    const formData = new FormData(form);
    
    for (const [key, value] of formData.entries()) {
      if (!selected[key]) selected[key] = [];
      selected[key].push(value);
    }
  }

  return selected;
}

document.getElementById('apply-filters').addEventListener('click', () => {
  const filters = getSelectedFilters();
  loadAccidents(filters).then(() => {renderStatistics();loadDistricts();});
});
// Filter Logic

// Full Extent Logic
function boundsOfLayer(layer) {
  let bounds;
  if (layer === markersLayer) {
    bounds = layer.getBounds();
  }

  if (layer === heatmapLayer) {
    bounds = L.latLngBounds(heatPoints);
  }

  if (layer === choroplethLayer) {
    if (districtLayer) {
      bounds = districtLayer.getBounds();
    } else {
      bounds = layer.getBounds();
    }
  }

  return bounds.isValid() ? bounds : null;
}

document.getElementById('fullExtentBtn').addEventListener('click', () => {
  const bounds = boundsOfLayer(currentLayer);
  if (bounds) {
    map.fitBounds(bounds.pad(0.05), { maxZoom: 16 });
  } else {
    map.setView([51.505, -0.09], 8);
  }
});
// Full Extent Logic