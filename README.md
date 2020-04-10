<span align="center">

# Xiaomi Multipurpose Kettle

[![npm downloads](https://badgen.net/npm/dt/homebridge-multipurpose-kettle)](https://www.npmjs.com/package/homebridge-multipurpose-kettle)
[![npm version](https://badgen.net/npm/v/homebridge-multipurpose-kettle)](https://www.npmjs.com/package/homebridge-multipurpose-kettle)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/ch3rn1k/homebridge-multipurpose-kettle.svg)](https://github.com/ch3rn1k/homebridge-multipurpose-kettle/pulls)
[![GitHub issues](https://img.shields.io/github/issues/ch3rn1k/homebridge-multipurpose-kettle.svg)](https://github.com/ch3rn1k/homebridge-multipurpose-kettle/issues)

</span>

[Homebridge](https://github.com/homebridge/homebridge) plugin for Xiaomi Multipurpose Kettle device. System name of this device is `viomi.health_pot.v1`.
<img src="https://i.imgur.com/WnLsZ2c.jpg" alt="Xiaomi Multipurpose Kettle" height="240">

### Installation

1. Install homebring by following the step-by-step instructions on the [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki).
2. Install [miIO](https://github.com/aholstenson/miio/blob/master/README.md) and homebridge-multipurpose-kettle with the following command.

```bash
npm install -g miio homebridge-multipurpose-kettle
```

### Configuration

1. Use [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x) to configure the plugin, or update your configuration file manually. See [configuration](#example-config) for a sample to add to your config.json file.

### Example config

```json
{
  "accessories": [
    {
      "accessory": "MiMultipurposeKettle",
      "ip": "192.168.x.xx",
      "token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "name": "Smart Kettle"
    }
  ]
}
```

### Example config with custom propetries

```json
{
  "accessories": [
    {
      "accessory": "MiMultipurposeKettle",
      "ip": "192.168.x.xx",
      "token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "name": "Smart Kettle",
      "heat": 60,
      "time": 5,
      "sound": true
    }
  ]
}
```

#### Attributes

| Attribute | Optional | Type                 | Description         |
| --------- | -------- | -------------------- | ------------------- |
| `heat`    | yes      | Number (1-99)        | Heat power          |
| `time`    | yes      | Number (1-240)       | Duration in minutes |
| `sound`   | yes      | Boolean (true/false) | Sound feature       |
