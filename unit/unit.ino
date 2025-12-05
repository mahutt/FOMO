#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "Task.h"
#include "Buzzer.h"

// Imports for DisplayController SM
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Fonts/FreeSans9pt7b.h>
#include <Fonts/FreeSans12pt7b.h>

// Global constants
const int PIR_PIN = 13;  // GPIO pin connected to PIR sensor output

// Global variables
unsigned char motionDetectedSincePreviousSync;
unsigned char motionDetectedSincePreviousTick;
unsigned long roomId;
String roomName;
unsigned char currentlyReserved;
unsigned char currentlyOpen = 1;
unsigned long currentReservationEnds;
unsigned long nextReservationStarts;
unsigned long currentTime;

// Global task variables
const unsigned char TASKS_SIZE = 4;
task tasks[TASKS_SIZE];
const unsigned char tasksNum = sizeof(tasks) / sizeof(tasks[0]);
const unsigned long tasksPeriodGCD = 100;
const unsigned long periodServerSync = 100;
const unsigned long periodReadOccupancy = 100;
const unsigned long periodNotifyStudent = 200;
const unsigned long periodDisplayController = 500;

task SS_task;
task RO_task;

// ServerSync (SS) SM
enum SS_States {
  SS_SMStart,
  SS_Init,
  SS_WaitWifi,
  SS_SyncStart,
  SS_SyncWait,
  SS_ProcessReservationStatus,
  SS_RequestWait
};

int TickFct_ServerSync(int state) {
  // Local constants
  static const char* rootCa =
    "-----BEGIN CERTIFICATE-----\n"
    "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\n"
    "-----END CERTIFICATE-----\n";
  static const char* ssid = "sfctommy";
  static const char* password = "fomopass";
  static const char* host = "335guy.com";
  static const unsigned short httpsPort = 443;

  // Local variables
  static WiFiClientSecure client;
  static unsigned short waitCounter;
  static String fomoUnitIdentifier;

  // Transitions
  switch (state) {
    case SS_SMStart:
      Serial.println("-> SS_Init");
      state = SS_Init;  //Initial state
      break;
    case SS_Init:
      Serial.println("-> SS_WaitWifi");
      state = SS_WaitWifi;
      break;
    case SS_WaitWifi:
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("-> SS_SyncStart");
        state = SS_SyncStart;
        client.setCACert(rootCa);
      } else if (WiFi.status() != WL_CONNECTED) {
        state = SS_WaitWifi;
      }
      break;
    case SS_SyncStart:
      Serial.println("-> SS_SyncWait");
      state = SS_SyncWait;
      break;
    case SS_SyncWait:
      if (client.connected() && client.available()) {
        if (client.readStringUntil('\n') == "\r") {
          Serial.println("Ready to process body");
          Serial.println("-> SS_ProcessReservationStatus");
          state = SS_ProcessReservationStatus;
        } else {
          state = SS_SyncWait;
        }
      } else if (client.connected() && !client.available()) {
        Serial.println("Connected but no data available...");
        state = SS_SyncWait;
      } else if (!client.connected()) {
        Serial.println("-> SS_SyncStart");
        state = SS_SyncStart;
      }
      break;
    case SS_ProcessReservationStatus:
      Serial.println("-> SS_RequestWait");
      state = SS_RequestWait;
      motionDetectedSincePreviousSync = 0;
      waitCounter = 0;
      break;
    case SS_RequestWait:
      if (waitCounter >= 600) {
        Serial.println("-> SS_SyncStart");
        state = SS_SyncStart;
      } else if (waitCounter < 600) {
        state = SS_RequestWait;
        waitCounter++;
        // Logging every 10 seconds:
        if (waitCounter % 100 == 0) {
          Serial.print("Seconds until next sync: ");
          Serial.println((600 - waitCounter) / 10);
        }
      }
      break;
    default:
      Serial.println("-> SS_SMStart");
      state = SS_SMStart;
      break;
  }

  // Actions
  switch (state) {
    case SS_Init:
      WiFi.begin(ssid, password);
      fomoUnitIdentifier = WiFi.macAddress();
      break;
    case SS_WaitWifi:
      break;
    case SS_SyncStart:
      if (client.connect(host, httpsPort)) {
        Serial.println("SUCCEEDED TO CONNECT");
      } else {
        Serial.println("FAILED TO CONNECT");
      }
      Serial.print("Motion detected: ");
      Serial.println(motionDetectedSincePreviousSync);
      client.print("POST /sync?occupied=");
      client.print(motionDetectedSincePreviousSync);
      client.print(" HTTP/1.1\r\nHost: ");
      client.print(host);
      client.print("\r\nX-Device-MAC: ");
      client.print(fomoUnitIdentifier);
      client.print("\r\nConnection: close\r\n\r\n");
      break;
    case SS_SyncWait:
      break;
    case SS_ProcessReservationStatus:
      {
        String jsonBody = client.readString();
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, jsonBody);
        if (error) {
          Serial.print("JSON parsing failed: ");
          Serial.println(error.c_str());
        } else {
          roomId = doc["room_id"];
          roomName = doc["room_name"].as<String>();
          currentlyReserved = doc["currently_reserved"];
          currentlyOpen = doc["currently_open"];
          currentReservationEnds = doc["current_reservation_ends"];
          nextReservationStarts = doc["next_reservation_starts"];
          currentTime = doc["current_time"];
          Serial.println("Variables set for NS SM");
          Serial.println(currentlyReserved);
          Serial.println(currentReservationEnds);
          Serial.println(nextReservationStarts);
          Serial.println(currentTime);
        }
      }
      break;
    case SS_RequestWait:
      break;
    default:
      break;
  }
  return state;
}

// ReadOccupancy (RO) SM
enum RO_States {
  RO_SMStart,
  RO_Init,
  RO_DetectMotion
};

int TickFct_ReadOccupancy(int state) {
  // Transitions
  switch (state) {
    case RO_SMStart:
      Serial.println("-> RO_Init");
      state = RO_Init;  // Initial state
      break;
    case RO_Init:
      Serial.println("-> RO_DetectMotion");
      state = RO_DetectMotion;
      break;
    case RO_DetectMotion:
      state = RO_DetectMotion;
      break;
    default:
      Serial.println("-> RO_SMStart");
      state = RO_SMStart;
      break;
  }

  // Actions
  switch (state) {
    case RO_Init:
      motionDetectedSincePreviousSync = 0;
      motionDetectedSincePreviousTick = 0;
      break;
    case RO_DetectMotion:
      if (!motionDetectedSincePreviousSync) {
        motionDetectedSincePreviousSync = (digitalRead(PIR_PIN) == HIGH);
      }
      motionDetectedSincePreviousTick = (digitalRead(PIR_PIN) == HIGH);
      break;
    default:
      break;
  }

  return state;
}


// NotifyStudent (NS) SM
enum NS_States {
  NS_SMStart,
  NS_Wait,
  NS_NotifyIntruder,
  NS_NotifyReservationEnd,
};

int TickFct_NotifyStudent(int state) {
  // Local constants
  static const short notificationLeadSeconds = 1500;  // 1500 seconds = 25 minutes

  // Local variables
  static BuzzerPlayer buzzerPlayer;

  // Transitions
  switch (state) {
    case NS_SMStart:
      Serial.println("-> NS_Wait");
      state = NS_Wait;  // Initial state
      break;
    case NS_Wait:
      if (!currentlyOpen && motionDetectedSincePreviousTick) {
        Serial.println("-> NS_NotifyIntruder");
        state = NS_NotifyIntruder;
        buzzerPlayer.setSong(&alarmSong);
        buzzerPlayer.play();
      } else if (currentlyReserved && (currentReservationEnds - currentTime) < notificationLeadSeconds) {
        Serial.println("-> NS_NotifyReservationEnd");
        state = NS_NotifyReservationEnd;
        buzzerPlayer.setSong(&notification);
        buzzerPlayer.play();
      } else {
        state = NS_Wait;
      }
      break;
    case NS_NotifyIntruder:
      if (!motionDetectedSincePreviousTick && !buzzerPlayer.isPlaying()) {
        Serial.println("-> NS_Wait");
        state = NS_Wait;
      } else if (motionDetectedSincePreviousTick && !buzzerPlayer.isPlaying()) {
        state = NS_NotifyIntruder;
        buzzerPlayer.setSong(&alarmSong);
        buzzerPlayer.play();
      } else {
        state = NS_NotifyIntruder;
      }
      break;
    case NS_NotifyReservationEnd:
      if ((currentReservationEnds - currentTime) < notificationLeadSeconds || buzzerPlayer.isPlaying()) {
        state = NS_NotifyReservationEnd;
      } else {
        state = NS_Wait;
      }
      break;
    default:
      state = NS_SMStart;
      break;
  }

  // Actions
  switch (state) {
    case NS_Wait:
      break;
    case NS_NotifyIntruder:
      break;
    case NS_NotifyReservationEnd:
      break;
    default:
      break;
  }

  // Update buzzer player (non-blocking)
  buzzerPlayer.update();

  return state;
}

// DisplayController (DC) SM
enum DC_States {
  DC_SMStart,
  DC_Init,
  DC_Refresh,
};

int TickFct_DisplayController(int state) {
  // Local constants
  static const unsigned char OLED_SDA = 21;
  static const unsigned char OLED_SCL = 22;
  static const unsigned char OLED_RST = 16;
  static const unsigned char SCREEN_WIDTH = 128;
  static const unsigned char SCREEN_HEIGHT = 64;

  // Local variables
  static Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RST);

  // Transitions
  switch (state) {
    case DC_SMStart:
      Serial.println("-> DC_Init");
      state = DC_Init;  // Initial state
      break;
    case DC_Init:
      Serial.println("-> DC_Refresh");
      state = DC_Refresh;
      break;
    case DC_Refresh:
      state = DC_Refresh;
      break;
    default:
      state = DC_SMStart;
      break;
  }

  // Actions
  switch (state) {
    case DC_Init:
      // Reset OLED via software
      pinMode(OLED_RST, OUTPUT);
      digitalWrite(OLED_RST, LOW);
      delay(20);
      digitalWrite(OLED_RST, HIGH);

      // Init I2C on the OLED pins
      Wire.begin(OLED_SDA, OLED_SCL);

      // Initialize the SSD1306 at I2C addr 0x3C
      // Try 0x3C first, if that fails try 0x3D
      if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C, false, false)) {
        Serial.println(F("SSD1306 at 0x3C failed, trying 0x3D"));
        if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3D, false, false)) {
          Serial.println(F("SSD1306 allocation failed"));
        }
      }
      break;
    case DC_Refresh:
      display.clearDisplay();
      display.setTextColor(SSD1306_WHITE);
      display.setFont(&FreeSans9pt7b);
      display.setCursor(0, 20);
      if (!currentlyOpen && motionDetectedSincePreviousSync) {
        display.setCursor(0, 20);
        display.print("INTRUDER!");
        display.setCursor(0, 40);
        display.print("GET OUT!");
      } else if (currentlyReserved) {
        display.setCursor(0, 20);
        display.print("Resv ends in");
        display.setCursor(0, 40);
        display.print((currentReservationEnds - currentTime) / 60);
        display.print(" mins");
      } else if (nextReservationStarts > currentTime) {
        display.setCursor(0, 20);
        display.print("Next resv in");
        display.setCursor(0, 40);
        display.print((nextReservationStarts - currentTime) / 60);
        display.print(" mins");
      } else {
        display.setCursor(0, 20);
        display.print("No upcoming");
        display.setCursor(0, 40);
        display.print("reservations");
      }
      display.setCursor(0, 60);
      display.print(">");
      display.print(roomName);
      display.display();
      break;
    default:
      break;
  }

  return state;
}

void TimerISRCode() {
  unsigned char i;
  for (i = 0; i < tasksNum; ++i) {
    if (tasks[i].elapsedTime >= tasks[i].period) {
      tasks[i].state = tasks[i].TickFct(tasks[i].state);
      tasks[i].elapsedTime = 0;
    }
    tasks[i].elapsedTime += tasksPeriodGCD;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  delay(1000);

  // SM Setup
  // ServerSync (SS) Setup
  unsigned char i = 0;
  tasks[i].state = SS_SMStart;
  tasks[i].period = periodServerSync;
  tasks[i].elapsedTime = tasks[i].period;
  tasks[i].TickFct = &TickFct_ServerSync;

  // ReadOccupancy (RO) Setup
  ++i;
  tasks[i].state = RO_SMStart;
  tasks[i].period = periodReadOccupancy;
  tasks[i].elapsedTime = tasks[i].period;
  tasks[i].TickFct = &TickFct_ReadOccupancy;

  // NotifyStudent (NS) Setup
  ++i;
  tasks[i].state = NS_SMStart;
  tasks[i].period = periodNotifyStudent;
  tasks[i].elapsedTime = tasks[i].period;
  tasks[i].TickFct = &TickFct_NotifyStudent;

  // DisplayController (DC) Setup
  ++i;
  tasks[i].state = DC_SMStart;
  tasks[i].period = periodDisplayController;
  tasks[i].elapsedTime = tasks[i].period;
  tasks[i].TickFct = &TickFct_DisplayController;

  // TimerSet(tasksPeriodGCD);
  // TimerOn();
}

void loop() {
  TimerISRCode();
  delay(tasksPeriodGCD);
}