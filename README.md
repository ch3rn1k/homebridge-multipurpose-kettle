<span align="center">

# Xiaomi Multipurpose Kettle

[![npm downloads](https://badgen.net/npm/dt/homebridge-multipurpose-kettle)](https://www.npmjs.com/package/homebridge-multipurpose-kettle)
[![npm version](https://badgen.net/npm/v/homebridge-multipurpose-kettle)](https://www.npmjs.com/package/homebridge-multipurpose-kettle)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/ch3rn1k/homebridge-multipurpose-kettle.svg)](https://github.com/ch3rn1k/homebridge-multipurpose-kettle/pulls)
[![GitHub issues](https://img.shields.io/github/issues/ch3rn1k/homebridge-multipurpose-kettle.svg)](https://github.com/ch3rn1k/homebridge-multipurpose-kettle/issues)

</span>

[Homebridge](https://github.com/homebridge/homebridge) plugin for the Xiaomi Multipurpose Kettle. System name of this device is `viomi.health_pot.v1`.
<img src="https://i.imgur.com/WnLsZ2c.jpg" alt="Xiaomi Multipurpose Kettle" height="240">

### Installation

1. Install homebring by following the step-by-step instructions on the [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki).
2. Install [miIO](https://github.com/aholstenson/miio/blob/master/README.md) and homebridge-multipurpose-kettle with the following command.

```bash
npm install -g miio homebridge-multipurpose-kettle
```

### Configuration

1. Use [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x) to configure the plugin, or update your configuration file manually. See [configuration](#example-config) for a sample to add to your config.json file.

### How to use

From **v2.0** there are 2 working mods - `Switch` and `Thermostat`. You can choose the one you prefer. `Switch` is easy way to use the plugin, like setting default heat value and then using Kettle by the switch. `Thermostat` is a little bit harder way, but in it you can control heat value directly from your phone and using Siri commands like 'Set Kettle to 40C'. **Attention!** Plugin uses celsius metric system!

### Example config

```json
{
  "accessories": [
    {
      "accessory": "MiMultipurposeKettle",
      "ip": "192.168.8.12",
      "token": "ef70b026cd06dfea54e57c80f40992d6",
      "mode": "switch",
      "heat": 60,
      "name": "Smart Kettle"
    }
  ]
}
```

### Example config with properties

```json
{
  "accessories": [
    {
      "accessory": "MiMultipurposeKettle",
      "ip": "192.168.8.12",
      "token": "ef70b026cd06dfea54e57c80f40992d6",
      "mode": "switch",
      "heat": 60,
      "name": "Smart Kettle",
      "sound": true,
      "temperature": false,
      "sensor": false,
      "interval": 5,
      "debug": false
    }
  ]
}
```

#### Attributes

| Attribute     | Required | Type                          | Description                                        |
| ------------- | -------- | ----------------------------- | -------------------------------------------------- |
| `accessory`   | yes      | String (MiMultipurposeKettle) | System name of the accessory                       |
| `ip`          | yes      | String (192.168.X.XX)         | IP adress of the device                            |
| `token`       | yes      | String (SoMePrEtTyToKeN)      | Token of the device                                |
| `mode`        | yes      | String (switch/thermostat)    | Working mode of the plugin                         |
| `heat`        | yes      | Number (1-99)                 | Heat power                                         |
| `name`        | no       | String (Smart Kettle)         | Name of the device                                 |
| `sound`       | no       | Boolean (true/false)          | Sounds of interaction                              |
| `temperature` | no       | Boolean (true/false)          | Show temperature of water (only for "switch" mode) |
| `sensor`      | no       | Boolean (true/false)          | Show occupancy sensor                              |
| `interval`    | no       | Number (1-100)                | Update interval in working mode                    |
| `debug`       | no       | Boolean (true/false)          | Custom debug mode in console                       |
