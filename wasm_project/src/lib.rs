use wasm_bindgen::prelude::*;
use wasm_bindgen::JsError;

mod algorithms;

use algorithms::{run_greedy, run_simulated_annealing};

#[derive(Clone, Copy)]
pub struct Rect {
    pub x1: u16,
    pub y1: u16,
    pub x2: u16,
    pub y2: u16,
    pub color: u32, // RGB
}

#[wasm_bindgen]
#[derive(Default)]
pub struct Store {
    width: usize,
    height: usize,
    steps: Vec<Vec<Rect>>,
}

#[wasm_bindgen]
impl Store {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn clear(&mut self) {
        self.width = 0;
        self.height = 0;
        self.steps.clear();
    }

    pub fn init(&mut self, width: usize, height: usize) {
        self.width = width;
        self.height = height;
        self.steps.clear();
    }

    #[wasm_bindgen(js_name = runAlgorithmWithImage)]
    pub fn run_algorithm_with_image(&mut self, algorithm_id: usize, num_rectangles: usize, rgba: &[u8]) -> Result<(), JsError> {
        let mut rgb_data = Vec::with_capacity(rgba.len() / 4 * 3);
        for chunk in rgba.chunks(4) {
            rgb_data.extend_from_slice(&chunk[..3]);
        }

        self.steps = match algorithm_id {
            1 => run_greedy(num_rectangles, self.width, self.height, &rgb_data),
            // 2 => run_simulated_annealing(self.width, self.height, rgb_data, num_rectangles),
            _ => return Err(JsError::new("Invalid algorithm_id")),
        };
        Ok(())
    }

    #[wasm_bindgen(js_name = visSvg)]
    pub fn vis_svg(&self, step: u32) -> String {
        use svg::node::element::{Group, Rectangle as SvgRect};
        use svg::Document;

        let mut doc = Document::new()
            .set("xmlns", "http://www.w3.org/2000/svg")
            .set("viewBox", (0, 0, self.width, self.height))
            .set("width", self.width)
            .set("height", self.height);

        if self.steps.is_empty() {
            return doc.to_string();
        }

        let idx = step.clamp(1, self.steps.len() as u32) as usize - 1;
        let frame = &self.steps[idx];

        let mut g = Group::new().set("shape-rendering", "crispEdges");
        for r in frame {
            let rect = SvgRect::new()
                .set("x", r.x1 as i32)
                .set("y", r.y1 as i32)
                .set("width", (r.x2 - r.x1) as i32)
                .set("height", (r.y2 - r.y1) as i32)
                .set("fill", format!("#{:06X}", r.color & 0x00_FF_FF_FF));
            g = g.add(rect);
        }
        doc = doc.add(g);
        doc.to_string()
    }

    #[wasm_bindgen(js_name = stepCount)]
    pub fn step_count(&self) -> u32 {
        self.steps.len() as u32
    }

    pub fn free(self) { /* Drop */
    }
}
