# Wokwi Simulation — SmartRoadHazard

## How to Load This Simulation in Wokwi

### Option 1 — Manual (always works)
1. Go to https://wokwi.com/projects/new/esp32
2. Replace `sketch.ino` with contents of `sketch.ino` (Cmd+A, delete, paste)
3. Click the arrow next to sketch.ino → select `diagram.json` → replace with contents of `diagram.json`
4. Click **Library Manager** tab → add:
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
5. Click ▶ to run

### Option 2 — VS Code Extension
1. Install "Wokwi for VS Code" from VS Code marketplace
2. Open this `wokwi/` folder in VS Code
3. Press `F1` → type `Wokwi: Start Simulator`
4. It reads `wokwi.toml`, `sketch.ino`, `diagram.json` automatically

## Circuit Summary

| Component | Pin |
|-----------|-----|
| HC-SR04 TRIG | GPIO 5 |
| HC-SR04 ECHO | GPIO 18 |
| OLED SDA | GPIO 21 |
| OLED SCL | GPIO 22 |
| Red LED | GPIO 15 |
| Yellow LED | GPIO 2 |
| Blue LED | GPIO 4 |

## Slider → Detection Mapping

The HC-SR04 slider controls the simulated distance.
Baseline calibrates to wherever the slider is at startup (~20cm default).

| Slider value | Detection |
|-------------|-----------|
| baseline + 26cm or more | POTHOLE, DEEP |
| baseline + 16cm to 25cm | POTHOLE, MEDIUM |
| baseline + 6cm to 15cm  | POTHOLE, SHALLOW |
| baseline - 6cm or less  | SPEEDBREAKER |
| within ±5cm of baseline | NORMAL |

## Serial Output Format
```
POTHOLE,DEEP,21.145823,79.088156
POTHOLE,MEDIUM,21.146012,79.088445
SPEEDBREAKER,21.145634,79.087923
NORMAL
```
