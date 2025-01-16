const EventEmitter = require('node:events');

class Datapoint extends EventEmitter {
  constructor(description, lxip1) {
    super();

    this.lxip1 = lxip1;

    this.id = description.id;
    this.name = description.name;
    this.type = description.datapoint_type;
    this.flags = description.flags;
    this.size = description.size;

    this.format = null;
    this.state = null;
    this.value = null;
  }

  valueChanged(values) {
    this.format = values.Format;
    this.state = values.state;
    this.value = values.value;

    this.emit('valueChanged', this);
  }

  setValue(value) {
    this.value = value;
    this.lxip1.sendDatapointValues(this);
  }
}

module.exports = Datapoint;
