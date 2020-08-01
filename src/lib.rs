
mod console_log;

use std::panic;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn say_hello(name: String) {
    console_log!("Hello, {}!", name);
}

#[wasm_bindgen(start)]
pub fn start() {
    panic::set_hook(Box::new(console_error_panic_hook::hook));

    console_log!("WASM initialized");
}
