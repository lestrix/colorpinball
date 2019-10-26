(function(){
  "use strict";

  const container = document.body;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const debugElement = document.getElementById('debug');

  // Configs
  const maxDelta = 50; // Clamp update timestep, to avoid large skips
  const aspectRatio = 1.65;
  const gameWidth = canvas.width;
  const gameHeight = gameWidth / aspectRatio;
  const slowMo = 0; // Slow motion factor to slow the loop down for debugging
  const colors = [[0xef, 0xe4, 0x00], [0xe4, 0x07, 0x66]]; // Player colors

  // Utility constants
  const tau = Math.PI * 2;
  const t0 = new Date();



  // Game State
  const state = {
    objects: [],
  };

  const lastContainerSize = { width: 0, height: 0 }; // Store to detect change
  let loops = 0;
  let lastTime = 0; // Timestamp of the last loop run
  let zoomFactor = 1; // Scaling to render at full resolution of the canvas
  let engine = null;

  // Helper functions

  // Print the argument for debugging and return it, so the function can be
  // inserted in most places seamlessly.
  function debug(value) {
    // debugElement.textContent = JSON.stringify(value, null, 2);
    return value;
  }

  function transparentize(rgb, alpha) {
    return `rgba(${rgb.join(',')},${alpha})`;
  }

  // Traits - define a behavior of an entity

  const hasTrace = {
    create: function (ent) {
      ent.trace = [];
    },

    update: function (ent) {
      // Add previous position to trace
      ent.trace.push({ x: ent.x, y: ent.y });
      // Limit trace length
      if (ent.trace.length > ent.maxTraceLength) {
        ent.trace.splice(0, ent.trace.length - ent.maxTraceLength);
      }
    },

    draw: function (ent, ctx) {
      ent.trace.forEach(function (tracePoint, i) {
        const alpha = i / ent.maxTraceLength / 16; // Fade
        const radius = ent.radius * (0.5 + 0.5 / ent.maxTraceLength * i);
        ctx.beginPath();
        ctx.arc(tracePoint.x, tracePoint.y, radius, 0, tau);
        ctx.fillStyle = transparentize(ent.color, alpha);
        ctx.fill();
      });
    },
  };

  const updatePhysics = {
    update: function (ent) {
      ent.x = ent.physicsObject.position.x;
      ent.y = ent.physicsObject.position.y;
    }
  };

  const moves = {
    update: function (ent, delta) {
      // if (ent.fixed) return;
      ent.x += ent.dx * delta;
      ent.y += ent.dy * delta;
    },
  };

  const collidableEntities = [];
  const collides = {
    create: function (ent) {
      collidableEntities.push(ent);
      // TODO Handle removing
    },
    update: function (ent) {
      if (ent.fixed) return;
      const collidingPairs = [];
      collidableEntities.forEach(function (otherEnt) {
        if (this === otherEnt) return;
        if (collidingPairs.some( (pair) => pair[0] === otherEnt  && pair[1] === this)) return;

        const centerDistance = Math.sqrt(Math.pow(this.x - otherEnt.x, 2) + Math.pow(this.y - otherEnt.y, 2));
        if (centerDistance < this.radius + otherEnt.radius) {
          var theta1 = this.angle();
          var theta2 = otherEnt.angle();
          var phi = Math.atan2(otherEnt.y - this.y, otherEnt.x - this.x);
          var m1 = this.mass;
          var m2 = otherEnt.mass;
          var v1 = this.speed();
          var v2 = otherEnt.speed();

          var dx1F = (v1 * Math.cos(theta1 - phi) * (m1-m2) + 2*m2*v2*Math.cos(theta2 - phi)) / (m1+m2) * Math.cos(phi) + v1*Math.sin(theta1-phi) * Math.cos(phi+Math.PI/2);
          var dy1F = (v1 * Math.cos(theta1 - phi) * (m1-m2) + 2*m2*v2*Math.cos(theta2 - phi)) / (m1+m2) * Math.sin(phi) + v1*Math.sin(theta1-phi) * Math.sin(phi+Math.PI/2);
          var dx2F = (v2 * Math.cos(theta2 - phi) * (m2-m1) + 2*m1*v1*Math.cos(theta1 - phi)) / (m1+m2) * Math.cos(phi) + v2*Math.sin(theta2-phi) * Math.cos(phi+Math.PI/2);
          var dy2F = (v2 * Math.cos(theta2 - phi) * (m2-m1) + 2*m1*v1*Math.cos(theta1 - phi)) / (m1+m2) * Math.sin(phi) + v2*Math.sin(theta2-phi) * Math.sin(phi+Math.PI/2);

          this.dx = dx1F;
          this.dy = dy1F;
          if (otherEnt.fixed !== true) {

            otherEnt.dx = dx2F;
            otherEnt.dy = dy2F;

          }
          console.log('colliding')
          collidingPairs.push([this, otherEnt]);


        }
      }, ent);
      debug(collidingPairs);
    },
  };

  const isBounded = {
    update: function (ent, delta) {
      if (ent.y + ent.radius >= gameHeight / 2 ) { // top
        ent.dy *= -1;
      }
      if (ent.x + ent.radius >= gameWidth / 2 ) { // right
        ent.dx *= -1;
      }
      if (-ent.y + ent.radius >= gameHeight / 2 ) { // bottom
        ent.dy *= -1;
      }
      if (-ent.x + ent.radius >= gameWidth / 2 ) { // left
        ent.dx *= -1;
      }
    }
  };

  // Basic entity type - handles applying an entity's traits
  const Entity = function () {};
  Entity.prototype.create = function (created) {
    this.traits.forEach(function (trait) {
      if (typeof trait.create === 'function') trait.create(created)
    })
  };
  Entity.prototype.update = function (delta) {
    this.traits.forEach(function (trait) {
      if (typeof trait.update === 'function') trait.update(this, delta);
    }, this);
  };
  Entity.prototype.render = function (ctx) {
    this.traits.forEach(function (trait) {
      if (typeof trait.draw === 'function') trait.draw(this, ctx);
    }, this);
    this.draw(ctx);
  },
  Entity.prototype.draw = function (ctx) {
    throw new Error('Entities MUST implement draw!');
  };
  Entity.prototype.aabb = function () {
    throw new Error('Entities using collisions MUST implement aabb!');
  };
  Entity.prototype.collisionCheckAABB = function (otherEnt) {
    const a = this.aabb();
    const b = otherEnt.aabb();
    return a.xMin < b.xMax && a.xMax > b.xMin
        && a.yMin < b.yMax && a.yMax > b.yMin;
  };


  // Concrete entity types

  const Ball = function (props) {
    Object.assign(this, Ball.prototype.defaults, props);
    Ball.prototype.traits.forEach(function (trait) {
      if (typeof trait.create === 'function') {
        trait.create(this);
      }
    }, this);
  };
  Object.setPrototypeOf(Ball.prototype, Entity.prototype);
  Ball.prototype.super = Entity.prototype;
  Ball.prototype.maxTraceLength = 32;
  Ball.prototype.defaults = {
    x: 0, y: 0, radius: 4, dx: 0, dy: 0, color: [255, 255, 255], fixed: false,
  };
  Ball.prototype.angle = function () {
    return Math.atan2(this.dy, this.dx);
  }
  Ball.prototype.speed = function () {
    return Math.sqrt(this.dx * this.dx + this.dy * this.dy);
  }
  Ball.prototype.traits = [
    hasTrace, moves, collides, isBounded,
  ];
  Ball.prototype.draw = function (ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, tau);
    ctx.fillStyle = transparentize(this.color, 1);
    // ctx.shadowColor = transparentize(this.color, 1);
    // ctx.shadowBlur = 80;
    ctx.fill();
  };
  Ball.prototype.aabb = function () {
    return {
      xMin: this.x - this.radius, xMax: this.x + this.radius,
      yMin: this.y - this.radius, yMax: this.y + this.radius,
    };
  };

  // Adjust the canvas size to the container size in case it changed
  function resizeCanvas() {
    const currentContainerSize = container.getBoundingClientRect();

    // Check if the size changed
    if (currentContainerSize.width !== lastContainerSize.width
      || currentContainerSize.height !== lastContainerSize.height
    ) {
      // Check if the size is limited by height or width
      if (currentContainerSize.width / aspectRatio > currentContainerSize.height) {
        // Limited by height
        canvas.height = currentContainerSize.height;
        canvas.width = currentContainerSize.height * aspectRatio;
      } else {
        // Limited by width
        canvas.width = currentContainerSize.width;
        canvas.height = currentContainerSize.width / aspectRatio;
      }

      zoomFactor = currentContainerSize.width / gameWidth;
      lastContainerSize.width = currentContainerSize.width;
      lastContainerSize.height = currentContainerSize.height;
    }
  }

  // Update the game state
  function update(timestamp) {
    const delta = Math.min(timestamp - lastTime, maxDelta)

    state.objects.forEach(function updateObj(obj) {
      obj.update(delta);
    });
  }

  // Render the game
  function render() {
    // Reset canvas
    ctx.resetTransform();
    ctx.clearRect(0,0, canvas.width, canvas.height);
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(zoomFactor, -1 * zoomFactor);

    // Render all objects
    state.objects.forEach(function renderObj(obj) {
      obj.render(ctx);
    });
  }

  // Game loop
  function loop(timestamp) {
    // Schedule next loop
    if (slowMo === 0) {
      window.requestAnimationFrame(loop);
    } else {
      window.setTimeout(() => loop((new Date() - t0) / slowMo), 16 * slowMo);
    }

    // Execute loop steps
    loops += 1;
    resizeCanvas();
    update(timestamp);
    render();
    //debug({ zoomFactor, w: canvas.width, h: canvas.height, loops, b: state.objects[0] });
  }


  state.objects.push(new Ball({ x:  0, y:  0, dx: 0.0, dy: 0.0, radius: 5, fixed: true, color: colors[0], mass: 999999 }));
  state.objects.push(new Ball({ x: 10, y: 20, dx: 0.02, dy: 0.02, radius: 3, fixed: false, color: colors[1], mass: 1 }));
  state.objects.push(new Ball({ x: 40, y: 10, dx: 0.03, dy: 0.03, radius: 5, fixed: false, color: colors[0], mass: 1 }));
  // state.objects.push(new Ball({ x: 10, y: -30, dx: 0.04, dy: 0.04, radius: 4, color: colors[1] }));

  // Start looping
  loop(0);
})()
