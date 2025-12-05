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
const int ITEM_ID = 18510;  // Room LB 451 - Brazil
const int PIR_PIN = 13;     // GPIO pin connected to PIR sensor output

// Global variables
unsigned char motionDetectedFlag;
unsigned char currentlyReserved;
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
const unsigned long periodNotifyStudent = 1000;
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
  static const char* ssid = "sfctommy";
  static const char* password = "fomopass";
  static const char* host = "335guy.com";
  static const unsigned short httpsPort = 443;

  // Local variables
  static WiFiClientSecure client;
  static unsigned short waitCounter;

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
        client.setInsecure();
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
      motionDetectedFlag = 0;
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
      Serial.println(motionDetectedFlag);
      client.print("POST /sync/");
      client.print(ITEM_ID);
      client.print("?occupied=");
      client.print(motionDetectedFlag);
      client.print(" HTTP/1.1\r\nHost: ");
      client.print(host);
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
          // long room_id = doc["room_id"]; // TODO: make it possible to re-assign associated room remotely
          currentlyReserved = doc["currently_reserved"];
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
  RO_DetectMotion,
  RO_Wait
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
      if (motionDetectedFlag) {
        Serial.println("-> RO_Wait");
        state = RO_Wait;
      } else if (!motionDetectedFlag) {
        state = RO_DetectMotion;
      }
      break;
    case RO_Wait:
      if (motionDetectedFlag) {
        state = RO_Wait;
      } else if (!motionDetectedFlag) {
        Serial.println("-> RO_DetectMotion");
        state = RO_DetectMotion;
      }
      break;
    default:
      Serial.println("-> RO_SMStart");
      state = RO_SMStart;
      break;
  }

  // Actions
  switch (state) {
    case RO_Init:
      motionDetectedFlag = 0;
      break;
    case RO_DetectMotion:
      motionDetectedFlag = (digitalRead(PIR_PIN) == HIGH);
      break;
    case RO_Wait:
      break;
    default:
      break;
  }

  return state;
}


// NotifyStudent (NS) SM
enum NS_States {
  NS_SMStart,
  NS_WaitThreshold,
  NS_Notify,
  NS_WaitEnd,
};

int TickFct_NotifyStudent(int state) {
  // Local constants
  static const short notificationLeadSeconds = 1500;  // 1500 seconds = 25 minutes

  // Transitions
  switch (state) {
    case NS_SMStart:
      Serial.println("-> NS_WaitThreshold");
      state = NS_WaitThreshold;  // Initial state
      break;
    case NS_WaitThreshold:
      if (currentlyReserved && (currentReservationEnds - currentTime) < notificationLeadSeconds) {
        Serial.println("-> NS_Notify");
        state = NS_Notify;
      } else {
        state = NS_WaitThreshold;
      }
      break;
    case NS_Notify:
      Serial.println("-> NS_WaitEnd");
      state = NS_WaitEnd;
      break;
    case NS_WaitEnd:
      if ((currentReservationEnds - currentTime) < notificationLeadSeconds) {
        state = NS_WaitEnd;
      } else {
        state = NS_WaitThreshold;
      }
      break;
    default:
      state = NS_SMStart;
      break;
  }

  // Actions
  switch (state) {
    case NS_WaitThreshold:
      break;
    case NS_Notify:
      buzzerPlay(notification);
      break;
    case NS_WaitEnd:
      break;
    default:
      break;
  }

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
      if (currentlyReserved) {
        display.print("Resv ends in\n");
        display.print((currentReservationEnds - currentTime) / 60);
        display.print(" mins");
      } else if (nextReservationStarts > currentTime) {
        display.print("Next resv in\n");
        display.print((nextReservationStarts - currentTime) / 60);
        display.print(" mins");
      } else {
        display.print("No upcoming\nreservations");
      }
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