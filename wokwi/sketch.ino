// ============================================================
// Smart Road Hazard Detection System
// ESP32 + HC-SR04 Ultrasonic Sensor + SSD1306 OLED
// Author: Krish Potanwar
// University: Ramdeobaba University, Nagpur
// Purpose: Detects potholes and speedbreakers, classifies
//          severity, and outputs structured CSV over Serial
//          for the Python backend to consume.
// ============================================================

// --- Library Includes ---
#include <Wire.h>            // I2C communication library (needed for OLED)
#include <Adafruit_GFX.h>    // Core graphics library (fonts, shapes) for OLED
#include <Adafruit_SSD1306.h> // Driver library for SSD1306 OLED display
#include <WiFi.h>            // ESP32 WiFi library (built-in, no install needed)
#include <HTTPClient.h>      // ESP32 HTTP client for sending POST requests

// --- WiFi Configuration (Wokwi provides a free simulated WiFi network) ---
// "Wokwi-GUEST" is a built-in open network in all Wokwi simulations — no password needed.
// Channel 6 is required for Wokwi's simulated WiFi to connect reliably.
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
#define WIFI_CHANNEL 6

// --- Railway Server URLs ---
// DEPLOYMENT: After deploying to Railway, replace YOUR-RAILWAY-URL with your actual URL.
// Example: https://smartroadhazard-production.up.railway.app
// Leave as-is for Wokwi Serial-only mode (bridge.py stdin/demo will still work).
const char* RAILWAY_URL = "https://YOUR-RAILWAY-URL.up.railway.app/api/hazards";
const char* VEHICLE_URL = "https://YOUR-RAILWAY-URL.up.railway.app/api/vehicle";

// --- OLED Display Configuration ---
#define SCREEN_WIDTH 128     // OLED display width in pixels
#define SCREEN_HEIGHT 64     // OLED display height in pixels
#define OLED_RESET -1        // Reset pin: -1 means share ESP32 reset (no separate pin needed)
#define OLED_ADDRESS 0x3C    // I2C address of SSD1306 (most common: 0x3C or 0x3D)

// Create the OLED display object using I2C (Wire library)
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// --- HC-SR04 Ultrasonic Sensor Pins ---
#define TRIG_PIN 5           // GPIO 5 → TRIG pin: sends ultrasonic pulse
#define ECHO_PIN 18          // GPIO 18 → ECHO pin: receives reflected pulse

// --- LED Indicator Pins ---
#define RED_LED_PIN    15    // GPIO 15 → Red LED: signals DEEP pothole
#define YELLOW_LED_PIN  2    // GPIO 2  → Yellow LED: signals SHALLOW or MEDIUM pothole
#define BLUE_LED_PIN    4    // GPIO 4  → Blue LED: signals SPEEDBREAKER

// --- Calibration Settings ---
#define CALIBRATION_SAMPLES 10   // Number of readings to average for baseline
#define READING_INTERVAL_MS 500  // Take a new sensor reading every 500ms (2/sec)
#define COOLDOWN_MS 0            // No cooldown — keep printing while slider is held in position
                                 // (Set to 3000 in real deployment to avoid duplicate DB entries)

// --- Threshold Deltas (in cm) ---
// Positive delta = sensor sees MORE distance → there is a pothole (surface dropped)
// Negative delta = sensor sees LESS distance → there is a raised bump (speedbreaker)
#define DEEP_THRESHOLD     25    // > 25cm delta → deep pothole
#define MEDIUM_THRESHOLD   15    // > 15cm delta → medium pothole
#define SHALLOW_THRESHOLD   5    // > 5cm delta  → shallow pothole
#define SPEEDBREAKER_THRESHOLD -5 // < -5cm delta → speedbreaker

// --- GPS Simulation (Nagpur, Maharashtra) ---
// In a real system these would come from a GPS module (e.g., NEO-6M).
// Here we hardcode the base coordinates of Nagpur and add a tiny random
// offset each reading to simulate a vehicle moving along a road.
float baseLat = 21.145800;   // Base latitude:  Sitabuldi area, Nagpur
float baseLng = 79.088200;   // Base longitude: Sitabuldi area, Nagpur

// --- Global State Variables ---
float baseline = 20.0;               // Average distance on flat road (cm), set during calibration
unsigned long lastDetectionTime = 0; // Timestamp (ms) of the last hazard detection
bool calibrated = false;             // Flag: true once baseline calibration is complete

// ============================================================
// FUNCTION: connectWiFi()
// Connects to Wokwi's free simulated WiFi network.
// If connection fails after 20 attempts, falls back to Serial-only mode.
// Serial.println() lines still fire regardless — bridge.py stdin still works.
// ============================================================
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");   // Print dot each 500ms to show progress
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected! IP: " + WiFi.localIP().toString());
  } else {
    // Not fatal — Serial output still works for bridge.py stdin mode
    Serial.println("\nWiFi failed — serial-only mode (bridge.py stdin still works)");
  }
}

// ============================================================
// FUNCTION: postToRailway(type, severity, lat, lng)
// Sends a hazard detection as a JSON POST to the Railway server.
// Only runs if WiFi is connected. Safe to call even if WiFi is down
// (returns immediately without blocking).
// severity = "" for speedbreakers (sends JSON null).
// ============================================================
void postToRailway(String type, String severity, float lat, float lng) {
  // Skip silently if WiFi is not connected — Serial fallback handles it
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(RAILWAY_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);  // 5 second timeout — don't block the loop too long

  // Build the JSON body.
  // severity is null for speedbreakers (Flask API accepts null for that field).
  String body;
  if (severity == "") {
    // Speedbreaker — no severity field
    body = "{\"type\":\"" + type + "\","
         + "\"severity\":null,"
         + "\"lat\":"  + String(lat, 6) + ","
         + "\"lng\":"  + String(lng, 6) + "}";
  } else {
    // Pothole — include severity
    body = "{\"type\":\"" + type + "\","
         + "\"severity\":\"" + severity + "\","
         + "\"lat\":"  + String(lat, 6) + ","
         + "\"lng\":"  + String(lng, 6) + "}";
  }

  int code = http.POST(body);
  // Print HTTP response code so we can verify in Wokwi Serial Monitor
  Serial.println("POST → HTTP " + String(code));
  http.end();
}

// ============================================================
// FUNCTION: postVehiclePosition(lat, lng)
// Sends current GPS coordinates to /api/vehicle so the dashboard
// can show the moving vehicle marker on the Leaflet map.
// ============================================================
void postVehiclePosition(float lat, float lng) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(VEHICLE_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000);  // Shorter timeout — vehicle position is non-critical

  String body = "{\"lat\":" + String(lat, 6)
              + ",\"lng\":" + String(lng, 6)
              + ",\"speed\":30}";
  http.POST(body);  // Fire-and-forget — we don't need the response
  http.end();
}

// ============================================================
// FUNCTION: measureDistance()
// Triggers one HC-SR04 pulse and returns measured distance (cm).
// The HC-SR04 works by:
//   1. Sending a 10-microsecond HIGH pulse on TRIG
//   2. Listening for the ECHO pin to go HIGH (pulse travels to surface and back)
//   3. Time the echo pulse duration; divide by speed of sound factor
// ============================================================
float measureDistance() {
  // Step 1: Clear the TRIG pin to ensure a clean pulse start
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);             // Wait 2 µs for the line to settle

  // Step 2: Send a 10-microsecond HIGH pulse to trigger the sensor
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);            // Pulse must be at least 10 µs long
  digitalWrite(TRIG_PIN, LOW);      // End the trigger pulse

  // Step 3: Measure how long the ECHO pin stays HIGH
  // pulseIn() waits for the pin to go HIGH, then times how long it stays HIGH (in µs)
  long duration = pulseIn(ECHO_PIN, HIGH);

  // Step 4: Convert duration to distance
  // Sound travels at ~0.034 cm/µs in air.
  // Divide by 2 because the pulse travels TO the surface AND BACK (double distance).
  float distance = duration * 0.034 / 2.0;

  return distance; // Return distance in centimetres
}

// ============================================================
// FUNCTION: blinkLED(pin, times)
// Blinks the specified LED 'times' number of times.
// Each blink = 100ms ON + 100ms OFF.
// ============================================================
void blinkLED(int pin, int times) {
  for (int i = 0; i < times; i++) {    // Repeat 'times' times
    digitalWrite(pin, HIGH);           // Turn LED ON
    delay(100);                        // Keep ON for 100 milliseconds
    digitalWrite(pin, LOW);            // Turn LED OFF
    delay(100);                        // Keep OFF for 100 milliseconds
  }
}

// ============================================================
// FUNCTION: allLEDsOff()
// Turns off all three indicator LEDs.
// Called when road is NORMAL (no hazard detected).
// ============================================================
void allLEDsOff() {
  digitalWrite(RED_LED_PIN,    LOW);   // Turn off Red LED
  digitalWrite(YELLOW_LED_PIN, LOW);   // Turn off Yellow LED
  digitalWrite(BLUE_LED_PIN,   LOW);   // Turn off Blue LED
}

// ============================================================
// FUNCTION: updateOLED(line1, line2, line3, line4)
// Clears the OLED screen and displays up to 4 lines of text.
// line1 = hazard type,  line2 = severity
// line3 = raw distance, line4 = delta from baseline
// ============================================================
void updateOLED(String line1, String line2, String line3, String line4) {
  display.clearDisplay();             // Wipe the display buffer

  display.setTextSize(1);             // Use small font (1 = 6x8 pixels per char)
  display.setTextColor(SSD1306_WHITE); // White text on black background

  // Line 1 — Hazard type (e.g., "POTHOLE" or "SPEEDBREAKER")
  display.setCursor(0, 0);           // Move cursor to top-left corner
  display.println(line1);

  // Line 2 — Severity (e.g., "DEEP", "MEDIUM", "SHALLOW", or "---")
  display.setCursor(0, 16);          // Move cursor down 16 pixels
  display.println(line2);

  // Line 3 — Current distance reading in cm
  display.setCursor(0, 32);          // Move cursor down another 16 pixels
  display.println(line3);

  // Line 4 — Delta from baseline (how much road surface changed)
  display.setCursor(0, 48);          // Move cursor to bottom area
  display.println(line4);

  display.display();                 // Push buffer to the physical OLED screen
}

// ============================================================
// FUNCTION: calibrate()
// Takes CALIBRATION_SAMPLES readings and averages them.
// This average becomes the "normal road" baseline distance.
// Called once at startup before the main loop begins.
// ============================================================
void calibrate() {
  Serial.println("Calibrating...");  // Inform the Python bridge that we are calibrating

  // Show calibrating message on OLED
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Calibrating...");
  display.println("Keep sensor over");
  display.println("flat road surface");
  display.display();

  float total = 0.0;                         // Accumulate readings here

  for (int i = 0; i < CALIBRATION_SAMPLES; i++) { // Take 10 readings
    float d = measureDistance();             // Get one distance measurement
    total += d;                              // Add to running total
    delay(200);                              // Short pause between calibration readings
  }

  baseline = total / CALIBRATION_SAMPLES;   // Calculate average distance = baseline

  Serial.print("Ready! Baseline: ");        // Print baseline to Serial for debugging
  Serial.print(baseline, 1);                // Print with 1 decimal place
  Serial.println("cm");

  // Show ready status and baseline on OLED
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Ready!");
  display.print("Baseline: ");
  display.print(baseline, 1);
  display.println(" cm");
  display.display();

  delay(1500);                               // Show the ready message for 1.5 seconds

  calibrated = true;                         // Mark calibration as complete
}

// ============================================================
// FUNCTION: setup()
// Runs once when the ESP32 powers on or resets.
// Initialises all hardware: Serial, pins, OLED, then calibrates.
// ============================================================
void setup() {
  // Initialise Serial communication at 115200 baud
  // The Python bridge.py reads data from this Serial stream
  Serial.begin(115200);
  Serial.println("Smart Road Hazard Detection System");
  Serial.println("===================================");

  // Connect to Wokwi's free simulated WiFi so we can POST to Railway
  // Must be called AFTER Serial.begin() so WiFi status prints are visible
  connectWiFi();

  // Configure HC-SR04 pins
  pinMode(TRIG_PIN, OUTPUT);       // TRIG is an OUTPUT: we send pulses out
  pinMode(ECHO_PIN, INPUT);        // ECHO is an INPUT:  we receive reflected pulses

  // Configure LED pins as outputs
  pinMode(RED_LED_PIN,    OUTPUT); // Red LED output
  pinMode(YELLOW_LED_PIN, OUTPUT); // Yellow LED output
  pinMode(BLUE_LED_PIN,   OUTPUT); // Blue LED output

  // Turn all LEDs off initially (clean state)
  allLEDsOff();

  // Initialise I2C bus (SDA=GPIO21, SCL=GPIO22 are the ESP32 defaults)
  Wire.begin();

  // Initialise the SSD1306 OLED display
  // SSD1306_SWITCHCAPVCC = generate display voltage from 3.3V internally
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    // If OLED init fails, print error and halt execution
    Serial.println("ERROR: SSD1306 OLED not found. Check wiring.");
    while (true); // Infinite loop to stop execution (LED debugging needed)
  }

  // Show startup splash screen on OLED
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Smart Road Hazard");
  display.println("Detection System");
  display.println("----------------");
  display.println("Krish Potanwar");
  display.println("RBU Nagpur");
  display.display();
  delay(2000);                    // Show splash for 2 seconds

  // Perform baseline calibration
  calibrate();

  // Seed the random number generator for GPS offset simulation
  // analogRead(0) gives a floating/noisy voltage → good random seed
  randomSeed(analogRead(0));
}

// ============================================================
// FUNCTION: loop()
// Runs repeatedly after setup() completes.
// Each iteration: reads sensor → classifies → outputs → blinks LED → updates OLED.
// ============================================================
void loop() {
  // Safety check: do not proceed until calibration is complete
  if (!calibrated) {
    return;
  }

  // --- Measure current road surface distance ---
  float currentDistance = measureDistance(); // Distance reading in cm

  // --- Calculate delta from baseline ---
  // Positive delta = road surface dropped (pothole: more space above it)
  // Negative delta = road surface raised (speedbreaker: less space above it)
  float delta = currentDistance - baseline;

  // --- Simulate GPS coordinates ---
  // random(-5, 5) gives an integer between -5 and 4
  // Dividing by 10000.0 gives a tiny float offset (±0.0004 degrees ≈ ±44 metres)
  // This simulates the vehicle moving slightly between detections
  float lat = baseLat + (random(-5, 5) / 10000.0);
  float lng = baseLng + (random(-5, 5) / 10000.0);

  // --- Cooldown Logic ---
  // millis() returns how many milliseconds have passed since the ESP32 booted.
  // If a hazard was recently detected, skip this reading to avoid duplicates.
  unsigned long now = millis();                                  // Current time in ms
  bool inCooldown = (now - lastDetectionTime) < COOLDOWN_MS;    // True if still in 3s cooldown

  // --- Classification and Output ---
  if (delta > DEEP_THRESHOLD && !inCooldown) {
    // DEEP POTHOLE: road dropped more than 25cm below baseline
    Serial.print("POTHOLE,DEEP,");  // Print type and severity prefix
    Serial.print(lat, 6);           // Print latitude with 6 decimal places
    Serial.print(",");
    Serial.println(lng, 6);         // Print longitude with 6 decimal places + newline

    blinkLED(RED_LED_PIN, 3);       // Blink Red LED 3 times for deep pothole
    allLEDsOff();                   // Turn all LEDs off after blinking

    updateOLED("POTHOLE",           // Line 1: hazard type
               "SEVERITY: DEEP",   // Line 2: severity
               "Dist: " + String(currentDistance, 1) + "cm",  // Line 3: raw distance
               "Delta: +" + String(delta, 1) + "cm");         // Line 4: delta

    // Also POST to Railway over WiFi (runs only if WiFi is connected)
    postToRailway("pothole", "deep", lat, lng);
    postVehiclePosition(lat, lng);

    lastDetectionTime = now;        // Record time of this detection (start cooldown)

  } else if (delta > MEDIUM_THRESHOLD && !inCooldown) {
    // MEDIUM POTHOLE: road dropped 15–25cm below baseline
    Serial.print("POTHOLE,MEDIUM,");
    Serial.print(lat, 6);
    Serial.print(",");
    Serial.println(lng, 6);

    blinkLED(YELLOW_LED_PIN, 2);    // Blink Yellow LED 2 times for medium pothole
    allLEDsOff();

    updateOLED("POTHOLE",
               "SEVERITY: MEDIUM",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: +" + String(delta, 1) + "cm");

    // Also POST to Railway over WiFi
    postToRailway("pothole", "medium", lat, lng);
    postVehiclePosition(lat, lng);

    lastDetectionTime = now;

  } else if (delta > SHALLOW_THRESHOLD && !inCooldown) {
    // SHALLOW POTHOLE: road dropped 5–15cm below baseline
    Serial.print("POTHOLE,SHALLOW,");
    Serial.print(lat, 6);
    Serial.print(",");
    Serial.println(lng, 6);

    blinkLED(YELLOW_LED_PIN, 2);    // Blink Yellow LED 2 times for shallow pothole
    allLEDsOff();

    updateOLED("POTHOLE",
               "SEVERITY: SHALLOW",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: +" + String(delta, 1) + "cm");

    // Also POST to Railway over WiFi
    postToRailway("pothole", "shallow", lat, lng);
    postVehiclePosition(lat, lng);

    lastDetectionTime = now;

  } else if (delta < SPEEDBREAKER_THRESHOLD && !inCooldown) {
    // SPEEDBREAKER: surface is raised more than 5cm above baseline
    // Note: speedbreaker has no severity field, so CSV has 3 columns not 4
    Serial.print("SPEEDBREAKER,");
    Serial.print(lat, 6);
    Serial.print(",");
    Serial.println(lng, 6);

    blinkLED(BLUE_LED_PIN, 2);      // Blink Blue LED 2 times for speedbreaker
    allLEDsOff();

    updateOLED("SPEEDBREAKER",
               "RAISED SURFACE",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: " + String(delta, 1) + "cm");  // delta is negative here

    // Also POST to Railway over WiFi (severity="" → JSON null)
    postToRailway("speedbreaker", "", lat, lng);
    postVehiclePosition(lat, lng);

    lastDetectionTime = now;

  } else {
    // NORMAL: surface within ±5cm of baseline — no hazard
    Serial.println("NORMAL");       // Print NORMAL so bridge.py knows a reading occurred

    allLEDsOff();                   // All LEDs off = safe road

    updateOLED("NORMAL",
               "Road OK",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: " + String(delta, 1) + "cm");
  }

  // --- Wait before next reading ---
  // delay(500) = 500 milliseconds = 2 readings per second
  delay(READING_INTERVAL_MS);
}
