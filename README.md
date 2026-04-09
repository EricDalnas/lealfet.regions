# leaflet.regions

A generic Leaflet plugin for rendering GeoJSON regions and binding keyed data.

## Live Demo

[View the interactive demo](https://ericdalnas.github.io/lealfet.regions/demo/index.html)

## Browser usage

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="./src/leaflet.regions.js"></script>
```

```js
var layer = L.regionsLayer({
  geoJsonUrl: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
  featureKey: function (feature) {
    return String(feature.properties.CONTINENT || '').toUpperCase();
  },
  label: function (feature) {
    return feature.properties.NAME || feature.properties.ADMIN || '';
  },
  data: {
    'AFRICA': { color: '#f59e0b', popupContent: 'Africa' },
    'EUROPE': { color: '#3b82f6', popupContent: 'Europe' },
    'ASIA': { color: '#ef4444', popupContent: 'Asia' }
  }
}).addTo(map);
```

## Configuration

Region data properties:

- `color` - Fill color
- `borderColor` / `strokeColor` - Border color
- `fillOpacity` - Fill opacity
- `label` - Label text
- `labelColor` - Label color
- `labelLatLng` - Manual label position as `[lat, lng]` or `{lat, lng}`
- `popupContent` - Popup HTML
- `popupAction` - `'click'` or `'hover'`

Global options:

- `featureKey(feature)` - Returns the key used to match a GeoJSON feature to `data`
- `label(feature, regionData)` - Returns the label text when a region does not define its own `label`
- `labelMinZoom` - Minimum zoom to display labels
- `labelAbbrBelowZoom` - Show region key below this zoom level

Example:

```js
var layer = L.regionsLayer({
  geoJsonUrl: 'regions.geojson',
  labelMinZoom: 4,
  data: {
    'AFRICA': {
      color: '#f59e0b',
      labelLatLng: [0, 20]
    },
    'EUROPE': {
      color: '#3b82f6',
      labelLatLng: { lat: 54, lng: 24 }
    }
  }
}).addTo(map);
```

## Demos

- `demo/index.html` - Basic usage demo

## Data Sources

The demos use **Natural Earth 1:110m Admin 0 Map Units** GeoJSON (`ne_110m_admin_0_map_units`), which is in the **public domain**.

> Made with Natural Earth. Free vector and raster map data @ [naturalearthdata.com](https://www.naturalearthdata.com/).

This dataset is preferred over `ne_110m_admin_0_countries` for continent-grouped demos because it splits territories like French Guiana into their own features with the correct `CONTINENT` value, rather than bundling them into their sovereign country's MultiPolygon.
