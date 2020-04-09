# Xiaomi Multipurpose Kettle

Plugin for [Homebridge](https://github.com/nfarina/homebridge) for Xiaomi Multipurpose Kettle device. System name of this device is `viomi.health_pot.v1`.
![Xiaomi Multipurpose Kettle](https://i.imgur.com/WnLsZ2c.jpg "Xiaomi Multipurpose Kettle")

### Installation

Install [`homebridge`](https://github.com/homebridge/homebridge/blob/master/README.md#installation).

```bash
npm install -g --unsafe-perm homebridge
``` 

Install [`miio`](https://github.com/aholstenson/miio/blob/master/README.md) and the plugin package.

```bash
npm install -g miio homebridge-multipurpose-kettle
```

Add the [configuration](#example-config) into the `config.json` file.

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
      "heat": 60,
      "time": 5,
      "sound": true,
      "name": "Smart Kettle"
    }
  ]
}
```

#### Attributes
| Attribute | Optional | Type | Description |
| ------------ | ------------ | ------------ | ------------ |
| `heat` | yes | Number (1-99) | Heat power |
| `time` | yes | Number (1-240) | Duration in minutes |
| `sound` | yes | Boolean (true/false) | Sound feature |
