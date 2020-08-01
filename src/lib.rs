
mod console_log;

use std::panic;

use wasm_bindgen::prelude::*;
use js_sys::Uint8Array;

#[wasm_bindgen]
pub struct Rect {
    x: u32,
    y: u32,
    w: u32,
    h: u32,
}

#[wasm_bindgen]
impl Rect {
    #[wasm_bindgen(constructor)]
    pub fn new(x: u32, y: u32, w: u32, h: u32) -> Rect {
        Rect { x, y, w, h }
    }
}

#[wasm_bindgen]
pub struct Renderer {
    rect: Rect,
    result: Vec<u8>,
}

#[wasm_bindgen]
impl Renderer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Renderer {
        Renderer {
            rect: Rect::new(0, 0, 0, 0),
            result: Vec::new(),
        }
    }

    pub fn setup(&mut self, rect: Rect) {
        self.rect = rect;

        let new_size = self.rect.w as usize * self.rect.h as usize;
        self.result.resize(new_size * 3, 0);
    }

    pub fn render(&mut self) {
        for y in 0..self.rect.h {
            for x in 0..self.rect.w {
                let i = ((y as usize * self.rect.w as usize) + x as usize) * 3;
                self.result[i + 0] = ((x as f32 / (self.rect.w - 1) as f32) * 255f32) as u8;
                self.result[i + 1] = ((y as f32 / (self.rect.h - 1) as f32) * 255f32) as u8;
                self.result[i + 2] = 0;
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
