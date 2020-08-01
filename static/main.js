
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

(async function () {
    const cpuCount = window.navigator.hardwareConcurrency || 1;
    const workers = await Promise.all(range(cpuCount).map(i => RenderWorker.start()));

    for (const worker of workers) {
        worker.init();
    }

    console.info('Started ' + cpuCount + ' workers');

    const chunkSize = 30;
    const width = chunkSize * 16;
    const height = chunkSize * 9;

    const canvas = document.querySelector('#canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    let imageData = ctx.getImageData(0, 0, width, height);
    let pixels = imageData.data;

    function clearImage() {
        ctx.clearRect(0, 0, width, height);
        imageData = ctx.getImageData(0, 0, width, height);
        pixels = imageData.data;
    }

    function updateImage(chunk, data) {
        for (let localY = 0; localY < chunk.h; localY++) {
            for (let localX = 0; localX < chunk.w; localX++) {
                const index = ((localY * chunk.w) + localX) * 3;

                const x = chunk.x + localX;
                const y = chunk.y + localY;
                const pixelIndex = ((y * width) + x) * 4;

                pixels[pixelIndex + 0] = data[index + 0];
                pixels[pixelIndex + 1] = data[index + 1];
                pixels[pixelIndex + 2] = data[index + 2];
                pixels[pixelIndex + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    function run() {
        const chunks = [];
        for (let y = 0; y < height; y += chunkSize) {
            for (let x = 0; x < width; x += chunkSize) {
                chunks.push({
                    x: x,
                    y: y,
                    w: chunkSize,
                    h: chunkSize
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

        clearImage();

        function renderChunk(worker, chunk) {
            return worker.render(chunk.x, chunk.y, chunk.w, chunk.h)
                .then(result => {
                    updateImage(chunk, result);
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

        Promise.all(workers.map(worker => render(worker)))
            .then(_ => console.log('Render done'));
    }

    document.querySelector('#btn-run').addEventListener('click', evt => run());
})().catch(err => console.error(err));
