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
      "defaultTemperature": 60,
      "name": "Smart Kettle"
    }
  ]
}
```
