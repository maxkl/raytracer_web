
mod console_log;

use std::panic;

use wasm_bindgen::prelude::*;
use js_sys::Uint8Array;

use raytracer::{Renderer, Scene};

#[wasm_bindgen]
pub struct ImageSize(pub usize, pub usize);

#[wasm_bindgen]
pub struct RendererWrapper {
    renderer: Option<Renderer>,
    result: Vec<u8>,
}

#[wasm_bindgen]
impl RendererWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> RendererWrapper {
        RendererWrapper {
            renderer: None,
            result: Vec::new(),
        }
    }

    pub fn load_scene_string(&mut self, scene_string: &str) -> ImageSize {
        let scene: Scene = serde_json::from_str(scene_string).unwrap();
        let (w, h) = scene.camera.resolution;
        self.load_scene(scene);
        ImageSize(w, h)
    }

    fn load_scene(&mut self, scene: Scene) {
        self.renderer = Some(Renderer::new(scene));
    }

    pub fn render(&mut self, x: usize, y: usize, w: usize, h: usize) {
        let renderer = self.renderer.as_ref()
            .expect("Renderer not initialized");
        let result = renderer.render_rect(x, y, w, h);

        self.result.resize(w * h * 3, 0);
        let mut i = 0;
        for local_y in 0..h {
            for local_x in 0..w {
                let pixel = result.get_pixel(local_x, local_y);
                self.result[i] = pixel.0;
                self.result[i + 1] = pixel.1;
                self.result[i + 2] = pixel.2;
                i += 3;
            }
        }
    }

    /// Get the render result as a JS Uint8Array
    ///
    /// Careful: The returned array is a view into the WASM linear memory and is thus invalidated as
    ///  soon as new allocations are made in the linear memory
    pub fn get_result(&self) -> Uint8Array {
        unsafe { Uint8Array::view(&self.result) }
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
}
