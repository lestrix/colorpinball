(function(){
  "use strict";

  // configs
  const maxDelta = 50;
  const aspectRatio = 1.65;
  const gameWidth = 100;

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  let lastTime = 0;
  let zoomFactor = 1;
  let lastSize = getCanvasSize();


  const state = {
    objects: [
      { type: 'ball', x: 0, y: 0, v: 0.001, angle: 1, radius: 5 },
      { type: 'ball', x: 10, y: 20, v: 0.005, angle: -1, radius: 3 },
    ],
  };

  function getCanvasSize() {
    return {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    };
  }

  function resizeCanvas() {
    const currentSize = getCanvasSize();
    if (currentSize.width !== lastSize.width
      || currentSize.height !== lastSize.height
    ) {
      if (currentSize.width * aspectRatio > currentSize.height) {
        canvas.height = currentSize.height;
        canvas.width = currentSize.height * aspectRatio;
      } else {
        canvas.width = currentSize.width;
        canvas.height = currentSize.width / aspectRatio;
      }
      zoomFactor = currentSize.width / gameWidth;
      lastSize.width = currentSize.width;
      lastSize.height = currentSize.height;
    }
    status.textContent = JSON.stringify(zoomFactor);
  }

  function update(timestamp) {
    const delta = Math.min(timestamp - lastTime, maxDelta)
    state.objects.forEach(function updateObj(obj) {
      obj.x = obj.x + Math.cos(obj.angle) * obj.v * delta;
      obj.y = obj.y + Math.sin(obj.angle) * obj.v * delta;
      // status.textContent = JSON.stringify(obj);
      // status.textContent = JSON.stringify(lastSize)

    });
  }

  function render() {

    ctx.resetTransform();
    ctx.clearRect(0,0, canvas.width, canvas.height);
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(zoomFactor, -1 * zoomFactor);

    state.objects.forEach(function renderObj(obj) {
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, 2 * Math.PI);
      ctx.fill();

    });
  }

  function loop(timestamp) {
    window.requestAnimationFrame(loop);
    resizeCanvas();
    update(timestamp);
    render();
  }

  loop(0);
})()
