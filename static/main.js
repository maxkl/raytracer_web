
function range(start, stop, step = 1) {
    if (typeof stop === 'undefined') {
        stop = start;
        start = 0;
    }
    return Array(Math.ceil((stop - start) / step))
        .fill(start)
        .map((x, y) => x + y * step);
}

class EventEmitter {
    constructor() {
        this._eventHandlers = {};
    }

    on(name, handler) {
        if (this._eventHandlers.hasOwnProperty(name)) {
            this._eventHandlers[name].push(handler);
        } else {
            this._eventHandlers[name] = [handler];
        }
    }

    off(name, handler) {
        if (this._eventHandlers.hasOwnProperty(name)) {
            const handlers = this._eventHandlers[name];
            const index = this._eventHandlers[name].lastIndexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    once(name, handler) {
        const self = this;
        function wrapper(arg) {
            self.off(name, wrapper);
            handler(arg);
        }
        this.on(name, wrapper);
    }

    oncePromise(resolveEventName, rejectEventName) {
        const self = this;
        return new Promise((resolve, reject) => {
            function resolveWrapper(arg) {
                self.off(resolveEventName, resolveWrapper);
                if (typeof rejectEventName !== 'undefined') {
                    self.off(rejectEventName, rejectWrapper);
                }
                resolve(arg);
            }

            function rejectWrapper(arg) {
                self.off(resolveEventName, resolveWrapper);
                if (typeof rejectEventName !== 'undefined') {
                    self.off(rejectEventName, rejectWrapper);
                }
                reject(arg);
            }

            this.on(resolveEventName, resolveWrapper);
            if (typeof rejectEventName !== 'undefined') {
                this.on(rejectEventName, rejectWrapper);
            }
        });
    }

    emit(name, arg) {
        if (this._eventHandlers.hasOwnProperty(name)) {
            const handlers = this._eventHandlers[name];
            for (const handler of handlers) {
                handler(arg);
            }
        }
    }
}

class RenderWorker extends EventEmitter {
    static start() {
        return new Promise((resolve, reject) => {
            const worker = new Worker('worker.js');

            worker.onmessage = evt => {
                const message = evt.data;
                switch (message.name) {
                    case 'loaded':
                        worker.onmessage = null;
                        resolve(new RenderWorker(worker));
                        break;
                    case 'load error':
                        worker.onmessage = null;
                        reject(new Error(message.data));
                        break;
                }
            };
        });
    }

    constructor(worker) {
        super();

        this._worker = worker;

        const self = this;
        this._worker.onmessage = evt => {
            const message = evt.data;
            self.emit(message.name, message.data);
        };
    }

    _sendMessage(name, data) {
        this._worker.postMessage({
            name: name,
            data: data,
        });
    }

    init() {
        this._sendMessage('init');
    }

    loadScene(scene) {
        this._sendMessage('load scene', {
            scene: scene,
        });
        return this.oncePromise('load scene done');
    }

    render(x, y, w, h) {
        this._sendMessage('render', {
            x: x,
            y: y,
            w: w,
            h: h
        });
        return this.oncePromise('render result');
    }
}

class Renderer {
    constructor(canvas) {
        this._canvas = canvas;
        this._ctx = this._canvas.getContext('2d');

        this._workers = [];

        this._imageData = null;
        this._pixels = null;

        this._initialized = false;
    }

    async init() {
        if (this._initialized) {
            return;
        }

        const cpuCount = window.navigator.hardwareConcurrency || 1;
        const workers = await Promise.all(range(cpuCount).map(_ => RenderWorker.start()));

        for (const worker of workers) {
            worker.init();
        }

        console.info('Started ' + cpuCount + ' workers');

        this._workers = workers;

        this._initialized = true;
    }

    _updatePixels() {
        this._imageData = this._ctx.getImageData(0, 0, this._width, this._height);
        this._pixels = this._imageData.data;
    }

    setSize(width, height) {
        this._width = width;
        this._height = height;

        this._canvas.width = this._width;
        this._canvas.height = this._height;

        this._updatePixels();
    }

    async loadScene(scene) {
        const sizes = await Promise.all(this._workers.map(worker => worker.loadScene(scene)));
        return sizes[0];
    }

    _clearImage() {
        this._ctx.clearRect(0, 0, this._width, this._height);
        this._updatePixels();
    }

    _updateImage(chunk, data) {
        for (let localY = 0; localY < chunk.h; localY++) {
            for (let localX = 0; localX < chunk.w; localX++) {
                const index = ((localY * chunk.w) + localX) * 3;

                const x = chunk.x + localX;
                const y = chunk.y + localY;
                const pixelIndex = ((y * this._width) + x) * 4;

                this._pixels[pixelIndex] = data[index];
                this._pixels[pixelIndex + 1] = data[index + 1];
                this._pixels[pixelIndex + 2] = data[index + 2];
                this._pixels[pixelIndex + 3] = 255;
            }
        }

        this._ctx.putImageData(this._imageData, 0, 0);
    }

    async render(chunkSize) {
        const chunks = [];
        for (let y = 0; y < this._height; y += chunkSize) {
            for (let x = 0; x < this._width; x += chunkSize) {
                chunks.push({
                    x: x,
                    y: y,
                    w: Math.min(this._width - x, chunkSize),
                    h: Math.min(this._height - y, chunkSize)
                });
            }
        }

        let nextChunkIndex = 0;
        function getChunk() {
            if (nextChunkIndex < chunks.length) {
                return chunks[nextChunkIndex++];
            }
            return null;
        }

        this._clearImage();

        const self = this;

        function renderChunk(worker, chunk) {
            return worker.render(chunk.x, chunk.y, chunk.w, chunk.h)
                .then(result => {
                    self._updateImage(chunk, result);
                    return render(worker);
                });
        }

        function render(worker) {
            const chunk = getChunk();
            if (chunk == null) {
                return Promise.resolve();
            } else {
                return renderChunk(worker, chunk);
            }
        }

        await Promise.all(this._workers.map(worker => render(worker)));
    }
}

const DEFAULT_SCENE = `{
  "camera": {
    "resolution": [800, 600],
    "fov": 45,
    "position": { "x": 3, "y": 5, "z": 8 },
    "direction": { "x": -3, "y": -4, "z": -8 },
    "up": { "x": 0, "y": 1, "z": 0 }
  },
  "aa_samples": 64,
  "clear_color": { "r": 0.6, "g": 0.8, "b": 1 },
  "materials": [
    {
      "color": { "Color": { "r": 1, "g": 1, "b": 1 } },
      "albedo": 0.4,
      "reflectivity": 0.2,
      "transparency": 0,
      "refractive_index": 1
    },
    {
      "color": { "Color": { "r": 1, "g": 0, "b": 0 } },
      "albedo": 0.4,
      "reflectivity": 0.3,
      "transparency": 0,
      "refractive_index": 1
    },
    {
      "color": { "Color": { "r": 0, "g": 1, "b": 0 } },
      "albedo": 0.4,
      "reflectivity": 0.3,
      "transparency": 0,
      "refractive_index": 1
    },
    {
      "color": { "Color": { "r": 0, "g": 0, "b": 1 } },
      "albedo": 0.4,
      "reflectivity": 0.3,
      "transparency": 0,
      "refractive_index": 1
    },
    {
      "color": { "Color": { "r": 1, "g": 1, "b": 1 } },
      "albedo": 0.4,
      "reflectivity": 0,
      "transparency": 1,
      "refractive_index": 1.5
    }
  ],
  "objects": [
    {
      "material_index": 0,
      "transform": {
        "translation": { "x": 0, "y": 0, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": 1
      },
      "shape": { "Plane": {} }
    },
    {
      "material_index": 1,
      "transform": {
        "translation": { "x": -4, "y": 2, "z": -2 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": 2
      },
      "shape": { "Sphere": {} }
    },
    {
      "material_index": 2,
      "transform": {
        "translation": { "x": 0, "y": 1, "z": -5 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": 1
      },
      "shape": { "Sphere": {} }
    },
    {
      "material_index": 3,
      "transform": {
        "translation": { "x": 3, "y": 0.5, "z": -1 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": 0.5
      },
      "shape": { "Sphere": {} }
    },
    {
      "material_index": 4,
      "transform": {
        "translation": { "x": 0, "y": 1.5, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": 1.5
      },
      "shape": { "Sphere": {} }
    }
  ],
  "ambient_light_color": { "r": 0.1, "g": 0.1, "b": 0.1 },
  "lights": [
    { "Directional": {
        "direction": { "x": -2, "y": -8, "z": -1 },
        "color": { "r": 1, "g": 1, "b": 0.9 },
        "intensity": 10
    }}
  ],
  "max_recursion_depth": 5
}`;

const sceneInput = document.querySelector('#input-scene');
const chunkSizeInput = document.querySelector('#input-chunk-size');
const renderButton = document.querySelector('#btn-render');
const statusText = document.querySelector('#status');
const canvas = document.querySelector('#canvas');

sceneInput.textContent = DEFAULT_SCENE;

const renderer = new Renderer(canvas);

function setStatus(status) {
    statusText.textContent = status;
}

function parseInt2(s) {
    const value = parseInt(s, 10);
    if (isNaN(value) || !isFinite(value)) {
        throw new Error('\'' + s + '\' is not a valid integer');
    }
    return value;
}

renderButton.addEventListener('click', _ => {
    try {
        const chunkSize = parseInt2(chunkSizeInput.value);

        let start;

        renderer.loadScene(sceneInput.textContent).then(size => {
            renderer.setSize(size.width, size.height);

            setStatus('Rendering...');

            start = Date.now();

            return renderer.render(chunkSize);
        }).then(_ => setStatus('Rendered in ' + ((Date.now() - start) / 1000).toFixed(2) + ' seconds'));
    } catch (e) {
        setStatus(e);
    }
});

renderer.init()
    .then(_ => {
        renderButton.disabled = false;
    })
    .catch(err => console.error(err));
