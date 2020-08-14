
importScripts('./pkg/raytracer_web.js');

(async function () {
    await wasm_bindgen('./pkg/raytracer_web_bg.wasm');

    sendMessage('loaded');
})().catch(err => sendMessage('load error', err.toString()));

const { RendererWrapper } = wasm_bindgen;

let renderer;

function init() {
    renderer = new RendererWrapper();
}

function load_scene(scene) {
    return renderer.load_scene_string(scene);
}

function render(x, y, w, h) {
    renderer.render(x, y, w, h);
    const result = renderer.get_result();
    return result.slice();
}

function sendMessage(name, data) {
    postMessage({
        name: name,
        data: data,
    });
}

onmessage = function (evt) {
    const message = evt.data;
    const data = message.data;
    switch (message.name) {
        case 'init':
            init();
            break;
        case 'load scene':
            const size = load_scene(data.scene);
            sendMessage('load scene done', {
                width: size[0],
                height: size[1],
            });
            break;
        case 'render':
            const result = render(data.x, data.y, data.w, data.h);
            sendMessage('render result', result);
            break;
        default:
            console.error('Invalid message:', message);
    }
};
