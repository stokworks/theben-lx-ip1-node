const EventEmitter = require('node:events');

const WebSocketClient = require('websocket').client;

const Datapoint = require('./Datapoint');
const ServerItem = require('./ServerItem');
const Connection = require('./Connection');

class LXIP1 extends EventEmitter {
  constructor (options) {
    super();

    this.host = options.host;
    this.username = options.username;
    this.password = options.password;

    this.session = null;
    this.serverItems = {};
    this.datapoints = {};
    this.serverItemNames = {};
    this.datapointNames = {};

    this.websocketClient = null;
    this.webSocketConnection = null;
  }

  startWebsocket(isRetry = false) {
    if (this.webSocketClient) {
      this.webSocketClient.removeAllListeners();
    }

    this.websocketClient = new WebSocketClient();

    this.websocketClient.on('connect', (webSocketConnection) => {
      this.handleWebSocketConnection(webSocketConnection)
    });

    this.websocketClient.on('connectFailed', (errorDescription) => {
      this.emit('error', errorDescription);
    });

    this.websocketClient.on('httpResponse', (httpResponse) => {
      if (isRetry) {
        return this.handleRequestError(httpResponse.statusCode, null);
      } else {
        return this.handleRequestError(httpResponse.statusCode, null, () => {
          this.startWebsocket(true);
        });
      }
    });

    Connection.connectWebSocket(this.websocketClient, this.host, this.session);
  }

  stopWebsocket() {
    if (this.webSocketConnection) {
      this.webSocketConnection.removeAllListeners();
      this.webSocketConnection.close();
    }
  }

  handleWebSocketConnection(webSocketConnection) {
    if (this.webSocketConnection) {
      this.webSocketConnection.removeAllListeners();
      this.webSocketConnection.close();
    }

    this.webSocketConnection = webSocketConnection;

    this.webSocketConnection.on('message', (message) => {
      this.handleWebSocketMessage(message);
    });

    this.webSocketConnection.on('error', (error) => {
      this.emit('error', error);
    });

    this.webSocketConnection.on('close', (reasonCode, description) => {
      this.emit('webSocketDisconnected', {
        reasonCode: reasonCode,
        description: description
      });

      this.startWebsocket();
    });

    this.emit('webSocketConnected');
  }

  handleWebSocketMessage(message) {
    if (message.type != 'utf8') {
      this.emit('error', 'Received unexpected WebSocket message type ' + message.type);
      return;
    }

    this.parseDatapointIndications(JSON.parse(message.utf8Data).indications);
  }

  handleRequestError(error, data, retryCallback) {
    if (error == 401) {
      this.emit('error', 'incorrect credentials');
    } else if (error == 403) {
      if (retryCallback) {
        this.emit('sessionExpired');
        this.login(() => {
          this.emit('sessionRestarted');
          retryCallback();
        });
      } else {
        this.emit('error', 'session expired');
      }
    } else {
      this.emit('error', error);
    }
  }

  getDeviceInfo() {
    Connection.getDeviceInfo(this.host, null, (error, data) => {
      if (error) {
        return this.handleRequestError(error, data);
      }

      this.emit('deviceInfo', JSON.parse(data).device);
    });
  }

  login(callback) {
    Connection.postLogin(this.host, this.username, this.password, (error, data) => {
      if (error) {
        return this.handleRequestError(error, data);
      }

      const isRetry = this.session != null;

      this.session = data;

      if (!isRetry) {
        this.emit('sessionStarted');
      }

      if (callback) {
        callback();
      }
    });
  }

  getServerItems(isRetry = false) {
    Connection.getServerItems(this.host, this.session, (error, data) => {
      if (error) {
        if (isRetry) {
          return this.handleRequestError(error, data);
        } else {
          return this.handleRequestError(error, data, () => {
            this.getServerItems(true);
          });
        }
      }

      const serverItems = JSON.parse(data).serveritems_values;
      this.parseServerItems(serverItems);
    });
  }

  parseServerItems(serverItems) {
    for (const description of serverItems) {
      const serverItem = new ServerItem(description);
      this.serverItems[serverItem.id] = serverItem;
      this.serverItemNames[serverItem.name] = serverItem;
    }

    this.emit('serverItems', Object.values(this.serverItems));

    for (const serverItem of Object.values(this.serverItems)) {
      this.emit('serverItem', serverItem);
      this.emit('serverItem' + serverItem.name, serverItem);
    }
  }

  getServerItemById(serverItemId) {
    return this.serverItems[serverItemId];
  }

  getServerItemByName(serverItemName) {
    return this.serverItemNames[serverItemName];
  }

  getDatapointDescriptions(isRetry = false) {
    Connection.getDatapointsDescriptions(this.host, this.session, (error, data) => {
      if (error) {
        if (isRetry) {
          return this.handleRequestError(error, data);
        } else {
          return this.handleRequestError(error, data, () => {
            this.getDatapointDescriptions(true);
          });
        }
      }

      const datapointDescriptions = JSON.parse(data).datapoints_descriptions;
      this.parseDatapointDescriptions(datapointDescriptions);
    });
  }

  parseDatapointDescriptions(datapointDescriptions) {
    for (const description of datapointDescriptions) {
      const datapoint = new Datapoint(description, this);
      this.datapoints[datapoint.id] = datapoint;
      this.datapointNames[datapoint.name] = datapoint;
    }

    this.emit('datapoints', Object.values(this.datapoints));

    for (const datapoint of Object.values(this.datapoints)) {
      this.emit('datapoint', datapoint);
    }
  }

  getDatapointById(datapointId) {
    return this.datapoints[datapointId];
  }

  getDatapointByName(datapointName) {
    return this.datapointNames[datapointName];
  }

  getDatapointValues(isRetry = false) {
    Connection.getDatapointsValues(this.host, this.session, (error, data) => {
      if (error) {
        if (isRetry) {
          return this.handleRequestError(error, data);
        } else {
          return this.handleRequestError(error, data, () => {
            this.datapointsValues(true);
          });
        }
      }

      const datapointValues = JSON.parse(data).datapoints_values;
      this.parseDatapointValues(datapointValues);
    });
  }

  parseDatapointValues(datapointValues) {
    for (const value of datapointValues) {
      if (!Object.hasOwn(this.datapoints, value.id)) {
        this.emit('error', 'Received value for unknown datapoint id ' + value.id);
        return;
      }

      this.datapoints[value.id].valueChanged(value);
    }
  }

  parseDatapointIndications(datapointIndications) {
    if (datapointIndications.type != 'datapoint_ind') {
      this.emit('error', 'Received unexpected datapoint indications type ' + datapointIndications.type);
      return;
    }

    this.parseDatapointValues(datapointIndications.values);
  }

  sendDatapointValues(datapoint, isRetry = false) {
    Connection.putDatapointsValues(this.host, this.session, datapoint.id, datapoint.value, (error, data) => {
      if (error) {
        if (isRetry) {
          return this.handleRequestError(error, data);
        } else {
          return this.handleRequestError(error, data, () => {
            this.sendDatapointValues(datapoint, true);
          });
        }
      }
    });
  }
}

module.exports = LXIP1;
