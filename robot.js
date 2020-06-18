"use strict";

async function main(tank) {

  // auxiliary functions

  async function fireLeftOrRight(tank) {
    let dir = 0;
    if (Math.random() > 0.5) {
      dir = 180;
    }
    await tank.shoot(dir, 700);
  }

  // main loop

  while (true) {
    // go up
    while (await tank.getY() < 900) {
      await tank.drive(90, 50);
    }
    // shoot
    await tank.shoot(270, 700);
    await fireLeftOrRight(tank);
    // go down
    while (await tank.getY() > 100) {
      await tank.drive(270, 50);
    }
    // shoot
    await tank.shoot(90, 700);
    await fireLeftOrRight(tank);
  }
}
