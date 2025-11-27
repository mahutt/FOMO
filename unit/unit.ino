#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "Task.h"

// Global constants
const int PIR_PIN = 13;  // GPIO pin connected to PIR sensor output

// Global variables
unsigned char motionDetectedFlag;
unsigned char reqResetMotionDetectedFlag;
unsigned char ackResetMotionDetectedFlag;

// Global task variables
task tasks[2];
const unsigned char tasksNum = 2;
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
                 SS_WaitForMotionFlagReset,
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
      state = SS_Init;  //Initial state
      break;
    case SS_Init:
      state = SS_WaitWifi;
      break;
    case SS_WaitWifi:
      if (WiFi.status() == WL_CONNECTED) {
        state = SS_SyncStart;
        client.setInsecure();
      } else if (WiFi.status() != WL_CONNECTED) {
        state = SS_WaitWifi;
      }
      break;
    case SS_SyncStart:
      state = SS_SyncWait;
      break;
    case SS_SyncWait:
      if (client.connected() && client.available()) {
        Serial.println("Connected and data available...");
        state = SS_ProcessReservationStatus;
      } else if (client.connected() && !client.available()) {
        Serial.println("Connected but no data available...");
        state = SS_SyncWait;
      } else if (!client.connected()) {
        state = SS_SyncStart;
      }
      break;
    case SS_ProcessReservationStatus:
      state = SS_WaitForMotionFlagReset;
      reqResetMotionDetectedFlag = 1;
      break;
    case SS_WaitForMotionFlagReset:
      if (ackResetMotionDetectedFlag) {
        state = SS_RequestWait;
        reqResetMotionDetectedFlag = 0;
        waitCounter = 0;
      } else if (!ackResetMotionDetectedFlag) {
        state = SS_WaitForMotionFlagReset;
      }
      break;
    case SS_RequestWait:
      if (waitCounter >= 600) {
        state = SS_SyncStart;
      } else if (waitCounter < 600) {
        state = SS_RequestWait;
        waitCounter++;
      }
      break;
    default:
      state = SS_SMStart;
      break;
  }

  // Actions
  switch (state) {
    case SS_Init:
      Serial.println("SS_Init");
      WiFi.begin(ssid, password);
      break;
    case SS_WaitWifi:
      Serial.println("SS_WaitWifi");
      break;
    case SS_SyncStart:
      Serial.println("SS_SyncStart");
      if (client.connect(host, httpsPort)) {
        Serial.println("SUCCEEDED TO CONNECT");
      } else {
        Serial.println("FAILED TO CONNECT");
      }
      client.print("GET / HTTP/1.1\r\nHost: ");
      client.print(host);
      client.print("\r\nConnection: close\r\n\r\n");
      break;
    case SS_SyncWait:
      Serial.println("SS_SyncWait");
      break;
    case SS_ProcessReservationStatus:
      Serial.println("SS_ProcessReservationStatus");
      static String response = "";
      response += client.readString();
      Serial.println(response);
      break;
    case SS_WaitForMotionFlagReset:
      Serial.println("SS_WaitForMotionFlagReset");
      break;
    case SS_RequestWait:
      Serial.println("SS_RequestWait");
      break;
    default:
      break;
  }
  return state;
}

// ReadOccupancy (RO) SM
enum RO_States { RO_SMStart,
                 RO_Init,
                 RO_WaitForMotion,
                 RO_WaitForSync,
                 RO_WaitForAck,
};

int TickFct_ReadOccupancy(int state) {
  // Transitions
  switch (state) {
    case RO_SMStart:
      state = RO_Init;  // Initial state
      break;
    case RO_Init:
      state = RO_WaitForMotion;
      break;
    case RO_WaitForMotion:
      if (motionDetectedFlag) {
        state = RO_WaitForSync;
      } else if (!motionDetectedFlag) {
        state = RO_WaitForMotion;
      }
      break;
    case RO_WaitForSync:
      if (reqResetMotionDetectedFlag) {
        state = RO_WaitForAck;
        motionDetectedFlag = 0;
        ackResetMotionDetectedFlag = 1;
      } else if (!reqResetMotionDetectedFlag) {
        state = RO_WaitForSync;
      }
      break;
    case RO_WaitForAck:
      if (!reqResetMotionDetectedFlag) {
        state = RO_WaitForMotion;
        ackResetMotionDetectedFlag = 0;
      } else if (reqResetMotionDetectedFlag) {
        state = RO_WaitForAck;
      }
      break;
    default:
      state = RO_SMStart;
      break;
  }

  // Actions
  switch (state) {
    case RO_Init:
      motionDetectedFlag = 0;
      break;
    case RO_WaitForMotion:
      motionDetectedFlag = (digitalRead(PIR_PIN) == HIGH);
      break;
    case RO_WaitForSync:
      break;
    case RO_WaitForAck:
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