const style = require('node:util').styleText;

const LXIP1 = require('../index.js').LXIP1;

const HOST = ''; // hostname or IP of IP1 device
const USERNAME = ''; // username used to log in to web interface
const PASSWORD = ''; // password used to log in to web interface
const DATAPOINT_TO_BLINK_NAME = ''; // datapoint to toggle once per 5 seconds

lxip1 = new LXIP1({
  host: HOST,
  username: USERNAME,
  password: PASSWORD,
});

const blinkDatapoint = () => {
  const datapoint = lxip1.getDatapointByName(DATAPOINT_TO_BLINK_NAME);
  console.log('Turning', style('green', !datapoint.value ? 'on' : 'off'), 'datapoint', style('green', datapoint.name));
  datapoint.setValue(!datapoint.value);
};

lxip1.on('error', (error) => {
  console.error(error);
});

lxip1.on('deviceInfo', (deviceInfo) => {
  console.log('Device', style('green', deviceInfo.name), 'build', style('green', deviceInfo.build_version));
  
  console.log('Starting session on', style('green', HOST), 'as user', style('green', USERNAME) + '...');
  lxip1.login();
});

lxip1.on('sessionStarted', () => {
  console.log('Session started');

  console.log('Requesting server items...');
  lxip1.getServerItems();
});

lxip1.on('sessionExpired', () => {
  console.log('Session expired');
});

lxip1.on('sessionRestarted', () => {
  console.log('Session restarted');
});

lxip1.on('webSocketConnected', () => {
  console.log('WebSocket connected');
});

lxip1.on('webSocketDisconnected', (disconnect) => {
  console.log('WebSocket disconnected:', style('green', disconnect.description));
});

lxip1.on('serverItems', (serverItems) => {
  console.log('Received', serverItems.length, 'server items');

  console.log('Requesting datapoint descriptions...');
  lxip1.getDatapointDescriptions();
});

lxip1.on('serverItem', (serverItem) => {
  console.log('Server item', serverItem.id, style('green', serverItem.name) + ':', serverItem.value);
});

lxip1.on('datapoints', (datapoints) => {
  console.log('Received', datapoints.length, 'datapoint descriptions');

  console.log('Requesting datapoint values...');
  lxip1.getDatapointValues();

  console.log('Starting WebSocket connection...');
  lxip1.startWebsocket();
});

lxip1.on('datapoint', (datapoint) => {
  datapoint.on('valueChanged', () => {
    console.log('Received new value for datapoint', datapoint.id, style('green', datapoint.name) + ':', datapoint.value);
  });

  if (datapoint.name == DATAPOINT_TO_BLINK_NAME) {
    setInterval(() => blinkDatapoint(), 5000);
  }
});

console.log('Requesting device info from', style('green', HOST) + '...');
lxip1.getDeviceInfo();
