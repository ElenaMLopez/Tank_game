'use strict';

/* Global variables */

async function main(tank) {
  let angle = 180;

  async function horizontalShot(tank) {
    await tank.shoot(0, 670);
    await tank.shoot(180, 670);
  }

  async function goToCenter(tank) {
    const currentX = await tank.getX();
    const currentY = await tank.getY();
    const position = {
      currentX,
      currentY,
    };

    async function moveToUpDown(position) {
      if (position.currentY < 450) {
        await tank.drive(90, 50);
      } else if (position.currentY >= 650) {
        await tank.drive(270, 50);
      }
    }

    async function moveX(position) {
      if (position.currentX < 650) {
        await moveToUpDown(position.currentY);
        await tank.drive(0, 60);
      } else if (position.currentX >= 690) {
        await moveToUpDown(position.currentY);
        await tank.drive(180, 60);
      } else {
        await moveToUpDown(position.currentY);
      }
    }

    await moveX(position);
  }

  async function randomShoot(tank, angle) {
    let customAngle = (Math.random(angle) * 1000) % 360;
    customAngle != angle
      ? await tank.shoot(customAngle, 300)
      : customAngle + 10;
  }

  async function scanByRange(tank) {
    let counter = 1;
    let scannerAngle = angle - 15;
    let maxRange = angle + 15;

    while (counter) {
      if (scannerAngle >= maxRange % 360) {
        Math.abs(await tank.scan(scannerAngle, 20))
          ? await gotTarget(tank, scannerAngle, 600)
          : (scannerAngle = (scannerAngle - 30) % 360);
        counter -= 1;
      } else {
        (await tank.scan(scannerAngle, 10)) != 0
          ? await gotTarget(tank, scannerAngle, 600)
          : (scannerAngle = (scannerAngle + 30) % 360);
      }
    }
  }

  async function gotTarget(tank, angle, shootDistance) {
    while (shootDistance > 150) {
      shootDistance = (await tank.scan(angle, 10)) + 150;
      await tank.shoot(angle, shootDistance);
    }
  }

  async function pingpongTarget(tank, angle) {
    let shootDistance = (await tank.scan(angle, 10)) + 150;
    const adjacentAngles = [10, -20, 45, -50];

    for await (let currentAngle of adjacentAngles) {
      currentAngle = angle + ((currentAngle + 360) % 360);

      (await tank.scan(currentAngle, 10))
        ? ((currentAngle = (currentAngle + 360) % 360),
          await tank.shoot(tank, currentAngle),
          await gotTarget(tank, currentAngle, shootDistance))
        : (angle = (angle + currentAngle) % 360);
    }
  }

  async function shotToTarget(tank) {
    let enemyRange = await tank.scan(angle, 10);

    async function doubleShoot(angle, firstShootDistance, secondShootDistance) {
      await tank.shoot(angle, firstShootDistance);
      await tank.shoot(angle + 2, secondShootDistance);
      return angle;
    }
    if (enemyRange != 0) {
      let firstShootDistance = enemyRange + 5;
      let secondShootDistance = enemyRange + 10;

      await doubleShoot(angle, firstShootDistance, secondShootDistance);
      await gotTarget(tank, angle, secondShootDistance);
      await scanByRange(tank);
      await pingpongTarget(tank, angle);
    } else {
      angle = (angle + 20) % 360;
      await randomShoot(tank, angle);
    }
  }

  await horizontalShot(tank);

  /* main loop */
  while (true) {
    // Go to center
    await goToCenter(tank);

    // Look for enemy and shot to it
    await shotToTarget(tank);
  }
}
