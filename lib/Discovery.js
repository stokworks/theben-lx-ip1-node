const Buffer = require('node:buffer').Buffer;
const dgram = require('node:dgram');
const EventEmitter = require('node:events');

const DEVICE_NAME = 'LUXORliving IP1';
const KNXNET_MULTICAST_IP = '224.0.23.12'; // multicast IP for KNXnet/IP discovery
const KNXNET_PORT = 3671;

class Discovery extends EventEmitter {
  constructor(options = {}) {
    super();

    this.listenPort = options.listenPort ?? null;
    this.listenAddress = options.listenAddress ?? null;
    this.advertisePort = options.advertisePort ?? null;
    this.advertiseAddress = options.advertiseAddress ?? null;

    this.socket = dgram.createSocket('udp4');

    this.socket.on('close', () => {
      this.socket.removeAllListeners();
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
    });

    this.socket.on('message', (message, remoteInfo) => {
      this.parseMessage(message, remoteInfo);
    });
  }

  discover(callback) {
    this.socket.bind(this.listenPort, this.listenAddress, () => {
      const bindInfo = this.socket.address();

      this.advertisePort = this.advertisePort ?? bindInfo.port;
      this.advertiseAddress = this.advertiseAddress ?? bindInfo.address;

      if (callback) {
        callback();
      }
      
      this.sendSearchRequest();
    });
  }

  getAddressOctets(ipv4Address) {
    return ipv4Address.split('.').map((octet) => Number.parseInt(octet));
  }

  getAddressString(ipv4Bytes) {
    return ipv4Bytes[0].toString() + '.' + ipv4Bytes[1].toString() + '.' + ipv4Bytes[2].toString() + '.' + ipv4Bytes[3].toString();
  }

  buildSearchRequest() {
    const octets = this.getAddressOctets(this.advertiseAddress);
    const buf = Buffer.alloc(14);

    // HEADER
    // header length: 6 bytes
    buf.writeUInt8(0x06, 0);
    // protocol version: 1.0
    buf.writeUInt8(0x10, 1);
    // service identifier: Search Request
    buf.writeUInt16BE(0x0201, 2);
    // total length: 14 bytes
    buf.writeUInt16BE(0x000e, 4);

    // HPAI
    // structure length: 8 bytes
    buf.writeUInt8(0x08, 6);
    // host protocol: IPv4 UDP
    buf.writeUInt8(0x01, 7);
    // advertised address
    for (var i = 8; i < 12; i++) {
      buf.writeUInt8(octets[i-8], i);
    }
    // advertised port
    buf.writeUInt16BE(this.advertisePort, 12);

    return buf;
  }

  sendSearchRequest() {
    const buf = this.buildSearchRequest();
    const sendSocket = dgram.createSocket('udp4');

    sendSocket.send(buf, KNXNET_PORT, KNXNET_MULTICAST_IP, (error) => {
      if (error) {
        this.emit('error', error);
      }
    });
  }

  parseMessage(message, remoteInfo) {
    var searchResponse = null;

    try {
      searchResponse = this.parseSearchResponse(message);
    } catch (error) {
      console.log(error);
      return;
    }

    if (searchResponse == null) {
      return;
    }

    if (searchResponse.header.serviceIdentifier != 0x0202) {
      return;
    }

    if (searchResponse.deviceInfo.friendlyName != DEVICE_NAME) {
      return;
    }

    this.emit('device', searchResponse);
  }

  parseSearchResponse(buf) {
    const header = this.parseKnxHeader(buf);
    const hpai = this.parseKnxHpai(buf, header.length);
    const deviceInfo = this.parseDeviceInfo(buf, header.length + hpai.structureLength);

    return {
      header: header,
      hpai: hpai,
      deviceInfo: deviceInfo
    }
  }

  parseKnxHeader(buf) {
    return {
      length: buf.readUInt8(0),
      protocolVersion: buf.readUInt8(1),
      serviceIdentifier: buf.readUInt16BE(2),
      totalLength: buf.readUInt16BE(4)
    }
  }

  parseKnxHpai(buf, start) {
    var ipBytes = new Uint8Array(4);
    buf.copy(ipBytes, 0, start + 2);
    const ipAddress = this.getAddressString(ipBytes);

    return {
      structureLength: buf.readUInt8(start + 0),
      hostProtocol: buf.readUInt8(start + 1),
      ipAddress: ipAddress,
      portNumber: buf.readUInt16BE(start + 6)
    }
  }

  parseDeviceInfo(buf, start) {
    const structureLength = buf.readUInt8(start + 0);

    const knxSerialNumber = new Uint8Array(6);
    buf.copy(knxSerialNumber, 0, start + 8);

    const multicastAddressBytes = new Uint8Array(4);
    buf.copy(multicastAddressBytes, 0, start + 14);
    const multicastAddress = this.getAddressString(multicastAddressBytes);

    const macAddress = new Uint8Array(6);
    buf.copy(macAddress, 0, start + 18);

    const friendlyNameEndIndex = buf.indexOf(0x00, start + 24);
    const friendlyName = buf.toString('utf8', start + 24, friendlyNameEndIndex);

    return {
      structureLength: structureLength,
      descriptionType: buf.readUInt8(start + 1),
      knxMedium: buf.readUInt8(start + 2),
      deviceStatus: buf.readUInt8(start + 3),
      knxIndividualAddress: buf.readUInt16BE(start + 4),
      projectInstallationIdentifier: buf.readUInt16BE(start + 6),
      knxSerialNumber: knxSerialNumber,
      multicastAddress: multicastAddress,
      macAddress: macAddress,
      friendlyName: friendlyName
    }
  }

  stop() {
    this.socket.close();
  }
}

module.exports = Discovery;