import L from 'leaflet';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';

export const baseLayer = 
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20

        /* L.tileLayer('https://tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token={accessToken}', {
        attribution: '<a href="https://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        minZoom: 0,
        maxZoom: 22,
        accessToken: 'wzc1kkDoGwuL56DejpkVD4ojrgaE3YdQrJVSzOig4lQ065NANqzOTKchSHwJPk2g' */
});

export function getLayers() {
    const markersLayer = L.markerClusterGroup({ disableClusteringAtZoom: 16 });

    const heatmapLayer = L.heatLayer([], {
              radius: 35,
              blur: 20,
              minOpacity: 0.25,
              gradient: {0.0: 'blue', 0.3: 'lime', 0.6: 'yellow', 1.0: 'red'},
            });

    const choroplethLayer = L.geoJSON();

    const layers = {
        "Markers": markersLayer,
        "Heatmap": heatmapLayer,
        "Choropleth": choroplethLayer
    }

    return {
        layers,
        refs: {markersLayer, heatmapLayer, choroplethLayer}
    };
}