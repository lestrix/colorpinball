(function(){
  "use strict";

  // Configs
  const maxDelta = 50; // Clamp update timestep, to avoid large skips
  const aspectRatio = 1.65;
  const gameWidth = 100;
  const slowMo = 0; // Slow motion factor to slow the loop down for debugging
  const colors = [[0xef, 0xe4, 0x00], [0xe4, 0x07, 0x66]]; // Player colors

  // Utility constants
  const tau = Math.PI * 2;
  const t0 = new Date();

  const container = document.body;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const debugElement = document.getElementById('debug');

  // Game State
  const state = {
    objects: [],
  };

  const lastContainerSize = { width: 0, height: 0 }; // Store to detect change
  let loops = 0;
  let lastTime = 0; // Timestamp of the last loop run
  let zoomFactor = 1; // Scaling to render at full resolution of the canvas

  // Helper functions

  // Print the argument for debugging and return it, so the function can be
  // inserted in most places seamlessly.
  function debug(value) {
    debugElement.textContent = JSON.stringify(value, null, 2);
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

  const moves = {
    update: function (ent, delta) {
      ent.x += Math.cos(ent.dir) * ent.v * delta;
      ent.y += Math.sin(ent.dir) * ent.v * delta;
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
      collidableEntities.forEach(function (otherEnt) {
        if (this === otherEnt) return;
        if (this.collisionCheck(otherEnt)) {
          console.log('collision');
        }
      }, ent);
    },
  };

  // Basic entity type - handles applying an entity's traits
  const Entity = function () {};
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
    x: 0, y: 0, radius: 4, v: 0, dir: 0, color: [255, 255, 255], fixed: false,
  };
  Ball.prototype.traits = [
    hasTrace, moves, collides,
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
  Ball.prototype.collisionCheck = function (otherEnt) {
    // TODO Handle other shapes than balls
    const centerDistance = Math.sqrt(Math.pow(this.x - otherEnt.x, 2) + Math.pow(this.y - otherEnt.y, 2));
    return centerDistance < this.radius + otherEnt.radius;
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

  state.objects.push(new Ball({ x:  0, y:  0, v: 0.009,  dir:  0.2, radius: 5, color: colors[0] }));
  state.objects.push(new Ball({ x: 10, y: 20, v: 0.008, dir: -1, radius: 3, color: colors[1] }));

  // Start looping
  loop(0);
})()
