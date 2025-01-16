const https = require('node:https');

const headers = function(session) {
  var values = {};

  values['User-Agent'] = 'Theben-LX-IP1-node';

  if (session) {
    values['Cookie'] = 'user=%22' + session + '%22';
  }

  return values;
}

const httpRequest = function(host, method, path, headers, body, callback) {
  const req = https.request({
    host: host,
    method: method,
    path: path,
    rejectUnauthorized: false,
  }, (res) => {
    res.setEncoding('utf8');

    var body = '';

    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      if (res.statusCode == 204) {
        callback();
      } else if (res.statusCode == 200) {
        callback(null, body);
      } else {
        callback(res.statusCode, body);
      }
    });

    res.on('error', (e) => {
      callback(error);
    });
  });

  for (const [key, value] of Object.entries(headers)) {
    req.setHeader(key, value);
  }

  req.end(body);
}

const connectWebSocket = function(webSocketClient, host, session, ) {
  webSocketClient.connect('wss://' + host + '/websocket', [], 'https://' + host, headers(session), {
    rejectUnauthorized: false
  });
}

const getDeviceInfo = function(host, session, callback) {
  return httpRequest(host, 'GET', '/rest/device', headers(session), null, callback);
}

const postLogin = function(host, username, password, callback) {
  const data = JSON.stringify({
    username: username,
    password: password
  });

  return httpRequest(host, 'POST', '/rest/login', headers(), data, callback);
}

const getServerItems = function(host, session, callback) {
  return httpRequest(host, 'GET', '/rest/serveritems/values', headers(session), null, callback);
}

const getDatapointsDescriptions = function(host, session, callback) {
  return httpRequest(host, 'GET', '/rest/datapoints/descriptions', headers(session), null, callback);
}

const getDatapointsValues = function(host, session, callback) {
  return httpRequest(host, 'GET', '/rest/datapoints/values', headers(session), null, callback);
}

const putDatapointsValues = function(host, session, id, value, callback) {
  const data = JSON.stringify({
    command: 3, datapoints_values: [{ id: id, value: value }]
  });

  return httpRequest(host, 'PUT', '/rest/datapoints/values', headers(session), data, callback);
}

module.exports = {
  connectWebSocket: connectWebSocket,
  getDeviceInfo: getDeviceInfo,
  postLogin: postLogin,
  getServerItems: getServerItems,
  getDatapointsDescriptions: getDatapointsDescriptions,
  getDatapointsValues: getDatapointsValues,
  putDatapointsValues: putDatapointsValues
}