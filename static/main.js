
const w = new Worker('worker.js');
w.addEventListener('message', function (evt) {
    const message = evt.data;
    switch (message.name) {
        case 'loaded':
            console.log('Loaded');
            break;
        case 'load error':
            console.error('Load failed:', message.error);
            break;
        default:
            console.error('Invalid message:', message);
    }
});
w.postMessage({ name: 'load' });

window.say_hello = function (who) {
    w.postMessage({ name: 'hello', who: who });
};
