# Connection between my ESP32 board and DFR0954, MAX98357 I2S Amplifier Module

Board -> Amplifier
5V -> VCC
GND -> GND
LRC -> GPIO14 (Pin numbered 14)
BCLK -> GPIO15 (Pin numbered 15)
DIN -> GPIO22 (Pin numbered 22)

auto config = i2sStream.defaultConfig(TX_MODE);
config.pin_bck = 14;
config.pin_ws = 15;
config.pin_data = 22;
i2sStream.begin(config);

# Helpful Links

- https://lilygo.cc/en-ca/products/lora-v1-3?_pos=18&_sid=7d75587ce&_ss=r
