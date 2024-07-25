mod algorithms;

use algorithms::{run_greedy, run_simulated_annealing};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(getter_with_clone)]
pub struct Ret {
    pub animation_data: Vec<String>,
    pub max_turn: usize,
}

#[wasm_bindgen]
pub fn run_algorithm(algorithm_id: usize, num_rectangles: usize, width: usize, height: usize, image_data: &[u8]) -> Ret {
    // image_data is in RGBA format, we only need RGB.
    let mut rgb_data = Vec::with_capacity(image_data.len() / 4 * 3);
    for chunk in image_data.chunks(4) {
        rgb_data.extend_from_slice(&chunk[..3]);
    }
    let animation_data = match algorithm_id {
        1 => run_greedy(num_rectangles, width, height, &rgb_data),
        2 => run_simulated_annealing(num_rectangles, width, height, &rgb_data),
        _ => vec!["Invalid Algorithm ID".to_string()],
    };
    let max_turn = animation_data.len() - 1;
    Ret { animation_data, max_turn }
}
