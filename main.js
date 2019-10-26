(function(){
  "use strict";

  // Configs
  const maxDelta = 50;
  const aspectRatio = 1.65;
  const gameWidth = 100;

  const container = document.body;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const debugElement = document.getElementById('debug');

  // Game State
  const state = {
    objects: [
      { type: 'ball', x: 0, y: 0, v: 0.001, angle: 1, radius: 5 },
      { type: 'ball', x: 10, y: 20, v: 0.005, angle: -1, radius: 3 },
    ],
  };

  const lastContainerSize = { width: 0, height: 0 }; // Store to detect change
  let loops = 0;
  let lastTime = 0; // Timestamp of the last loop run
  let zoomFactor = 1; // Scaling to render at full resolution of the canvas

  // Print the argument for debugging and return it, so the function can be
  // inserted in most places seamlessly.
  function debug(value) {
    debugElement.textContent = JSON.stringify(value);
    return value;
  }

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
      obj.x = obj.x + Math.cos(obj.angle) * obj.v * delta;
      obj.y = obj.y + Math.sin(obj.angle) * obj.v * delta;
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
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  // Game loop
  function loop(timestamp) {
    window.requestAnimationFrame(loop);
    loops += 1;
    resizeCanvas();
    update(timestamp);
    render();
    debug({ zoomFactor, w: canvas.width, h: canvas.height, loops });
  }

  // Start looping
  loop(0);
})()
