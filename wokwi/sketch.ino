// Smart Road Hazard Detection System — ESP32 + HC-SR04 + SSD1306 OLED
// Author: Krish Potanwar | Ramdeobaba University, Nagpur

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>

// OLED configuration
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define OLED_ADDRESS  0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// HC-SR04 pins
#define TRIG_PIN 5
#define ECHO_PIN 18

// LED pins
#define RED_LED_PIN    15
#define YELLOW_LED_PIN  2
#define BLUE_LED_PIN    4

// Calibration
#define CALIBRATION_SAMPLES  10
#define READING_INTERVAL_MS 500
#define COOLDOWN_MS        3000

// Hazard thresholds (cm delta from baseline)
#define DEEP_THRESHOLD        25
#define MEDIUM_THRESHOLD      15
#define SHALLOW_THRESHOLD      5
#define SPEEDBREAKER_THRESHOLD -5

// WiFi — Wokwi's free built-in open network (no password needed)
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
#define WIFI_CHANNEL 6

// Render server URL — replace YOUR-RENDER-APP after deployment
// See DEPLOYMENT.md for instructions (render.com, free, no credit card)
const char* SERVER_URL  = "https://YOUR-RENDER-APP.onrender.com/api/hazards";

// Firebase Realtime Database — REST API (no library needed)
// Rules are open (.read/.write = true) so no auth token required for demo
// NOTE: Firebase API key is safe to commit for demo projects.
// Access is controlled by Firebase Security Rules.
// For production: change rules to require authentication.
#define FIREBASE_HOST "smartroadhazard-default-rtdb.firebaseio.com"

// State
float baseline = 20.0;
unsigned long lastDetectionTime = 0;
bool calibrated = false;

// ── WiFi ─────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi failed — serial-only mode");
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────
// POST a hazard detection to the Koyeb cloud server
// lat/lng are 0.0 — browser will stamp real GPS coordinates via Firebase
void postDetection(String type, String severity) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  String body;
  if (severity == "") {
    body = "{\"type\":\"" + type + "\",\"severity\":null,\"lat\":0.0,\"lng\":0.0}";
  } else {
    body = "{\"type\":\"" + type + "\",\"severity\":\"" + severity + "\",\"lat\":0.0,\"lng\":0.0}";
  }
  int code = http.POST(body);
  Serial.println("Koyeb POST → HTTP " + String(code));
  http.end();
}

// ── Firebase REST API ─────────────────────────────────────────────
// PUT a pending hazard to Firebase RTDB — no GPS coordinates.
// The browser (map.js) watches /pending_hazards, stamps its real GPS,
// writes to /hazards, then deletes the pending entry.
void pushPendingHazard(String type, String severity) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  // Use millis() as unique key under /pending_hazards/
  String url = "https://" + String(FIREBASE_HOST) + "/pending_hazards/" + String(millis()) + ".json";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  String sevField = (severity == "") ? "null" : ("\"" + severity + "\"");
  String body = "{\"type\":\"" + type + "\","
                "\"severity\":" + sevField + ","
                "\"timestamp\":" + String(millis() / 1000) + ","
                "\"status\":\"pending\"}";
  int code = http.PUT(body);
  Serial.println("Firebase PUT → HTTP " + String(code));
  http.end();
}

// ── Sensor ───────────────────────────────────────────────────────
// Trigger HC-SR04 and return distance in cm
float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);
  return duration * 0.034 / 2.0;
}

// ── LEDs ─────────────────────────────────────────────────────────
void blinkLED(int pin, int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH); delay(100);
    digitalWrite(pin, LOW);  delay(100);
  }
}

void allLEDsOff() {
  digitalWrite(RED_LED_PIN,    LOW);
  digitalWrite(YELLOW_LED_PIN, LOW);
  digitalWrite(BLUE_LED_PIN,   LOW);
}

// ── OLED ─────────────────────────────────────────────────────────
void updateOLED(String line1, String line2, String line3, String line4) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,  0); display.println(line1);
  display.setCursor(0, 16); display.println(line2);
  display.setCursor(0, 32); display.println(line3);
  display.setCursor(0, 48); display.println(line4);
  display.display();
}

// ── Calibration ──────────────────────────────────────────────────
// Average 10 readings to set the "normal road" baseline distance
void calibrate() {
  Serial.println("Calibrating...");
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Calibrating...");
  display.println("Keep sensor over");
  display.println("flat road surface");
  display.display();

  float total = 0.0;
  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    total += measureDistance();
    delay(200);
  }
  baseline = total / CALIBRATION_SAMPLES;

  Serial.print("Ready! Baseline: ");
  Serial.print(baseline, 1);
  Serial.println("cm");

  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Ready!");
  display.print("Baseline: ");
  display.print(baseline, 1);
  display.println(" cm");
  display.display();
  delay(1500);
  calibrated = true;
}

// ── Setup ─────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("Smart Road Hazard Detection System");
  Serial.println("===================================");

  connectWiFi();

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RED_LED_PIN,    OUTPUT);
  pinMode(YELLOW_LED_PIN, OUTPUT);
  pinMode(BLUE_LED_PIN,   OUTPUT);
  allLEDsOff();

  Wire.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("ERROR: SSD1306 OLED not found.");
    while (true);
  }

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
  delay(2000);

  calibrate();
}

// ── Loop ──────────────────────────────────────────────────────────
void loop() {
  if (!calibrated) return;

  float currentDistance = measureDistance();
  float delta = currentDistance - baseline;

  unsigned long now = millis();
  bool inCooldown = (now - lastDetectionTime) < COOLDOWN_MS;

  if (delta > DEEP_THRESHOLD && !inCooldown) {
    // Browser will stamp real GPS — ESP32 just reports type + severity
    Serial.println("POTHOLE,DEEP");
    blinkLED(RED_LED_PIN, 3);
    allLEDsOff();
    updateOLED("POTHOLE", "SEVERITY: DEEP",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: +" + String(delta, 1) + "cm");
    postDetection("pothole", "deep");       // Koyeb (lat=0, browser adds GPS)
    pushPendingHazard("pothole", "deep");   // Firebase (browser stamps GPS)
    lastDetectionTime = now;

  } else if (delta > MEDIUM_THRESHOLD && !inCooldown) {
    Serial.println("POTHOLE,MEDIUM");
    blinkLED(YELLOW_LED_PIN, 2);
    allLEDsOff();
    updateOLED("POTHOLE", "SEVERITY: MEDIUM",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: +" + String(delta, 1) + "cm");
    postDetection("pothole", "medium");
    pushPendingHazard("pothole", "medium");
    lastDetectionTime = now;

  } else if (delta > SHALLOW_THRESHOLD && !inCooldown) {
    Serial.println("POTHOLE,SHALLOW");
    blinkLED(YELLOW_LED_PIN, 2);
    allLEDsOff();
    updateOLED("POTHOLE", "SEVERITY: SHALLOW",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: +" + String(delta, 1) + "cm");
    postDetection("pothole", "shallow");
    pushPendingHazard("pothole", "shallow");
    lastDetectionTime = now;

  } else if (delta < SPEEDBREAKER_THRESHOLD && !inCooldown) {
    Serial.println("SPEEDBREAKER");
    blinkLED(BLUE_LED_PIN, 2);
    allLEDsOff();
    updateOLED("SPEEDBREAKER", "RAISED SURFACE",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: " + String(delta, 1) + "cm");
    postDetection("speedbreaker", "");
    pushPendingHazard("speedbreaker", "");
    lastDetectionTime = now;

  } else {
    Serial.println("NORMAL");
    allLEDsOff();
    updateOLED("NORMAL", "Road OK",
               "Dist: " + String(currentDistance, 1) + "cm",
               "Delta: " + String(delta, 1) + "cm");
  }

  delay(READING_INTERVAL_MS);
}
