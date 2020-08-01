
function range(start, stop, step = 1) {
    if (typeof stop === 'undefined') {
        stop = start;
        start = 0;
    }
    return Array(Math.ceil((stop - start) / step))
        .fill(start)
        .map((x, y) => x + y * step);
}

function startWorker() {
    return new Promise(((resolve, reject) => {
        const worker = new Worker('worker.js');

        worker.addEventListener('message', function (evt) {
            const message = evt.data;
            switch (message.name) {
                case 'loaded':
                    resolve(worker);
                    break;
                case 'load error':
                    reject(message.error);
                    break;
                default:
                    console.error('Invalid message:', message);
            }
        });

        worker.postMessage({ name: 'load' });
    }));
}

(async function () {
    const cpuCount = window.navigator.hardwareConcurrency || 1;
    const workers = await Promise.all(range(cpuCount).map(i => startWorker()));

    console.info('Started ' + workers.length + ' workers');

    window.sayHello = function (who, index) {
        workers[index].postMessage({ name: 'hello', who: who });
    };
})().catch(err => console.error(err));
