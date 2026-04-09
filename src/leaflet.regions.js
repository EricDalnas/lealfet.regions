(function (L) {
  'use strict';

  if (!L) {
    throw new Error('leaflet.regions requires Leaflet to be loaded first.');
  }

  function toUpperSafe(val) {
    return (val === null || val === undefined) ? '' : String(val).toUpperCase();
  }

  /*
  * Resolve an option that can be either a fixed value or a function.
  * If it's a function, call it with the feature and region data to get the value.
  */    
  function resolve(val, feature, regionData) {
    return typeof val === 'function' ? val(feature, regionData) : val;
  }

  /*
  * Detect if a color string has embedded alpha (e.g. rgba() or #RRGGBBAA) which would override fillOpacity.
  * If so, we should not apply the fillOpacity on top of it.
  */
  function colorHasEmbeddedAlpha(color) {
    if (typeof color !== 'string') return false;
    var value = color.trim().toLowerCase();
    return /^rgba\(/.test(value) ||
      /^hsla\(/.test(value) ||
      /^#[0-9a-f]{4}$/.test(value) ||
      /^#[0-9a-f]{8}$/.test(value) ||
      value === 'transparent';
  }

  L.RegionsLayer = L.FeatureGroup.extend({
    options: {
      geoJsonUrl: null,
      geoJson: null,
      data: null,
      // Return the stable key used to match a GeoJSON feature to entries in `data`.
      featureKey: function (feature) {
        var props = feature && feature.properties ? feature.properties : {};
        return toUpperSafe(feature.id || props.id || props.key || props.code || props.name || '');
      },
      color: '#4a90e2',
      borderColor: '#555',
      fillOpacity: 1,
      weight: 1,
      labelColor: '#333333',
      // Return the text shown in the permanent region label.
      label: function (feature) {
        var props = feature && feature.properties ? feature.properties : {};
        return props.name || props.NAME || '';
      },
      popupContent: null,
      popupAction: 'click',
      labelMinZoom: null,
      labelAbbrBelowZoom: null,
      labelMarkerOptions: {
        icon: null
      }
    },

    initialize: function (options) {
      L.FeatureGroup.prototype.initialize.call(this);
      L.setOptions(this, options);
      this._data = {};
      this.regions = this._data;
      this._geojson = null;
      this._ready = false;
      this._labelMarkers = {};

      var self = this;
      this._loadAll().then(function () {
        self._ready = true;
        if (self._map) self._render();
      });
    },

    onAdd: function (map) {
      L.FeatureGroup.prototype.onAdd.call(this, map);
      if (this._usesZoomBasedLabels()) {
        map.on('zoomend', this._onMapZoomEnd, this);
      }
      if (this._ready) this._render();
    },

    onRemove: function (map) {
      if (this._usesZoomBasedLabels()) {
        map.off('zoomend', this._onMapZoomEnd, this);
      }
      L.FeatureGroup.prototype.onRemove.call(this, map);
    },

    _usesZoomBasedLabels: function () {
      return typeof this.options.labelMinZoom === 'number' ||
        typeof this.options.labelAbbrBelowZoom === 'number';
    },

    _onMapZoomEnd: function () {
      if (this._ready) this._render();
    },

    _loadAll: function () {
      var self = this;
      return Promise.all([
        this._loadGeoJson(),
        this._loadData(this.options.data)
      ]).then(function () { return self; });
    },

    _loadGeoJson: function () {
      var self = this;
      if (this.options.geoJson && this.options.geoJson.type === 'FeatureCollection') {
        this._geojson = this.options.geoJson;
        return Promise.resolve();
      }
      if (!this.options.geoJsonUrl) {
        return Promise.reject(new Error('Provide geoJson or geoJsonUrl.'));
      }
      return fetch(this.options.geoJsonUrl)
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to fetch GeoJSON: ' + r.status);
          return r.json();
        })
        .then(function (json) {
          self._geojson = json;
        });
    },

    _loadData: function (data) {
      var self = this;
      if (!data) {
        this._replaceData({});
        return Promise.resolve();
      }
      if (typeof data === 'string') {
        return fetch(data)
          .then(function (r) {
            if (!r.ok) throw new Error('Failed to fetch data: ' + r.status);
            return r.json();
          })
          .then(function (payload) {
            self._indexData(payload);
          });
      }
      this._indexData(data);
      return Promise.resolve();
    },

    _replaceData: function (nextMap) {
      var k;
      for (k in this._data) {
        if (Object.prototype.hasOwnProperty.call(this._data, k)) delete this._data[k];
      }
      for (k in nextMap) {
        if (Object.prototype.hasOwnProperty.call(nextMap, k)) this._data[k] = nextMap[k];
      }
    },

    _indexData: function (input) {
      var idx = {};
      if (Array.isArray(input)) {
        for (var i = 0; i < input.length; i++) {
          if (input[i] && input[i].key) idx[toUpperSafe(input[i].key)] = input[i];
        }
      } else if (input && typeof input === 'object') {
        var map = input.regions && typeof input.regions === 'object' ? input.regions : input;
        for (var key in map) {
          if (Object.prototype.hasOwnProperty.call(map, key) && map[key] && typeof map[key] === 'object') {
            idx[toUpperSafe(key)] = map[key];
          }
        }
      }
      this._replaceData(idx);
    },

    _keyForFeature: function (feature) {
      return toUpperSafe(resolve(this.options.featureKey, feature, null));
    },

    _dataForFeature: function (feature) {
      return this._data[this._keyForFeature(feature)] || {};
    },

    _labelForFeatureAtZoom: function (feature, rd) {
      var text = (rd.label !== undefined && rd.label !== null)
        ? rd.label
        : resolve(this.options.label, feature, rd);
      if (!text || !this._map) return text || '';

      var zoom = this._map.getZoom();
      var min = this.options.labelMinZoom;
      var abbr = this.options.labelAbbrBelowZoom;
      if (typeof min === 'number' && zoom < min) return '';
      if (typeof abbr === 'number' && zoom < abbr) return this._keyForFeature(feature) || text;
      return text;
    },

    _styleForFeature: function (feature) {
      var rd = this._dataForFeature(feature);
      var fillColor = rd.color || resolve(this.options.color, feature, rd) || '#4a90e2';
      var borderColor = rd.borderColor || rd.strokeColor || resolve(this.options.borderColor, feature, rd) || '#555';
      var fillOpacity = (rd.fillOpacity !== undefined && rd.fillOpacity !== null) ? rd.fillOpacity : this.options.fillOpacity;
      if (colorHasEmbeddedAlpha(fillColor)) fillOpacity = 1;
      return {
        color: borderColor,
        weight: this.options.weight,
        fillColor: fillColor,
        fillOpacity: fillOpacity
      };
    },

    _render: function () {
      var self = this;
      if (!this._geojson || !this._map) return;
      this.clearLayers();
      for (var key in this._labelMarkers) {
        if (Object.prototype.hasOwnProperty.call(this._labelMarkers, key)) {
          var marker = this._labelMarkers[key];
          if (marker) this.removeLayer(marker);
        }
      }
      this._labelMarkers = {};

      L.geoJSON(this._geojson, {
        style: function (feature) {
          return self._styleForFeature(feature);
        },
        onEachFeature: function (feature, layer) {
          self._configureFeature(feature, layer);
          self.addLayer(layer);
        }
      });

      this.fire('rendered', { layerCount: this.getLayers().length });
    },

    _configureFeature: function (feature, layer) {
      var rd = this._dataForFeature(feature);
      var popupContent = (rd.popupContent !== undefined && rd.popupContent !== null)
        ? rd.popupContent
        : resolve(this.options.popupContent, feature, rd);

      if (popupContent && this.options.popupAction) {
        layer.bindPopup(popupContent, { maxWidth: 320 });
        if (this.options.popupAction === 'hover') {
          layer.on('mouseover', function (e) { this.openPopup(e.latlng); });
          layer.on('mouseout', function () { this.closePopup(); });
        }
      }

      var labelText = this._labelForFeatureAtZoom(feature, rd);
      if (labelText) {
        var labelColor = rd.labelColor || resolve(this.options.labelColor, feature, rd) || '#333';
        if (rd.labelLatLng) {
          this._createLabelMarker(feature, rd, labelText, labelColor);
        } else {
          layer.unbindTooltip();
          layer.bindTooltip('<span style="color:' + labelColor + '">' + labelText + '</span>', {
            permanent: true,
            direction: 'center',
            className: 'us-states-label',
            interactive: false,
            opacity: 1
          });
        }
      }
    },

    _createLabelMarker: function (feature, regionData, labelText, labelColor) {
      if (!this._map) return;
      var key = this._keyForFeature(feature);
      if (this._labelMarkers[key]) return;
      var latLng = regionData.labelLatLng;
      var lat, lng;
      if (Array.isArray(latLng)) {
        lat = latLng[0];
        lng = latLng[1];
      } else if (typeof latLng === 'object' && latLng.lat !== undefined && latLng.lng !== undefined) {
        lat = latLng.lat;
        lng = latLng.lng;
      } else {
        return;
      }
      var markerOptions = Object.assign({}, this.options.labelMarkerOptions);
      if (!markerOptions.icon) {
        markerOptions.icon = L.divIcon({
          html: '',
          iconSize: [0, 0],
          className: 'label-marker-invisible'
        });
      }
      var marker = L.marker([lat, lng], markerOptions);
      marker.bindTooltip('<span style="color:' + labelColor + '">' + labelText + '</span>', {
        permanent: true,
        direction: 'center',
        className: 'us-states-label',
        interactive: false,
        opacity: 1
      });
      
      this._labelMarkers[key] = marker;
      this.addLayer(marker);
    },

    setData: function (data) {
      var self = this;
      this.options.data = data;
      this._replaceData({});
      this._loadData(data).then(function () {
        if (self._map && self._ready) self._render();
      });
    },

    getRegions: function () {
      return this._data;
    },

    setRegion: function (key, patch) {
      var k = toUpperSafe(key);
      if (!k) return;
      this._data[k] = Object.assign({}, this._data[k] || {}, patch || {});
      if (this._labelMarkers[k]) {
        this.removeLayer(this._labelMarkers[k]);
        delete this._labelMarkers[k];
      }
      if (this._map && this._ready) this._render();
    },

    refresh: function () {
      if (this._map && this._ready) this._render();
    },

    setOptions: function (opts) {
      L.setOptions(this, opts);
      if (this._map && this._ready) this._render();
    }
  });

  L.regionsLayer = function (options) {
    return new L.RegionsLayer(options);
  };
}(window.L));
