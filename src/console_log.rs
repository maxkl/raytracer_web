
use wasm_bindgen::JsValue;
use web_sys::console;

pub fn log_str(msg: &str) {
    if cfg!(target_arch = "wasm32") {
        console::log_1(&JsValue::from_str(msg));
    } else {
        println!("{}", msg);
    }
}

#[macro_export]
macro_rules! console_log {
    ($($arg:tt)*) => ({
        $crate::console_log::log_str(&format!($($arg)*));
    })
}
