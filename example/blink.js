const style = require('node:util').styleText;
const networkInterfaces = require('node:os').networkInterfaces;

const LXIP1 = require('../index.js').LXIP1;
const Discovery = require('../index.js').Discovery;

const HOST = ''; // hostname or IP of IP1 device, can also set this after discovery
const USERNAME = ''; // username used to log in to web interface
const PASSWORD = ''; // password used to log in to web interface
const DATAPOINT_TO_BLINK_NAME = ''; // datapoint to toggle once per 5 seconds

const getLocalAddress = () => {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.internal) {
        continue;
      }

      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family != familyV4Value) {
        continue;
      }

      return net.address;
    }
  }
}

const localAddress = getLocalAddress();
console.log('Using local address', style('green', localAddress));

discovery = new Discovery({
  advertiseAddress: getLocalAddress()
});

lxip1 = new LXIP1({
  host: HOST,
  username: USERNAME,
  password: PASSWORD,
});

discovery.on('error', (error) => {
  console.error(error);
  discovery.stop();
});

discovery.on('device', (device) => {
  console.log('Discovered device:', style('green', device.deviceInfo.friendlyName), 'on', style('green', device.hpai.ipAddress));
  lxip1.host = device.hpai.ipAddress;

  discovery.stop();

  console.log('Requesting device info from', style('green', lxip1.host) + '...');
  lxip1.getDeviceInfo();
});

console.log('Discovering KNXnet/IP devices on local network...');
discovery.discover();

lxip1.on('error', (error) => {
  console.error(error);
});

lxip1.on('deviceInfo', (deviceInfo) => {
  console.log('Device', style('green', deviceInfo.name), 'build', style('green', deviceInfo.build_version));
  
  console.log('Starting session on', style('green', lxip1.host), 'as user', style('green', lxip1.username) + '...');
  lxip1.login();
});

lxip1.on('sessionExpired', () => {
  console.log('Session expired');
});

lxip1.on('sessionRestarted', () => {
  console.log('Session restarted');
});

lxip1.on('sessionStarted', () => {
  console.log('Session started');

  console.log('Requesting server items...');
  lxip1.getServerItems();
});

lxip1.on('serverItem', (serverItem) => {
  console.log('Server item', serverItem.id, style('green', serverItem.name) + ':', serverItem.value);
});

lxip1.on('serverItems', (serverItems) => {
  console.log('Received', serverItems.length, 'server items');

  console.log('Requesting datapoint descriptions...');
  lxip1.getDatapointDescriptions();
});

lxip1.on('datapoints', (datapoints) => {
  console.log('Received', datapoints.length, 'datapoint descriptions');

  console.log('Requesting datapoint values...');
  lxip1.getDatapointValues();

  console.log('Starting WebSocket connection...');
  lxip1.startWebsocket();
});

lxip1.on('webSocketConnected', () => {
  console.log('WebSocket connected');
});

lxip1.on('webSocketDisconnected', (disconnect) => {
  console.log('WebSocket disconnected:', style('green', disconnect.description));
});

const blinkDatapoint = () => {
  const datapoint = lxip1.getDatapointByName(DATAPOINT_TO_BLINK_NAME);
  console.log('Turning', style('green', !datapoint.value ? 'on' : 'off'), 'datapoint', style('green', datapoint.name));
  datapoint.setValue(!datapoint.value);
};

lxip1.on('datapoint', (datapoint) => {
  datapoint.on('valueChanged', () => {
    console.log('Received new value for datapoint', datapoint.id, style('green', datapoint.name) + ':', datapoint.value);
  });

  if (datapoint.name == DATAPOINT_TO_BLINK_NAME) {
    setInterval(() => blinkDatapoint(), 5000);
  }
});
