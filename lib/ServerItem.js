class ServerItem {
  constructor(description) {
    this.id = description.id;
    this.name = description.name;
    this.readOnly = description.read_only;
    this.value = description.value;
  }
}

module.exports = ServerItem;
