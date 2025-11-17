#ifndef TASK_H
#define TASK_H

typedef struct task {
  int state;                  // Task's current state
  unsigned long period;       // Task period
  unsigned long elapsedTime;  // Time elapsed since last task tick
  int (*TickFct)(int);        // Task tick function
} task;

#endif