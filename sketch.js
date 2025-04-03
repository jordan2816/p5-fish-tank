// p5.js Demo: Fish Tank - Shark Eats All!

// --- Configuration ---
const NUM_FISH_INITIAL = 20;
const FISH_SIZE_MIN = 12;
const FISH_SIZE_MAX = 25;
const FISH_MAX_SPEED = 2.8; // Fish are a bit faster now
const FISH_MAX_FORCE = 0.12;
const FISH_WANDER_STRENGTH = 0.06;
const FISH_SEPARATION_DIST = 35;
const FISH_SEPARATION_FORCE = 0.18;
const FISH_AVOID_DIST = 130; // Distance fish start avoiding shark/mouse
const FISH_PANIC_DIST = 80;  // Distance fish REALLY panic
const FISH_PANIC_SPEED_BOOST = 1.5; // Boost isn't insurmountable
const FISH_PANIC_FORCE_BOOST = 2.0;

const SHARK_INITIAL_SIZE = 50;
const SHARK_MAX_SPEED = 3.2; // Shark is faster than normal fish, needs to catch panicked ones
const SHARK_MAX_FORCE = 0.1;
const SHARK_EAT_DISTANCE_FACTOR = 0.6; // How close mouth needs to be (fraction of shark size)
const SHARK_GROWTH_RATE = 1.5; // How much size increases per fish eaten
const SHARK_MAX_SIZE = 350; // Prevent shark from getting infinitely huge

const THOUGHT_CHANGE_INTERVAL = 250;
const THOUGHT_BUBBLE_OFFSET_Y = -20;
const THOUGHT_TEXT_SIZE = 10;

const BLOOM_DURATION = 120; // Frames the bloom effect lasts
const BLOOM_PARTICLE_COUNT = 100;
const BLOOM_MAX_RADIUS_FACTOR = 5; // How far particles fly (relative to shark size)

// --- Globals ---
let fishes = [];
let shark;
let possibleThoughts = [
  "...", "hungry", "ooh, shiny!", "swim swim", "?", "where's bob?",
  "bubble!", "seaweed?", "just keep swimming", "that rock looks comfy",
  "coral!", "is it lunchtime?", "<-", "->", "safe here?", "what was that?",
  "glub.", "uh oh", "faster!", "danger!", "EEK!"
];

let isBlooming = false;
let bloomTimer = 0;
let bloomOrigin = null;
let bloomParticles = [];

// --- Setup ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  textFont('Arial'); // Use a common font

  // Create Shark first
  shark = new Shark(width / 2, height / 2);

  // Create Initial Fish
  repopulateFish(createVector(width / 2, height / 2), NUM_FISH_INITIAL); // Start them in the middle
}

// --- Draw Loop ---
function draw() {
  // Background - subtle gradient
  drawGradientBackground();

  // --- Bloom Logic ---
  if (isBlooming) {
    drawBloomEffect();
    bloomTimer--;
    if (bloomTimer <= 0) {
      isBlooming = false;
      repopulateFish(bloomOrigin, NUM_FISH_INITIAL); // Fish return!
      bloomParticles = []; // Clear particles
    }
  } else { // Only run normal simulation if not blooming
    // Update and display shark
    if (fishes.length > 0) {
        shark.findTarget(fishes);
        shark.checkEating(fishes); // Check BEFORE updating position for accuracy
    } else {
        shark.targetFish = null; // No fish to target
        // Trigger Bloom when all fish are gone
        startBloom();
    }
    shark.update();
    shark.display();


    // Update and display fish
    // Loop backwards because we might remove fish
    for (let i = fishes.length - 1; i >= 0; i--) {
      let fish = fishes[i];
      fish.behaviors(fishes, shark); // Apply forces
      fish.update();             // Move fish
      fish.display();            // Draw fish and thought
      fish.edges();              // Handle screen wrap
    }
  } // End of normal simulation block

  // Simple fish counter (optional)
  fill(0, 0, 100, 80);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Fish Remaining: " + fishes.length, 10, 10);
}

// --- Background Function ---
function drawGradientBackground() {
  let topColor = color(200, 70, 70);
  let bottomColor = color(220, 85, 55);
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(topColor, bottomColor, inter);
    stroke(c);
    line(0, y, width, y);
  }
  noStroke();
}

// --- Bloom Functions ---
function startBloom() {
    if (!isBlooming && fishes.length === 0) { // Double check needed
        isBlooming = true;
        bloomTimer = BLOOM_DURATION;
        bloomOrigin = shark.pos.copy(); // Bloom from shark's last position
        shark.size = SHARK_INITIAL_SIZE; // Reset shark size
        shark.vel.mult(0.1); // Slow shark down dramatically

        // Create particles for the bloom effect
        bloomParticles = [];
        let bloomBaseHue = random(360);
        for (let i = 0; i < BLOOM_PARTICLE_COUNT; i++) {
            bloomParticles.push(new BloomParticle(bloomOrigin, bloomBaseHue));
        }
         // Maybe add a sound cue here in a real game!
        // bloomSound.play();
    }
}

function drawBloomEffect() {
    // Update and display particles
    for (let i = bloomParticles.length - 1; i >= 0; i--) {
        let p = bloomParticles[i];
        p.update();
        p.display();
        if (p.isDead()) {
            bloomParticles.splice(i, 1);
        }
    }
    // Optional: Draw a fading flash behind particles
    let bloomProgress = map(bloomTimer, BLOOM_DURATION, 0, 1, 0); // 0 to 1
    let flashAlpha = map(sin(bloomProgress * PI), 0, 1, 0, 50); // Fade in/out alpha
    fill(0, 0, 100, flashAlpha);
    ellipse(bloomOrigin.x, bloomOrigin.y, width * bloomProgress, height * bloomProgress);

}

function repopulateFish(origin, count) {
  fishes = []; // Clear any remnants
  for (let i = 0; i < count; i++) {
      // Spawn near the bloom origin, but not exactly on it
      let spawnOffset = p5.Vector.random2D().mult(random(50, 150));
      let spawnPos = p5.Vector.add(origin, spawnOffset);
      // Keep within bounds if possible
      spawnPos.x = constrain(spawnPos.x, 0, width);
      spawnPos.y = constrain(spawnPos.y, 0, height);
      fishes.push(new Fish(spawnPos.x, spawnPos.y));
  }
}


// --- Fish Class ---
class Fish {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, FISH_MAX_SPEED * 0.5));
    this.acc = createVector(0, 0);
    this.size = random(FISH_SIZE_MIN, FISH_SIZE_MAX);
    this.baseMaxSpeed = FISH_MAX_SPEED;
    this.baseMaxForce = FISH_MAX_FORCE;
    this.maxSpeed = this.baseMaxSpeed;
    this.maxForce = this.baseMaxForce;

    // Prettier colors
    this.hue = random(360); // Any color!
    this.saturation = random(70, 100);
    this.brightness = random(80, 100);
    this.secondaryHue = (this.hue + random(-60, 60)) % 360; // For fins/gradient

    // Thought related
    this.thought = random(possibleThoughts);
    this.thoughtTimer = floor(random(THOUGHT_CHANGE_INTERVAL));
    this.isPanicked = false;

    // For drawing curves
    this.bodyPoints = [];
    this.numBodyPoints = 8; // Control complexity
    this.wiggle = 0;
  }

  applyForce(force) {
    this.acc.add(force);
  }

  behaviors(allFish, sharkRef) {
    let wanderForce = this.wander();
    let separationForce = this.separate(allFish);
    let mousePos = createVector(mouseX, mouseY);
    let avoidMouseForce = this.avoid(mousePos, false, FISH_AVOID_DIST * 0.8);
    let avoidSharkForce = this.avoid(sharkRef.pos, true, FISH_AVOID_DIST); // Panic enabled

    // Reset panic state and speed/force unless avoidance says otherwise
    this.isPanicked = false;
    this.maxSpeed = this.baseMaxSpeed;
    this.maxForce = this.baseMaxForce;

    // Apply weighting
    wanderForce.mult(0.4);
    separationForce.mult(1.8); // Stronger separation
    avoidMouseForce.mult(2.0);
    avoidSharkForce.mult(3.5); // REALLY avoid shark

    this.applyForce(wanderForce);
    this.applyForce(separationForce);
    this.applyForce(avoidMouseForce);
    this.applyForce(avoidSharkForce); // This will set isPanicked if needed
  }

  wander() {
    let angle = noise(this.pos.x * 0.005, this.pos.y * 0.005, frameCount * 0.015) * TWO_PI * 3;
    let wanderTarget = p5.Vector.fromAngle(angle);
    wanderTarget.setMag(FISH_WANDER_STRENGTH);
    return wanderTarget;
  }

  separate(allFish) {
    let desiredSeparation = this.size + FISH_SEPARATION_DIST;
    let steer = createVector(0, 0);
    let count = 0;
    for (let other of allFish) {
      if (other === this) continue; // Don't separate from self
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if ((d > 0) && (d < desiredSeparation)) {
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize();
        diff.div(d);
        steer.add(diff);
        count++;
      }
    }
    if (count > 0) {
      steer.div(count);
    }
    if (steer.mag() > 0) {
      steer.normalize();
      steer.mult(this.maxSpeed); // Use current maxSpeed
      steer.sub(this.vel);
      steer.limit(FISH_SEPARATION_FORCE); // Use base separation force
    }
    return steer;
  }

  avoid(target, checkPanic, avoidanceRadius) {
    let desired = p5.Vector.sub(this.pos, target);
    let d = desired.mag();

    if (d < avoidanceRadius) {
      let effectiveMaxSpeed = this.baseMaxSpeed;
      let effectiveMaxForce = this.baseMaxForce;

      if (checkPanic) {
          this.isPanicked = true; // Mark as panicked regardless of exact distance within radius
          if (d < FISH_PANIC_DIST) {
              // Only boost speed/force and change thought if *really* close
              effectiveMaxSpeed = this.baseMaxSpeed * FISH_PANIC_SPEED_BOOST;
              effectiveMaxForce = this.baseMaxForce * FISH_PANIC_FORCE_BOOST;
              this.thought = random(["!!!", "EEK!", "SWIM!", "NO!"]);
              this.thoughtTimer = THOUGHT_CHANGE_INTERVAL / 2; // Show panic thought longer
          }
          // Update instance variables if panic boosting
          this.maxSpeed = effectiveMaxSpeed;
          this.maxForce = effectiveMaxForce;
      }


      let strength = map(d, 0, avoidanceRadius, 1.5, 0); // Stronger force when closer
      desired.normalize();
      desired.mult(effectiveMaxSpeed * strength);

      let steer = p5.Vector.sub(desired, this.vel);
      steer.limit(effectiveMaxForce); // Limit with potentially boosted force
      return steer;
    } else {
      // If not avoiding this specific target, ensure panic state is false *if this was the panic source*
      if (checkPanic) {
          // this.isPanicked = false; // Handled in behaviors() reset now
          // Reset speed/force handled in behaviors() too
      }
      return createVector(0, 0);
    }
  }


  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed); // Use potentially boosted speed
    this.pos.add(this.vel);
    this.acc.mult(0);

    // Update thought periodically (if not panicked, or panic thought timed out)
     this.thoughtTimer--;
     if (this.thoughtTimer <= 0 && !this.isPanicked) { // Only change if not actively panicked
         this.thought = random(possibleThoughts.filter(t => !["!!!", "EEK!", "SWIM!", "NO!"].includes(t))); // Avoid panic thoughts normally
         this.thoughtTimer = THOUGHT_CHANGE_INTERVAL + floor(random(-50, 50));
     } else if (this.thoughtTimer <=0 && this.isPanicked) {
         // If panic thought timer runs out but still panicked, reset timer keep panic thought
         this.thoughtTimer = THOUGHT_CHANGE_INTERVAL / 3;
     }


    // Simple wiggle for drawing
    this.wiggle = sin(frameCount * 0.2 + this.pos.x * 0.1) * 2; // Subtle body wiggle

    // Update body curve points (simplified)
    this.bodyPoints = [];
    let angle = this.vel.heading();
    let bodyLength = this.size * 1.3;
    let bodyWidth = this.size * 0.8;
    // Head (wider)
    this.bodyPoints.push(createVector(bodyLength * 0.5, 0)); // Nose tip
    this.bodyPoints.push(createVector(bodyLength * 0.3, -bodyWidth * 0.5));
    this.bodyPoints.push(createVector(-bodyLength * 0.1, -bodyWidth * 0.45)); // Mid-top
    // Tail area (narrower)
    this.bodyPoints.push(createVector(-bodyLength * 0.4, -bodyWidth * 0.2 + this.wiggle)); // Before tail top
    this.bodyPoints.push(createVector(-bodyLength * 0.6, 0 + this.wiggle)); // Tail center
    this.bodyPoints.push(createVector(-bodyLength * 0.4, bodyWidth * 0.2 + this.wiggle)); // Before tail bottom
    this.bodyPoints.push(createVector(-bodyLength * 0.1, bodyWidth * 0.45)); // Mid-bottom
    this.bodyPoints.push(createVector(bodyLength * 0.3, bodyWidth * 0.5));
    this.bodyPoints.push(createVector(bodyLength * 0.5, 0)); // Close loop at nose

  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());

    // --- Nicer Fish Body ---
    // Gradient fill
    let c1 = color(this.hue, this.saturation * 0.8, this.brightness);
    let c2 = color(this.secondaryHue, this.saturation, this.brightness * 0.7);
    // Apply gradient roughly top-to-bottom feel relative to fish orientation
    let gradientSteps = 5;
    for (let i = 0; i < gradientSteps; i++) {
        let inter = i / (gradientSteps - 1);
        let stripColor = lerpColor(c1, c2, inter);
        fill(stripColor);
        let yOffset = map(inter, 0, 1, -this.size * 0.4, this.size * 0.4);
        // Draw thin strips (approximate gradient) - this is complex, could simplify
        // Let's use a simpler fill for now, gradient drawing is tricky with curves
    }
    fill(c1); // Use primary color for main body fill


    // Body shape using curveVertex
    beginShape();
    curveVertex(this.bodyPoints[this.bodyPoints.length-1].x, this.bodyPoints[this.bodyPoints.length-1].y); // Control point before start
    for(let p of this.bodyPoints) {
        curveVertex(p.x, p.y);
    }
    curveVertex(this.bodyPoints[0].x, this.bodyPoints[0].y); // Point 0
    curveVertex(this.bodyPoints[1].x, this.bodyPoints[1].y); // Control point after end
    endShape(CLOSE);


    // --- Fins ---
    fill(this.secondaryHue, this.saturation * 0.7, this.brightness * 0.9, 80); // Lighter, transparent fins
    // Pectoral Fin (simple triangle) - Wiggles slightly
    let finWiggle = sin(frameCount * 0.3 + this.pos.y * 0.1) * 3;
    triangle(this.size * 0.1, 0, this.size * 0.2, this.size * 0.4 + finWiggle, this.size * 0.2, -this.size * 0.4 + finWiggle);

    // Tail Fin (using the wiggle factor)
    let tailBaseX = -this.size * 0.6;
    let tailTipX = -this.size * 0.9;
    let tailWidth = this.size * 0.4;
    beginShape();
    vertex(tailBaseX, 0 + this.wiggle);
    bezierVertex(tailBaseX-5, tailWidth*0.8 + this.wiggle, tailTipX, tailWidth + this.wiggle, tailTipX-5, 0 + this.wiggle); // Top curve
    bezierVertex(tailTipX, -tailWidth + this.wiggle, tailBaseX-5, -tailWidth*0.8 + this.wiggle, tailBaseX, 0 + this.wiggle); // Bottom curve
    endShape(CLOSE);


    // --- Eye ---
    fill(0, 0, 100); // White background
    ellipse(this.size * 0.3, 0, this.size * 0.2, this.size * 0.2);
    fill(0, 0, 0); // Black pupil
    // Pupil follows velocity slightly (looks where it's going)
    let pupilOffsetX = this.vel.x * 0.01 * this.size;
    let pupilOffsetY = this.vel.y * 0.01 * this.size; // This needs rotation adjustment
    // Let's simplify: pupil just slightly forward
    ellipse(this.size * 0.33, 0, this.size * 0.1, this.size * 0.1);


    pop(); // Restore previous drawing state

    // Draw Thought Bubble (after pop)
    this.displayThought();
  }

  displayThought() {
    let bubbleX = this.pos.x;
    let bubbleY = this.pos.y + THOUGHT_BUBBLE_OFFSET_Y - (this.size * 0.4);
    let textPadding = 4;
    let textW = textWidth(this.thought) + textPadding * 2;
    let textH = THOUGHT_TEXT_SIZE + textPadding * 2;

    // Bubble
    fill(0, 0, 100, 75);
    noStroke(); // Ensure no stroke on bubble
    rectMode(CENTER);
    rect(bubbleX, bubbleY, textW, textH, 7); // Rounded corners

    // Tail
    let tailBaseY = bubbleY + textH / 2;
    let tailTipY = this.pos.y - this.size * 0.4;
    triangle(bubbleX - 4, tailBaseY, bubbleX + 4, tailBaseY, bubbleX, tailTipY);

    // Text
    fill(0, 0, 0, 90);
    textAlign(CENTER, CENTER);
    textSize(THOUGHT_TEXT_SIZE);
    text(this.thought, bubbleX, bubbleY);
    rectMode(CORNER); // Reset rect mode
  }

  edges() {
    let buffer = this.size * 1.5; // Larger buffer for curves
    if (this.pos.x > width + buffer) this.pos.x = -buffer;
    else if (this.pos.x < -buffer) this.pos.x = width + buffer;
    if (this.pos.y > height + buffer) this.pos.y = -buffer;
    else if (this.pos.y < -buffer) this.pos.y = height + buffer;
  }
}


// --- Shark Class ---
class Shark {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(-1, 0); // Start moving
    this.acc = createVector(0, 0);
    this.size = SHARK_INITIAL_SIZE;
    this.maxSpeed = SHARK_MAX_SPEED;
    this.maxForce = SHARK_MAX_FORCE;
    this.baseHue = 230; // Deep blue/grey base
    this.saturation = 15;
    this.brightness = 40;
    this.targetFish = null;
    this.lastEatenTimer = 0; // For visual feedback
    this.EAT_EFFECT_DURATION = 15; // Frames for effect
  }

  applyForce(force) {
    this.acc.add(force);
  }

  findTarget(allFish) {
      let closestDist = Infinity;
      let potentialTarget = null;
      for (let fish of allFish) {
          let d = dist(this.pos.x, this.pos.y, fish.pos.x, fish.pos.y);
          if (d < closestDist) {
              closestDist = d;
              potentialTarget = fish;
          }
      }
      this.targetFish = potentialTarget; // Can be null if no fish left
  }

  // Must be called *before* update()
  checkEating(allFish) {
      // Approximate mouth position (slightly ahead of center)
      let lookAhead = this.vel.copy().setMag(this.size * 0.4);
      let mouthPos = p5.Vector.add(this.pos, lookAhead);

      for (let i = allFish.length - 1; i >= 0; i--) {
          let fish = allFish[i];
          let d = dist(mouthPos.x, mouthPos.y, fish.pos.x, fish.pos.y);
          let eatRadius = this.size * SHARK_EAT_DISTANCE_FACTOR + fish.size * 0.5;

          if (d < eatRadius) {
              this.eat(i, allFish); // Pass index and array
              break; // Only eat one fish per check cycle for simplicity
          }
      }
       // Decrease eat effect timer
       if(this.lastEatenTimer > 0) {
           this.lastEatenTimer--;
       }
  }

  eat(fishIndex, allFish) {
      // Remove fish
      allFish.splice(fishIndex, 1);

      // Grow (up to a max size)
      this.size = min(this.size + SHARK_GROWTH_RATE, SHARK_MAX_SIZE);

      // Maybe adjust speed/force slightly based on size? (optional)
      // this.maxSpeed = SHARK_MAX_SPEED * (SHARK_INITIAL_SIZE / this.size); // Gets slower?
      // this.maxForce = SHARK_MAX_FORCE * (this.size / SHARK_INITIAL_SIZE); // More turning force?

       // Trigger visual feedback
       this.lastEatenTimer = this.EAT_EFFECT_DURATION;

      // Find a new target immediately if possible
      this.findTarget(allFish);

      // Add a sound effect placeholder
      // console.log("CHOMP!");
  }

  seek(targetPos) {
      if(!targetPos) return createVector(0,0); // No target

      let desired = p5.Vector.sub(targetPos, this.pos);
      // No need to slow down now, shark WANTS to eat
      desired.normalize();
      desired.mult(this.maxSpeed);

      let steer = p5.Vector.sub(desired, this.vel);
      steer.limit(this.maxForce);
      return steer;
  }

  wander() {
      let angle = noise(this.pos.x * 0.01, this.pos.y * 0.01, frameCount * 0.008) * TWO_PI * 2;
      let wanderTarget = p5.Vector.fromAngle(angle);
      wanderTarget.setMag(this.maxForce * 0.8); // Wander a bit more purposefully
      return wanderTarget;
  }

  update() {
      let force;
      if (this.targetFish) {
          force = this.seek(this.targetFish.pos);
      } else {
          force = this.wander(); // Wander if no target
      }
      this.applyForce(force);

      this.vel.add(this.acc);
      this.vel.limit(this.maxSpeed);
      this.pos.add(this.vel);
      this.acc.mult(0);

      this.edges();
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading()); // Point in direction of movement

    // --- Nicer Shark Body ---
    let bodyLength = this.size * 1.5;
    let bodyWidth = this.size;
    let tailWidth = this.size * 0.8;

    // Colors
    let cBase = color(this.baseHue, this.saturation, this.brightness);
    let cBelly = color(this.baseHue, this.saturation * 0.5, this.brightness + 30); // Lighter belly
    let cFin = color(this.baseHue, this.saturation * 1.2, this.brightness * 0.8); // Darker fins

    // Eating visual effect (slight color flash)
    if (this.lastEatenTimer > 0) {
        let flashAmount = map(sin(map(this.lastEatenTimer, this.EAT_EFFECT_DURATION, 0, 0, PI)), 0, 1, 0, 40);
        cBase = color(this.baseHue, this.saturation + flashAmount, this.brightness + flashAmount/2);
    }


    // Belly (drawn first, underneath)
    fill(cBelly);
    beginShape();
    vertex(bodyLength * 0.4, 0); // Nose tip area
    curveVertex(bodyLength * 0.4, 0); // Start control point
    curveVertex(bodyLength * 0.1, bodyWidth * 0.35); // Mid belly side
    curveVertex(-bodyLength * 0.3, bodyWidth * 0.25); // Tail area belly side
    curveVertex(-bodyLength * 0.6, 0); // Tail base center
    curveVertex(-bodyLength * 0.3, -bodyWidth * 0.25);
    curveVertex(bodyLength * 0.1, -bodyWidth * 0.35);
    curveVertex(bodyLength * 0.4, 0); // Nose tip area
    curveVertex(bodyLength * 0.4, 0); // End control point
    endShape(CLOSE);


    // Main Body (on top of belly)
    fill(cBase);
    beginShape();
     // Nose tip (control point)
    curveVertex(bodyLength * 0.55, 0);
    // Nose tip (actual point)
    vertex(bodyLength * 0.5, 0);
    // Top curve
    curveVertex(bodyLength * 0.1, -bodyWidth * 0.5); // Wider near head
    curveVertex(-bodyLength * 0.4, -bodyWidth * 0.1); // Tapering towards tail fin
    // Tail fin base top
    curveVertex(-bodyLength * 0.6, -tailWidth * 0.1);
    // Tail fin base center (control point for smooth transition)
    curveVertex(-bodyLength * 0.7, 0);
    // Tail fin base bottom
    curveVertex(-bodyLength * 0.6, tailWidth * 0.1);
     // Bottom curve
    curveVertex(-bodyLength * 0.4, bodyWidth * 0.1);
    curveVertex(bodyLength * 0.1, bodyWidth * 0.5);
    // Back to nose
    vertex(bodyLength * 0.5, 0);
    // Control point after nose
    curveVertex(bodyLength * 0.55, 0);
    endShape(CLOSE);


    // --- Fins ---
    fill(cFin);
    // Dorsal Fin
    let dorsalBaseX = -bodyLength * 0.1;
    let dorsalTipX = -bodyLength * 0.05;
    let dorsalTipY = -bodyWidth * 0.65; // Higher dorsal fin
    let dorsalBackX = -bodyLength * 0.3;
    beginShape();
    vertex(dorsalBaseX, -bodyWidth * 0.1); // Front base on body
    bezierVertex(dorsalBaseX, -bodyWidth*0.4, dorsalTipX - 5, dorsalTipY, dorsalTipX, dorsalTipY); // Curve up to tip
    bezierVertex(dorsalTipX + 5, dorsalTipY, dorsalBackX, -bodyWidth*0.3, dorsalBackX, -bodyWidth * 0.05); // Curve back down
    endShape(CLOSE);


    // Pectoral Fins (one slightly behind the other)
    let pecBaseX = bodyLength * 0.05;
    let pecTipX = bodyLength * 0.0;
    let pecTipY = bodyWidth * 0.75;
    let pecBackX = -bodyLength * 0.15;
    // Fin 1 (slightly further back visually)
    push();
    translate(0, bodyWidth * 0.1); // Offset slightly
    fill(red(cFin), green(cFin), blue(cFin), 180); // Slightly transparent
    beginShape();
    vertex(pecBaseX, bodyWidth * 0.3);
    bezierVertex(pecBaseX+10, bodyWidth * 0.5, pecTipX+5, pecTipY, pecTipX, pecTipY);
    bezierVertex(pecTipX-10, pecTipY, pecBackX, bodyWidth * 0.5, pecBackX, bodyWidth * 0.35);
    endShape(CLOSE);
    pop();
    // Fin 2 (slightly further forward visually)
    push();
    translate(0, -bodyWidth * 0.1); // Offset slightly
     fill(cFin); // Solid
    beginShape();
    vertex(pecBaseX, -bodyWidth * 0.3);
    bezierVertex(pecBaseX+10, -bodyWidth * 0.5, pecTipX+5, -pecTipY, pecTipX, -pecTipY);
    bezierVertex(pecTipX-10, -pecTipY, pecBackX, -bodyWidth * 0.5, pecBackX, -bodyWidth * 0.35);
    endShape(CLOSE);
    pop();


    // Tail Fin
    let tailBaseX = -bodyLength * 0.65;
    let tailTopX = -bodyLength * 0.9;
    let tailTopY = -tailWidth * 0.6; // Asymmetric tail
    let tailBottomX = -bodyLength * 0.85;
    let tailBottomY = tailWidth * 0.4;
    let tailNotchX = -bodyLength * 0.8; // Indent in middle
    fill(cFin);
    beginShape();
    vertex(tailBaseX, 0); // Center base
    bezierVertex(tailBaseX - 10, -tailWidth * 0.3, tailTopX - 15, tailTopY, tailTopX, tailTopY); // Top lobe curve
    bezierVertex(tailTopX + 10, tailTopY + 10, tailNotchX + 5, 0, tailNotchX, 0); // Curve into notch
    bezierVertex(tailNotchX + 5, 0, tailBottomX + 10, tailBottomY, tailBottomX, tailBottomY); // Curve out to bottom lobe
    bezierVertex(tailBottomX - 10, tailBottomY - 10, tailBaseX - 10, tailWidth * 0.2, tailBaseX, 0); // Curve back to base
    endShape(CLOSE);

    // --- Eyes (Subtle) ---
    fill(0, 0, 5, 90); // Dark, almost black
    ellipse(bodyLength * 0.35, -bodyWidth * 0.1, this.size * 0.08, this.size * 0.06);
    ellipse(bodyLength * 0.35, bodyWidth * 0.1, this.size * 0.08, this.size * 0.06);


    pop(); // Restore drawing state
  }


  edges() {
      // Wrap around screen edges - use a buffer based on size
      let buffer = this.size * 1.5; // Generous buffer
      if (this.pos.x > width + buffer) this.pos.x = -buffer;
      else if (this.pos.x < -buffer) this.pos.x = width + buffer;
      if (this.pos.y > height + buffer) this.pos.y = -buffer;
      else if (this.pos.y < -buffer) this.pos.y = height + buffer;
  }
}

// --- Bloom Particle Class ---
class BloomParticle {
    constructor(origin, baseHue) {
        this.pos = origin.copy();
        this.vel = p5.Vector.random2D().mult(random(2, 6)); // Explode outwards
        this.lifespan = BLOOM_DURATION * random(0.8, 1.2); // Live about as long as the bloom
        this.initialLifespan = this.lifespan;
        this.size = random(3, 8);
        this.hue = (baseHue + random(-30, 30)) % 360;
        this.sat = random(70, 100);
        this.bri = random(80, 100);
    }

    update() {
        this.vel.mult(0.97); // Slow down slightly
        this.pos.add(this.vel);
        this.lifespan--;
    }

    display() {
        let currentAlpha = map(this.lifespan, 0, this.initialLifespan, 0, 100);
        let currentSize = this.size * (this.lifespan / this.initialLifespan);
        fill(this.hue, this.sat, this.bri, currentAlpha);
        noStroke();
        ellipse(this.pos.x, this.pos.y, currentSize, currentSize);
    }

    isDead() {
        return this.lifespan <= 0;
    }
}


// --- Window Resize ---
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}