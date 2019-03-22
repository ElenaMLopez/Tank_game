// Config Constants

const ARENA = { w: 1340, h: 1000 }
const CENTER = { x: 670, y: 500 }
const BREAK_DISTANCE = 250
const TRACK_DISTANCE = 200

const RAD_TO_DEG = 180 / Math.PI
const MAX_SCAN_RESOLUTION = 10
const LOCATE_SCAN_CONE = 60
const SAFE_SHOOT_DISTANCE = 300

const resolutions = {
  LOW: 10,
  HIGH: 6,
  MAX: 3
}

const modes = {
  OPENING: 'OPENING',
  AVOID: 'AVOID',
  TRACK: 'TRACK'
}

const trackingModes = {
  LOCATE: 'LOCATE',
  PINPOINT: 'PINPOINT',
  FOUND: 'FOUND',
  SEARCH: 'SEARCH'
}

// Utility Functions

const rand = (max, min = 0) => Math.floor(Math.random() * (max - min)) + min

const clone = obj => JSON.parse(JSON.stringify(obj))

const getRandomPoint = () => ({
  x: rand(ARENA.w - BREAK_DISTANCE, BREAK_DISTANCE), y: rand(ARENA.h - BREAK_DISTANCE, BREAK_DISTANCE)
})

// Movement Functions

function plotCourse(curX, curY, xx, yy) {
  // returns angle to go from (curX, curY) to (xx, yy)
  const x = curX - xx
  const y = curY - yy
  let d = 0

  if (x === 0) {
    if (yy > curY) d = 90
    else d = 270
  } else {
    if (yy < curY) {
      if (xx > curX) d = 360 + RAD_TO_DEG * Math.atan(y / x)
      else d = 180 + RAD_TO_DEG * Math.atan(y / x)
    } else {
      if (xx > curX)d = RAD_TO_DEG * Math.atan(y / x)
      else d = 180 + RAD_TO_DEG * Math.atan(y / x)
    }
  }
  return d
}

function distance(x1, y1, x2, y2) {
  // returns distance between (x1, y1) and (x2, y2)
  const x = x1 - x2
  const y = y1 - y2
  return Math.sqrt((x * x) + (y * y))
}

async function driveTo(tank, speed, { x: destX, y: destY }) {
  const [curX, curY] = tank.position
  let course = plotCourse(curX, curY, destX, destY)
  await tank.drive(course, speed)
}

async function distanceTo(tank, { x: destX, y: destY }) {
  const [curX, curY] = tank.position
  return distance(curX, curY, destX, destY)
}

async function stop(tank) {
  await tank.drive(0, 0)
}

// Shooting Functions

async function shootTo(tank, { x: destX, y: destY, variation }, userRange = false) {
  const [curX, curY] = tank.position
  if (destX <= 0 || destX >= ARENA.w || destY <= 0 || destY >= ARENA.h) return
  let d = plotCourse(curX, curY, destX, destY)
  if (variation) {
    d += rand(variation) - (variation / 2)
  }
  const range = userRange || distance(curX, curY, destX, destY)
  await tank.shoot(d, Math.max(SAFE_SHOOT_DISTANCE, range))
}

// Location Functions

async function getQuadrant(tank) {
  const [x, y] = tank.position
  if (x > 670) {
    if (y > 500) {
      return 2;
    } else {
      return 3;
    }
  } else {
    if (y > 500) {
      return 1;
    } else {
      return 4;
    }
  }
}

function getCornerForQuadrant(quadrant) {
  switch (quadrant) {
    case 1: return { x: BREAK_DISTANCE, y: ARENA.h - BREAK_DISTANCE };
    case 2: return { x: ARENA.w - BREAK_DISTANCE, y: ARENA.h - BREAK_DISTANCE };
    case 3: return { x: ARENA.w - BREAK_DISTANCE, y: BREAK_DISTANCE };
    case 4: return { x: BREAK_DISTANCE, y: BREAK_DISTANCE };
  }
}

function getRandomCorner() {
  const n = rand(5, 1)
  const corner =  getCornerForQuadrant(n)
  return corner
}

// -------------------------
// State Functions

function transitionTo(mode, state, resetFields = {}) {
  state.mode = mode
  // for (const key of Object.keys(resetFields)) {
  //   state[key] = clone(INITIAL_STATE[key])
  // }
}

// -------------------------
// Locomotion

let lastDesination = { x: 0, y: 0 }

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y
}

function safePoint(point) {
  return {
    x: Math.min(ARENA.w - BREAK_DISTANCE, Math.max(BREAK_DISTANCE, point.x)),
    y: Math.min(ARENA.h - BREAK_DISTANCE, Math.max(BREAK_DISTANCE, point.y))
  }
}

let currentDestination = null
let nextDestination = null

async function goTo(tank, destination, speed = 100) {
  const [x, y] = tank.position
  if (!currentDestination) currentDestination = destination
  if (!samePoint(currentDestination, destination)) {
    nextDestination = destination
  }
  const safeDestination = safePoint(currentDestination)
  // if (!samePoint(destination, lastDesination) && await tank.getSpeed() >= 50 ) {
  //   console.log('break!!')
  //   return await tank.drive(0, 0)
  // } else {
  //   lastDesination = destination
  // }
  const distance = await distanceTo(tank, safeDestination)
  if (distance > BREAK_DISTANCE) {
    await driveTo(tank, speed, safeDestination)
  } else if (tank.speed > 50) {
    await tank.drive(0, 0)
  } else {
    currentDestination = null
    if (nextDestination) {
      currentDestination = nextDestination
      nextDestination = null
    }
    return true
  }
}

async function getClosestCorner(tank) {
  const quadrant = await getQuadrant(tank)
  return getCornerForQuadrant(quadrant)
}

const locomotionHandlers = {
  OPENING: async (tank, state) => {
    const { locomotion } = state
    locomotion.target = await getClosestCorner(tank)
    locomotion.speed = 100
  },
  TRACK: async (tank, state) => {
    const { locomotion, scanner } = state
    const { target } = scanner
    // locomotion.target = safePoint({
    //   x: target.x + rand(TRACK_DISTANCE) - TRACK_DISTANCE / 2,
    //   y: target.y + rand(TRACK_DISTANCE) - TRACK_DISTANCE / 2,
    // })
    if (distanceTo(tank, target) > 100)
      locomotion.target = target
    else
      return locomotionHandlers.CORNER(tank, state)
    // locomotion.speed = scanner.found ? 50 : 100
    locomotion.speed = 100
  },
  RABBIT: async (tank, { locomotion }) => {
    locomotion.target = safePoint(getRandomPoint())
    locomotion.speed = 100
  },
  CORNER: async (tank, { locomotion }) => {
    locomotion.target = safePoint(getRandomCorner())
    locomotion.speed = 100
  }
}

async function handleLocomotion(tank, state) {
  const { mode, locomotion } = state
  if (!locomotion.driving) {
    locomotion.driving = true
    // console.log(mode, locomotion)
    switch(mode) {
    case modes.OPENING:
      await locomotionHandlers.OPENING(tank, state)
      break
    case modes.TRACK:
      await locomotionHandlers.TRACK(tank, state)
      break
    default:
      await locomotionHandlers.CORNER(tank, state)
      break
    }
    locomotion.safeTarget = locomotion.target
  }
  if (await goTo(tank, locomotion.safeTarget, locomotion.speed)) {
    if (mode.OPENING) transitionTo(modes.AVOID, state)
    locomotion.driving = false
  }
}

// -------------------------
// Scanner Functions

async function angleDistanceToPosition(tank, angle, distance) {
  const [curX, curY] = tank.position
  const x = Math.cos(angle / RAD_TO_DEG) * distance
  const y = Math.sin(angle / RAD_TO_DEG) * distance
  return { x: x + curX, y: y + curY }
}

async function scanArea(tank, area, progress) {
  const distance = await distanceTo(tank, area)
  const diameter = area.radius * 2
  const apperture = Math.atan(distance / diameter) * RAD_TO_DEG
  const chunk = Math.min(1, MAX_SCAN_RESOLUTION * 0.8 / apperture)
  const scanOffset = (progress + chunk - 0.5) * apperture
  const [curX, curY] = tank.position
  const angle = plotCourse(curX, curY, area.x, area.y)
  const finalAngle = angle + scanOffset
  const result = await tank.scan(finalAngle, MAX_SCAN_RESOLUTION)
  const found = result ? await angleDistanceToPosition(tank, finalAngle, result) : result
  return [found, progress + (2 * chunk)]
}

async function scanTo(tank, { x: destX, y: destY }, resolution, offsetAngle = 0) {
  const [curX, curY] = tank.position
  let course = plotCourse(curX, curY, destX, destY)
  const angle = course + offsetAngle
  const result =  await tank.scan(angle, resolution)
  const found = result ? await angleDistanceToPosition(tank, angle, result) : result
  return found
}

const scannerHandlers = {
  TRACK: async (tank, state) => {
    const { scanner } = state
    const { tracking, target, progress, ticksSinceLost } = scanner
    scanner.found = false
    switch(tracking) {
    case 'NEVER': {
      scanner.found = true
      scanner.progress = 0
      const result = await scanTo(tank, target, resolutions.HIGH)
      if (!result) scanner.tracking = trackingModes.LOCATE
      break
    }
    case trackingModes.FOUND: {
      scanner.found = true
      scanner.variation = resolutions.MAX
      const chunk = resolutions.MAX / resolutions.HIGH
      const offset = (progress - 0.5) * resolutions.HIGH
      const result = await scanTo(tank, target, resolutions.MAX, offset)
      if (result) {
        state.scanner.target = state.weapons.target = result
        scanner.tracking = trackingModes.FOUND
        scanner.progress = 0
      } else if (progress >= 1) {
        scanner.progress = 0
        // transitionTo(modes.AVOID, state, { scanner: true, locomotion: true })
        scanner.tracking = trackingModes.LOCATE
      } else {
        scanner.progress += chunk
      }
      break
    }
    case trackingModes.PINPOINT:
    default: {
      scanner.found = true
      scanner.variation = resolutions.HIGH
      const chunk = resolutions.HIGH / resolutions.LOW
      const offset = (progress - 0.5) * resolutions.LOW
      const result = await scanTo(tank, target, resolutions.HIGH, offset)
      if (result) {
        state.scanner.target = state.weapons.target = result
        scanner.tracking = trackingModes.FOUND
      } else if (progress >= 1) {
        scanner.progress = 0
        // transitionTo(modes.AVOID, state, { scanner: true, locomotion: true })
        scanner.tracking = trackingModes.LOCATE
      } else {
        scanner.progress += chunk
      }
      break
    }
    case trackingModes.LOCATE: {
      scanner.found = true
      scanner.variation = resolutions.LOW
      const chunk = (resolutions.LOW / LOCATE_SCAN_CONE) * 1.2
      const offset = (progress - 0.5) * LOCATE_SCAN_CONE
      const result = await scanTo(tank, target, resolutions.LOW, offset)
      if (result) {
        scanner.progress = 0
        scanner.target = state.weapons.target = result
        scanner.tracking = trackingModes.PINPOINT
      } else if (progress >= 1) {
        scanner.progress = 0
        // transitionTo(modes.AVOID, state, { scanner: true, locomotion: true })
        scanner.tracking = trackingModes.SEARCH
        scanner.area = { ...target, radius: 50 }
      } else {
        scanner.progress += chunk
      }
      break
    }
    case trackingModes.SEARCH: {
      const [found, scanProgress] = await scanArea(tank, scanner.area, scanner.progress)
      if (found) {
        scanner.progress = 0
        scanner.target = state.weapons.target = found
        scanner.tracking = trackingModes.PINPOINT
      } else if (progress >= 1) {
        transitionTo(modes.AVOID, state, { scanner: true })
      } else {
        scanner.progress = scanProgress
      }
      break
    }
    }
  },
  EXPLORE: async (tank, state) => {
    const { scanner } = state
    if (!scanner.scanning) {
      scanner.scanning = true
      // TODO: choose point in oppisite quadrant
      scanner.area = { ...getRandomPoint(), radius: rand(30, 10) }
      scanner.progress = 0
    }
    const [found, progress] = await scanArea(tank, scanner.area, scanner.progress)
    if (found) {
      transitionTo(modes.TRACK, state, { scanner: true })
      state.scanner.target = state.weapons.target = found
    } else if (progress >= 1) {
      scanner.scanning = false
    } else {
      scanner.progress = progress
    }
  }
}

async function handleScanner(tank, state) {
const { mode, locomotion } = state
  switch(mode) {
  case modes.TRACK:
    return scannerHandlers.TRACK(tank, state)
  default:
    return scannerHandlers.EXPLORE(tank, state)
  }
}


// -------------------------
// Weapons Functions

async function handleWeapons(tank, state) {
  const { weapons, scanner } = state
  if (state.mode !== modes.TRACK) return;
  const [x, y] = tank.position
  if (weapons.target && await distanceTo(tank, scanner.target) <= 700)
    await shootTo(tank, { ...weapons.target, variation: scanner.variation })
}

// Entry Point

const INITIAL_STATE = {
  mode: modes.OPENING,
  locomotion: {
    target: null,
    driving: false,
    braking: false
  },
  weapons: {
    target: null,
    missilesFlying: 0
  },
  scanner: {
    scanning: false,
    area: null,
    progress: 0,
    target: null,
    currentAngle: 0,
    lastKnownTargetPosition: false,
    ticksSinceLost: 0,
    tracking: trackingModes.PINPOINT
  }
}

async function main(tank) {
  let tankState = clone(INITIAL_STATE)

  while (true) {
    tank.position = await tank.getPosition()
    tank.speed = await tank.getSpeed()
    await handleLocomotion(tank, tankState)
    await handleWeapons(tank, tankState)
    await handleScanner(tank, tankState)
    await handleLocomotion(tank, tankState)
  }
}
