
importScripts('./pkg/raytracer_web.js');

onmessage = function (evt) {
    const message = evt.data;
    switch (message.name) {
        case 'load':
            wasm_bindgen('./pkg/raytracer_web_bg.wasm')
                .then(wasm => postMessage({ name: 'loaded' }))
                .catch(err => postMessage({ name: 'load error', error: err.toString() }));
            break;
        case 'hello':
            wasm_bindgen.say_hello(message.who);
            break;
        default:
            console.error('Invalid message:', message);
    }
};
