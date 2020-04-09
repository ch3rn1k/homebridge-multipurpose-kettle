# Xiaomi Multipurpose Kettle

Plugin for [Homebridge](https://github.com/nfarina/homebridge) for Xiaomi Multipurpose Kettle device. System name of this device is `viomi.health_pot.v1`.
![Xiaomi Multipurpose Kettle](https://i.imgur.com/WnLsZ2c.jpg "Xiaomi Multipurpose Kettle")

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
| `heat` | yes | Number(1-99) | Heat power |
| `time` | yes | Number(1-240) | Duration minutes |
| `sound` | yes | Boolean(true/false) | Sound feature |
