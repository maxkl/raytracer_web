
mod console_log;

use std::panic;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    panic::set_hook(Box::new(console_error_panic_hook::hook));

    console_log!("Hello World!");
}
