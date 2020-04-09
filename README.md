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
| Attribute | Optional | Description |
| ------------ | ------------ | ------------ |
| heat | yes | Heat power, 1-99 |
| time | yes | Duration, minutes 1-240 |
| sound | yes | ON/OFF sounds |
