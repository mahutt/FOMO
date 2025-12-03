#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "Task.h"

// Global constants
const int ITEM_ID = 18510;  // Room LB 451 - Brazil
const int PIR_PIN = 13;     // GPIO pin connected to PIR sensor output

// Global variables
unsigned char motionDetectedFlag;

// Global task variables
task tasks[2];
const unsigned char tasksNum = sizeof(tasks) / sizeof(tasks[0]);
const unsigned long tasksPeriodGCD = 100;
const unsigned long periodServerSync = 100;
const unsigned long periodReadOccupancy = 100;

task SS_task;
task RO_task;

// ServerSync (SS) SM
enum SS_States { SS_SMStart,
                 SS_Init,
                 SS_WaitWifi,
                 SS_SyncStart,
                 SS_SyncWait,
                 SS_ProcessReservationStatus,
                 SS_RequestWait };

int TickFct_ServerSync(int state) {
  // Local constants
  const char* ssid = "sfctommy";
  const char* password = "fomopass";
  const char* host = "335guy.com";
  const unsigned short httpsPort = 443;

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
        Serial.println("-> SS_WaitWifi");
        state = SS_WaitWifi;
      }
      break;
    case SS_SyncStart:
      Serial.println("-> SS_SyncWait");
      state = SS_SyncWait;
      break;
    case SS_SyncWait:
      if (client.connected() && client.available()) {
        Serial.println("Connected and data available...");
        Serial.println("-> SS_ProcessReservationStatus");
        state = SS_ProcessReservationStatus;
      } else if (client.connected() && !client.available()) {
        Serial.println("Connected but no data available...");
        Serial.println("-> SS_SyncWait");
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
        Serial.println("-> SS_RequestWait");
        state = SS_RequestWait;
        waitCounter++;
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
      static String response = "";
      response += client.readString();
      Serial.println(response);
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
      Serial.println("-> RO_DetectMotion");
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
      motionDetectedFlag = 0;
      break;
    case RO_DetectMotion:
      motionDetectedFlag = (digitalRead(PIR_PIN) == HIGH);
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

  // TimerSet(tasksPeriodGCD);
  // TimerOn();
}

void loop() {
  TimerISRCode();
  delay(tasksPeriodGCD);
}