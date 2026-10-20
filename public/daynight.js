/* daynight.js — day/night shading for a Leaflet 1.9 map (global L).
 *
 *   var h = window.deskDayNight.add(map, { theme: 'night' | 'day', opacity: 1 });
 *   h.setTheme('day');  h.update();  h.remove();
 *
 * Every place on the map is lit or dark by the real local time there (solar
 * terminator from the current UTC time, NOAA approximations). The night side
 * gets a dark tint with softer civil / nautical / astronomical twilight steps,
 * and NASA GIBS "Black Marble" city lights are shown only inside the night
 * area (their pane is clipped with CSS clip-path in layer-point coordinates).
 * Panes sit above the base tiles and below overlays / markers and never take
 * pointer events. Redraws on zoomend / viewreset / moveend and every 60 s.
 *
 * Optional opts: theme, opacity (tint scale, default 1), lights (default
 * true), lightsOpacity, now (Date or function returning Date, for testing),
 * zIndex (tint pane z, default 300; lights pane = zIndex + 10).
 */
(function () {
  'use strict';

  var LIGHTS_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
  var RAD = Math.PI / 180;
  var MAX_LAT = 85.05;
  // Sun altitudes (degrees) of the steps: night begins at 0, then the
  // civil, nautical and astronomical twilight limits.
  var STEPS = [0, -6, -12, -18];
  var LIGHTS_ALT = -3; // lights appear a little after sunset
  var uid = 0;

  function subsolar(date) {
    // NOAA "General Solar Position Calculations" approximations.
    var start = Date.UTC(date.getUTCFullYear(), 0, 1);
    var doy = Math.floor((date.getTime() - start) / 864e5) + 1;
    var hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    var g = 2 * Math.PI / 365 * (doy - 1 + (hours - 12) / 24);
    var eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)); // minutes
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) -
      0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) -
      0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g); // radians
    var lon = -15 * (hours - 12 + eqtime / 60);
    lon = ((lon + 540) % 360) - 180;
    return { lat: decl / RAD, lon: lon };
  }

  // Rings (arrays of [lat, lng]) covering where the sun altitude is below
  // `alt` degrees, repeated so longitudes -540..540 are covered.
  function nightRings(sun, alt) {
    var latc = -sun.lat * RAD;           // antisolar point
    var lonc = sun.lon + 180;
    if (lonc > 180) lonc -= 360;
    var r = (90 + alt) * RAD;            // cap radius around the antisolar point
    var sl = Math.sin(latc), cl = Math.cos(latc), sr = Math.sin(r), cr = Math.cos(r);
    var pts = [], prev = null, i;
    for (i = 0; i <= 360; i += 1) {
      var th = i * RAD;
      var lat2 = Math.asin(sl * cr + cl * sr * Math.cos(th));
      var lon2 = lonc + Math.atan2(Math.sin(th) * sr * cl, cr - sl * Math.sin(lat2)) / RAD;
      if (prev !== null) { while (lon2 - prev > 180) lon2 -= 360; while (lon2 - prev < -180) lon2 += 360; }
      prev = lon2;
      pts.push([Math.max(-MAX_LAT, Math.min(MAX_LAT, lat2 / RAD)), lon2]);
    }
    var span = pts[pts.length - 1][1] - pts[0][1];
    var rings = [], k, j;
    if (Math.abs(span) > 180) {
      // The cap holds a pole: a band across every longitude, closed at that pole.
      pts.pop();
      if (span < 0) pts.reverse();
      var band = [];
      // pts spans one turn starting within -540..540; six turns cover -540..540 for sure
      for (k = -3; k <= 2; k++) {
        for (j = 0; j < pts.length; j++) band.push([pts[j][0], pts[j][1] + k * 360]);
      }
      var poleLat = (90 - (-sun.lat)) * RAD < r ? MAX_LAT : -MAX_LAT; // north pole inside cap?
      band.push([poleLat, band[band.length - 1][1]]);
      band.push([poleLat, band[0][1]]);
      rings.push(band);
    } else {
      for (k = -1; k <= 1; k++) {
        var ring = [];
        for (j = 0; j < pts.length; j++) ring.push([pts[j][0], pts[j][1] + k * 360]);
        rings.push(ring);
      }
    }
    return rings;
  }

  function tintStyle(theme, opacity) {
    var per = (theme === 'night' ? 0.11 : 0.17) * (opacity == null ? 1 : opacity);
    return { stroke: false, fill: true, fillColor: '#020617', fillOpacity: Math.max(0, Math.min(1, per)), interactive: false };
  }

  function add(map, opts) {
    var noop = { remove: function () {}, setTheme: function () {}, update: function () {} };
    try {
      var L = window.L;
      if (!L || !map || typeof map.createPane !== 'function') return noop;
      opts = opts || {};
      var theme = opts.theme === 'day' ? 'day' : 'night';
      var id = ++uid;
      var z = opts.zIndex || 300;

      function mkPane(name, zi) {
        var p = map.getPane(name) || map.createPane(name);
        p.style.zIndex = String(zi);
        p.style.pointerEvents = 'none';
        return p;
      }
      var tintPane = mkPane('deskNightTint' + id, z);
      var lightsPane = mkPane('deskNightLights' + id, z + 10);
      lightsPane.style.mixBlendMode = 'screen';
      // Only the lights (20 Oct: the user found the layer muddy): the image's blue-grey land is pressed to black,
      // which the screen blend leaves out, and the lights stay crisp and warm.
      lightsPane.style.filter = 'brightness(.85) contrast(2.4) saturate(1.3)';
      // The image is sharp to zoom 8 (about 500 m a pixel); closer in it would only blur, so it fades away.
      function lightsBase() { return opts.lightsOpacity != null ? opts.lightsOpacity : (theme === 'night' ? 0.95 : 0.85); }
      function lightsLevel() {
        var zz = map.getZoom();
        var f = zz <= 7.5 ? 1 : zz >= 9 ? 0 : (9 - zz) / 1.5;
        lightsPane.style.opacity = String(lightsBase() * f);
        lightsPane.style.display = f ? '' : 'none';
      }
      lightsLevel();

      var renderer = L.svg({ pane: 'deskNightTint' + id, padding: 0.5 });
      var tints = [];
      var lights = null;
      if (opts.lights !== false) {
        lights = L.tileLayer(LIGHTS_URL, {
          pane: 'deskNightLights' + id, maxNativeZoom: 8, maxZoom: 22, minZoom: 0,
          noWrap: false, interactive: false, crossOrigin: false, attribution: 'Night lights: NASA Black Marble'
        });
        lights.addTo(map);
      }

      function now() {
        var n = opts.now;
        if (typeof n === 'function') n = n();
        return n instanceof Date ? n : new Date();
      }

      function clipPath(sun) {
        if (!lights) return;
        var size = map.getSize();
        var tl = map.containerPointToLayerPoint([-size.x, -size.y]);
        var br = map.containerPointToLayerPoint([size.x * 2, size.y * 2]);
        var bounds = L.bounds(tl, br);
        var rings = nightRings(sun, LIGHTS_ALT), d = '';
        for (var i = 0; i < rings.length; i++) {
          var lp = [];
          for (var j = 0; j < rings[i].length; j++) lp.push(map.latLngToLayerPoint(rings[i][j]));
          lp = L.PolyUtil.clipPolygon(lp, bounds);
          if (lp.length < 3) continue;
          d += 'M' + lp[0].x.toFixed(1) + ' ' + lp[0].y.toFixed(1);
          for (var m = 1; m < lp.length; m++) d += 'L' + lp[m].x.toFixed(1) + ' ' + lp[m].y.toFixed(1);
          d += 'Z';
        }
        var v = d ? "path('" + d + "')" : 'inset(100%)';
        lightsPane.style.clipPath = v;
        lightsPane.style.webkitClipPath = v;
        lightsPane.style.visibility = '';
      }

      function update() {
        try {
          var sun = subsolar(now());
          var style = tintStyle(theme, opts.opacity);
          for (var s = 0; s < STEPS.length; s++) {
            var rings = nightRings(sun, STEPS[s]);
            if (!tints[s]) {
              tints[s] = L.polygon(rings, L.extend({ renderer: renderer, pane: 'deskNightTint' + id }, style)).addTo(map);
            } else {
              tints[s].setLatLngs(rings);
              tints[s].setStyle(style);
            }
          }
          clipPath(sun);
          lightsLevel();
        } catch (e) { /* never break the host page */ }
      }
      function redrawClip() { try { clipPath(subsolar(now())); } catch (e) {} }
      // Kept on through a zoom (20 Oct: hidden at each zoom's start, the lights blinked off and on with every zoom); the
      // night's edge is set right again when the zoom ends.
      function hideClip() {}

      map.on('zoomstart', hideClip);
      map.on('zoomend viewreset', update);
      map.on('moveend resize', redrawClip);
      var timer = setInterval(update, 60000);
      update();

      return {
        update: update,
        setTheme: function (t) {
          try {
            theme = t === 'day' ? 'day' : 'night';
            if (opts.lightsOpacity == null) lightsPane.style.opacity = String(theme === 'night' ? 0.9 : 0.8);
            update();
          } catch (e) {}
        },
        remove: function () {
          try {
            clearInterval(timer);
            map.off('zoomstart', hideClip);
            map.off('zoomend viewreset', update);
            map.off('moveend resize', redrawClip);
            for (var i = 0; i < tints.length; i++) map.removeLayer(tints[i]);
            tints = [];
            if (lights) map.removeLayer(lights);
            map.removeLayer(renderer);
            [tintPane, lightsPane].forEach(function (p) { if (p && p.parentNode) p.parentNode.removeChild(p); });
            var panes = map._panes;
            if (panes) { delete panes['deskNightTint' + id]; delete panes['deskNightLights' + id]; }
          } catch (e) {}
        }
      };
    } catch (e) {
      return noop;
    }
  }

  try { window.deskDayNight = { add: add, subsolar: subsolar }; } catch (e) {}
})();
