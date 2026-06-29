/* ============================================================
   Court VC Links — live data layer
   Pulls real court / judge data straight from the project's
   Google Sheet via the opensheet JSON proxy, with a localStorage
   cache (3-day TTL). Each court below maps a sheet tab to the
   columns that actually exist in that tab, normalised into a
   common shape the UI can render:

     row = {
       name,                       // primary label (judge / court)
       platforms: [ { label, kind, url, codes:[{lbl,val}] } ],
       extras:    [ { label, val } ],   // reader / room / coordinator …
       search                       // lowercased haystack
     }

   kind ∈ meet | zoom | bvc | webex  (drives the join-button colour)
   ============================================================ */
(function () {
  'use strict';

  var SHEET_ID = '15ILqRbBU5d0RpJNurwxAKIT7OcBQ-dM5h8c54SosPM8';
  var BASE = 'https://opensheet.elk.sh/' + SHEET_ID;
  var CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 days
  var CACHE_VERSION = 'v2';                // bump to invalidate user caches
  var mem = {};                            // in-memory raw cache

  /* ---------- persistent cache (localStorage + TTL) ---------- */
  function cacheKey(tab) { return 'cvc_' + CACHE_VERSION + '_' + tab; }
  function getCached(tab) {
    if (mem[tab]) return mem[tab];
    try {
      var raw = localStorage.getItem(cacheKey(tab));
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) return null;
      mem[tab] = obj.data;
      return obj.data;
    } catch (e) { return null; }
  }
  function setCached(tab, data) {
    mem[tab] = data;
    try { localStorage.setItem(cacheKey(tab), JSON.stringify({ ts: Date.now(), data: data })); }
    catch (e) { /* quota — in-memory cache still works */ }
  }

  async function fetchRaw(tab, force) {
    if (!force) { var hit = getCached(tab); if (hit) return hit; }
    var res = await fetch(BASE + '/' + encodeURIComponent(tab));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    if (!Array.isArray(data)) throw new Error('Unexpected sheet response');
    setCached(tab, data);
    return data;
  }

  /* ---------- court definitions (real sheet columns) ---------- */
  var COURTS = [
    {
      id: 'mohali', short: 'Mohali', name: 'Mohali District Courts',
      region: 'Punjab', icon: 'gavel', sheetTab: 'Mohali',
      nameKey: 'Name of Judicial Officer', filterEmpty: 'VC Link (Google Meet)',
      platforms: [{ label: 'Google Meet', kind: 'meet', urlKey: 'VC Link (Google Meet)' }],
      extras: [
        { label: 'Reader Contact', key: 'Reader Contact Details' },
        { label: 'Naib Court Contact', key: 'Naib Court Contact Details' },
        { label: 'Court Room', key: 'Court Room Number' }
      ]
    },
    {
      id: 'chandigarh', short: 'Chandigarh', name: 'Chandigarh District Courts',
      region: 'U.T.', icon: 'building', sheetTab: 'Chandigarh',
      nameKey: 'Name of Court', filterEmpty: 'Name of Court',
      platforms: [
        { label: 'Google Meet', kind: 'meet', urlKey: 'Google Meet Link' },
        { label: 'Zoom', kind: 'zoom', urlKey: 'Zoom Link', idKey: 'Zoom Meeting ID', passKey: 'Zoom Passcode' },
        { label: 'BharatVC', kind: 'bvc', urlKey: 'BharatVC Link', idKey: 'BharatVC Meeting ID', passKey: 'BharatVC PWD' }
      ],
      extras: [
        { label: 'Reader', key: 'Name Of Reader' },
        { label: 'Contact', key: 'Contact Number' }
      ]
    },
    {
      id: 'panchkula', short: 'Panchkula', name: 'Panchkula District Courts',
      region: 'Haryana', icon: 'gavel', sheetTab: 'Panchkula',
      nameKey: "Name Of Judicial Officer's", filterEmpty: 'GOOGLE MEET Link',
      platforms: [{ label: 'Google Meet', kind: 'meet', urlKey: 'GOOGLE MEET Link' }],
      extras: [
        { label: 'VC Coordinator', key: 'VC Coordinator Name' },
        { label: 'Coordinator Contact', key: 'VC Coordinator Contact' },
        { label: 'Coordinator Email', key: 'VC Coordinator Email ID' },
        { label: 'Naib Court', key: 'Naib Court Name' },
        { label: 'Naib Court Contact', key: 'Naib Court Contact' }
      ]
    },
    {
      id: 'high-court', short: 'High Court', name: 'Punjab & Haryana High Court',
      region: 'Chandigarh', icon: 'pillars', sheetTab: 'highcourt',
      nameKey: "Hon'ble Judge Name", filterEmpty: "Hon'ble Judge Name",
      platforms: [{ label: 'Zoom', kind: 'zoom', urlKey: 'VC Link For ZOOM', idKey: 'Meeting ID' }],
      extras: [
        { label: 'Court Room', key: 'Court Room NO' },
        { label: 'Roster', key: 'ROSTER Detail' },
        { label: 'Not Holding Court', key: 'Judges Not Holding Court' },
        { label: 'Distribution Court', key: 'Distribution Court NO' }
      ]
    },
    {
      id: 'punjab-consumer', short: 'Punjab Consumer', name: 'Punjab State Consumer Commission',
      region: 'Punjab', icon: 'shield', sheetTab: 'Punjab Consumer',
      nameKey: 'Name of Court', filterEmpty: 'Name of Court',
      platforms: [{
        label: 'Cisco WebEx', kind: 'webex',
        urlKey: 'VC Link ( Cisco WebX Meeting )', passKey: 'Password ( If Required )'
      }]
    },
    {
      id: 'chd-consumer', short: 'Chandigarh Consumer', name: 'Chandigarh Consumer Commission',
      region: 'U.T.', icon: 'shield', sheetTab: 'Chandigarh Consumer',
      nameKey: 'Name of Court', filterEmpty: 'Name of Court',
      platforms: [{
        label: 'WebEx / Meet', kind: 'webex',
        urlKey: 'VC Link (WebEx / Google Meet)', idKey: 'Meeting ID', passKey: 'Password (If Required)'
      }]
    },
    {
      id: 'rera-punjab', short: 'RERA Punjab', name: 'RERA Punjab',
      region: 'Punjab', icon: 'doc', sheetTab: 'Rera Punjab',
      nameKey: 'Name of Court', filterEmpty: 'Name of Court',
      platforms: [{
        label: 'Cisco WebEx', kind: 'webex',
        urlKey: 'VC Link ( Cisco WebX Meeting )', idKey: 'Meeting ID', passKey: 'Password ( If Required )'
      }]
    },
    {
      id: 'haryana-consumer', short: 'Haryana Consumer', name: 'Haryana Consumer Commission',
      region: 'Haryana', icon: 'shield', sheetTab: 'Haryana Consumer',
      nameKey: 'Name of Court', filterEmpty: 'Name of Court',
      platforms: [{
        label: 'Cisco WebEx', kind: 'webex',
        urlKey: 'VC Link ( Cisco WebX Meeting )', passKey: 'Password ( If Required )'
      }]
    }
  ];

  /* ---------- normalisation ---------- */
  function clean(v) { return (v == null ? '' : String(v)).trim(); }
  function isHttp(v) { return /^https?:\/\//i.test(v); }

  function mapRows(court, raw) {
    var fe = court.filterEmpty;
    return raw
      .filter(function (r) { return clean(r[fe]) !== ''; })
      .map(function (r) {
        var platforms = (court.platforms || []).map(function (p) {
          var rawUrl = clean(r[p.urlKey]);
          var url = isHttp(rawUrl) ? rawUrl : '';
          var codes = [];
          // A non-URL value in the link column is a dial-in / meeting number
          // (Cisco WebEx tabs store a numeric meeting ID here, not a link).
          if (!url && rawUrl) codes.push({ lbl: 'Meeting No.', val: rawUrl });
          if (p.idKey) { var id = clean(r[p.idKey]); if (id) codes.push({ lbl: 'Meeting ID', val: id }); }
          if (p.passKey) { var pw = clean(r[p.passKey]); if (pw) codes.push({ lbl: 'Passcode', val: pw }); }
          return { label: p.label, kind: p.kind, url: url, codes: codes };
        }).filter(function (p) { return p.url || p.codes.length; });

        var extras = (court.extras || []).map(function (e) {
          return { label: e.label, val: clean(r[e.key]) };
        }).filter(function (e) { return e.val && e.val !== '-'; });

        var name = clean(r[court.nameKey]) || clean(r[fe]) || 'Untitled';
        var search = (name + ' ' + extras.map(function (e) { return e.val; }).join(' ')).toLowerCase();
        return { name: name, platforms: platforms, extras: extras, search: search };
      });
  }

  /* ---------- public API ---------- */
  window.COURTS = COURTS;
  window.CVC = {
    byId: function (id) { return COURTS.find(function (c) { return c.id === id; }); },
    court: async function (court, force) {
      var raw = await fetchRaw(court.sheetTab, force);
      return mapRows(court, raw);
    }
  };
})();
